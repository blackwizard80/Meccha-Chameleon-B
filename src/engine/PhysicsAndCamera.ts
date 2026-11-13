import * as THREE from 'three';
import { CharacterPose, CharacterSize } from '../types/game';
import { AABBCollider } from './maps/MapTypes';

export interface MovementInput {
  moveX: number; // -1..1 (right)
  moveZ: number; // -1..1 (forward)
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
}

export interface CharacterPhysicsState {
  position: THREE.Vector3;
  velocityY: number;
  yaw: number;
  grounded: boolean;
  speed: number;
}

export function getPlayerRadius(size: CharacterSize): number {
  return size === 'petite' ? 0.28 : size === 'plump' ? 0.44 : 0.35;
}

export function getPlayerHeight(pose: CharacterPose, crouching: boolean): number {
  if (crouching || pose === 'crouching' || pose === 'curled') return 0.72;
  if (pose === 'lying') return 0.45;
  if (pose === 'sitting') return 0.92;
  return 1.68;
}

/**
 * Resolve horizontal sliding + vertical landing/step-up against map AABB colliders.
 */
export function stepPlayerPhysics(
  state: CharacterPhysicsState,
  input: MovementInput,
  cameraYaw: number,
  colliders: AABBCollider[],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  size: CharacterSize,
  pose: CharacterPose,
  dt: number,
  waitingBarrier?: { center: THREE.Vector3; radius: number } | null,
  speedMultiplier = 1.0,
): void {
  const radius = getPlayerRadius(size);
  const height = getPlayerHeight(pose, input.crouch);
  const stepHeight = 0.46;

  // Compute movement vector relative to camera yaw
  const mag = Math.hypot(input.moveX, input.moveZ);
  let targetSpeed = 0;
  let moveDirX = 0;
  let moveDirZ = 0;

  if (mag > 0.08) {
    const nx = input.moveX / Math.max(1, mag);
    const nz = input.moveZ / Math.max(1, mag);
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    // Forward is (-sin(yaw), -cos(yaw)), Right is (cos(yaw), -sin(yaw))
    moveDirX = nx * cos - nz * sin;
    moveDirZ = -nx * sin - nz * cos;
    const len = Math.hypot(moveDirX, moveDirZ);
    if (len > 0.001) {
      moveDirX /= len;
      moveDirZ /= len;
    }

    const baseSpeed = (input.crouch ? 2.5 : input.sprint ? 6.6 : 4.5) * speedMultiplier;
    targetSpeed = baseSpeed * Math.min(1, mag);

    // Smoothly turn character toward movement direction
    const desiredYaw = Math.atan2(moveDirX, moveDirZ);
    let diff = desiredYaw - state.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.yaw += diff * Math.min(1, dt * 14);
  }

  state.speed = targetSpeed;

  // Jump
  if (input.jump && state.grounded) {
    state.velocityY = 6.9;
    state.grounded = false;
  }

  // Gravity
  state.velocityY -= 19.5 * dt;

  // Proposed horizontal move
  let nextX = state.position.x + moveDirX * targetSpeed * dt;
  let nextZ = state.position.z + moveDirZ * targetSpeed * dt;

  // Clamp to map playable boundaries
  nextX = THREE.MathUtils.clamp(nextX, bounds.minX + radius, bounds.maxX - radius);
  nextZ = THREE.MathUtils.clamp(nextZ, bounds.minZ + radius, bounds.maxZ - radius);

  // If seeker is restricted to waiting area during Hiding Phase
  if (waitingBarrier) {
    const dx = nextX - waitingBarrier.center.x;
    const dz = nextZ - waitingBarrier.center.z;
    const dist = Math.hypot(dx, dz);
    if (dist > waitingBarrier.radius) {
      const s = waitingBarrier.radius / dist;
      nextX = waitingBarrier.center.x + dx * s;
      nextZ = waitingBarrier.center.z + dz * s;
    }
  }

  const py = state.position.y;

  // Resolve X and Z against AABB colliders (allowing step-up for stairs/low platforms and clearance under tables)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      // Vertical overlap check: if player feet are above collider top (or within stepHeight when walkableTop), skip horizontal push
      if (py + height <= c.minY + 0.04) continue; // Player fits cleanly under (e.g. under table!)
      if (py >= c.maxY - 0.04) continue; // Player is standing on top
      if (c.walkableTop && c.maxY - py <= stepHeight) continue; // Can step up onto this stair/platform

      const closestX = THREE.MathUtils.clamp(nextX, c.minX, c.maxX);
      const closestZ = THREE.MathUtils.clamp(nextZ, c.minZ, c.maxZ);
      const dx = nextX - closestX;
      const dz = nextZ - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          nextX += (dx / dist) * push;
          nextZ += (dz / dist) * push;
        } else {
          // Inside box: push out along shallowest axis
          const penLeft = Math.abs(nextX - c.minX);
          const penRight = Math.abs(c.maxX - nextX);
          const penFront = Math.abs(nextZ - c.minZ);
          const penBack = Math.abs(c.maxZ - nextZ);
          const m = Math.min(penLeft, penRight, penFront, penBack);
          if (m === penLeft) nextX = c.minX - radius;
          else if (m === penRight) nextX = c.maxX + radius;
          else if (m === penFront) nextZ = c.minZ - radius;
          else nextZ = c.maxZ + radius;
        }
      }
    }
  }

  state.position.x = nextX;
  state.position.z = nextZ;

  // Vertical integration & ground/platform snap
  let nextY = state.position.y + state.velocityY * dt;
  let floorY = 0;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!c.walkableTop) continue;
    if (
      nextX + radius * 0.65 > c.minX &&
      nextX - radius * 0.65 < c.maxX &&
      nextZ + radius * 0.65 > c.minZ &&
      nextZ - radius * 0.65 < c.maxZ
    ) {
      // Step-up or land on top
      if (state.position.y >= c.maxY - stepHeight && c.maxY > floorY) {
        floorY = c.maxY;
      }
    }
  }

  if (nextY <= floorY) {
    nextY = floorY;
    state.velocityY = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  state.position.y = nextY;
}

/**
 * Smooth third-person camera rig with wall-avoidance raycasting.
 */
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

export function updateThirdPersonCamera(
  camera: THREE.PerspectiveCamera,
  targetPos: THREE.Vector3,
  cameraYaw: number,
  cameraPitch: number,
  distance: number,
  heightOffset: number,
  obstacles: THREE.Object3D[],
  dt: number,
  shoulderOffsetX = 0,
): void {
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  _camTarget.set(
    targetPos.x + rightX * shoulderOffsetX,
    targetPos.y + heightOffset,
    targetPos.z + rightZ * shoulderOffsetX,
  );

  const cosPitch = Math.cos(cameraPitch);
  const sinPitch = Math.sin(cameraPitch);
  const offsetX = Math.sin(cameraYaw) * cosPitch * distance;
  const offsetZ = Math.cos(cameraYaw) * cosPitch * distance;
  const offsetY = sinPitch * distance;

  _camDesired.set(
    _camTarget.x + offsetX,
    Math.max(0.35, _camTarget.y + offsetY),
    _camTarget.z + offsetZ,
  );

  // Pull camera forward if wall obstructs line of sight
  _camDir.copy(_camDesired).sub(_camTarget);
  const maxDist = _camDir.length();
  if (maxDist > 0.1 && obstacles.length > 0) {
    _camDir.normalize();
    _raycaster.set(_camTarget, _camDir);
    _raycaster.near = 0.2;
    _raycaster.far = maxDist;
    const hits = _raycaster.intersectObjects(obstacles, false);
    if (hits.length > 0 && hits[0].distance < maxDist) {
      const safeDist = Math.max(0.75, hits[0].distance - 0.25);
      _camDesired.copy(_camTarget).addScaledVector(_camDir, safeDist);
    }
  }

  const smooth = 1 - Math.exp(-16 * dt);
  camera.position.lerp(_camDesired, smooth);
  camera.lookAt(_camTarget);
}
