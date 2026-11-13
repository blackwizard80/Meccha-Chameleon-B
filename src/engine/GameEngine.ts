import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/SoundEngine';
import {
  AnimationState,
  BodyPartId,
  CharacterPose,
  CharacterShape,
  CharacterSize,
  CloneState,
  GraphicsQuality,
  MapId,
  PaintPattern,
  PaintSample,
  PaintTool,
  PlayerAppearance,
  RoomState,
  SeekerActionEvent,
  SeekerTheme,
  TeamRole,
  Vec3,
} from '../types/game';
import { CharacterPainter, sampleWorldIntersection } from './CharacterPainter';
import { CharacterRig } from './CharacterRig';
import { getSeekerEnergyColors } from './SeekerBlaster';
import { SeekerRig } from './SeekerRig';
import { buildMap } from './maps/MapBuilder';
import { BuiltMap } from './maps/MapTypes';
import {
  CharacterPhysicsState,
  MovementInput,
  stepPlayerPhysics,
  updateThirdPersonCamera,
} from './PhysicsAndCamera';

const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _v3C = new THREE.Vector3();
const _ndc = new THREE.Vector2();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

interface RemoteActor {
  role: TeamRole;
  hiderRig: CharacterRig;
  seekerRig: SeekerRig | null;
  targetPos: THREE.Vector3;
  targetYaw: number;
  targetAimPitch: number;
  animation: AnimationState;
  pose: CharacterPose;
  lastTextureUrl: string | null;
  seekerTheme: SeekerTheme;
  speedBoostTimer: number;
  scannerTimer: number;
}

interface CloneActor {
  rig: CharacterRig;
  pose: CharacterPose;
  lastTextureUrl: string | null;
}

interface RingFX {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  maxScale: number;
}

interface ProjectileFX {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  age: number;
  duration: number;
  colorHex: number;
  spawnedImpact: boolean;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
}

export interface SeekerHudSnapshot {
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  aiming: boolean;
  scannerCooldown: number;
  pulseCooldown: number;
  boostCooldown: number;
  boostActive: boolean;
  scannerActive: boolean;
}

export interface EngineCallbacks {
  onSampledColor?: (sample: PaintSample) => void;
  onPaintModified?: (appearance: PlayerAppearance) => void;
  onLocalTransform?: (
    pos: Vec3,
    rotY: number,
    anim: AnimationState,
    aimPitch?: number,
  ) => void;
  onSeekerTargetChange?: (
    target: { id: string; isClone: boolean; distance: number } | null,
  ) => void;
  onSeekerHudUpdate?: (hud: SeekerHudSnapshot) => void;
  onSeekerWeaponHit?: (targetId: string, isClone: boolean) => void;
  onSeekerClue?: (message: string) => void;
  onSeekerActionEmit?: (event: Omit<SeekerActionEvent, 'playerId'>) => void;
}

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly isSoftwareGl: boolean;
  private readonly raycaster = new THREE.Raycaster();
  private readonly clock = new THREE.Clock();

  private keyLight!: THREE.DirectionalLight;
  private builtMap: BuiltMap | null = null;
  private localHiderRig: CharacterRig;
  private localSeekerRig: SeekerRig;
  private localRole: TeamRole = 'hider';
  private remoteActors = new Map<string, RemoteActor>();
  private cloneActors = new Map<string, CloneActor>();

  private fxRings: RingFX[] = [];
  private projectiles: ProjectileFX[] = [];
  private sparks: SparkParticle[] = [];

  private physics: CharacterPhysicsState = {
    position: new THREE.Vector3(0, 0.05, 0),
    velocityY: 0,
    yaw: 0,
    grounded: true,
    speed: 0,
  };

  private input: MovementInput = {
    moveX: 0,
    moveZ: 0,
    jump: false,
    crouch: false,
    sprint: false,
  };

  private cameraYaw = 0;
  private cameraPitch = 0.34;
  private cameraDistance = 4.6;
  private freeCameraMode = false;
  private freeCameraPos = new THREE.Vector3(0, 6, 8);
  private cameraSensitivity = 1.0;
  private invertY = false;

  private localPose: CharacterPose = 'standing';
  private localAnim: AnimationState = 'idle';
  private paintStudioOpen = false;
  private activePaintTool: PaintTool = 'brush';
  private activePaintColor = '#d97706';
  private activePaintPattern: PaintPattern = 'solid';
  private activeBrushSize = 18;
  private isPaintingStroke = false;

  // Seeker Blaster & Equipment State
  private readonly maxAmmo = 8;
  private ammo = 8;
  private fireCooldown = 0;
  private reloadTimer = 0;
  private readonly reloadDuration = 1.6;
  private aiming = false;
  private inspectTimer = 0;
  private shootAnimTimer = 0;
  private scannerActiveTimer = 0;
  private scannerCooldown = 0;
  private scannerScanTick = 0;
  private pulseCooldown = 0;
  private boostActiveTimer = 0;
  private boostCooldown = 0;
  private lastHudEmitAt = 0;
  private seekerTheme: SeekerTheme = 'cyan';

  private localPlayerId: string | null = null;
  private roomState: RoomState | null = null;
  private callbacks: EngineCallbacks = {};

  private frameId = 0;
  private disposed = false;
  private lastTransformSentAt = 0;
  private footstepTimer = 0;
  private wasGrounded = true;

  private keys = new Set<string>();
  public hasTouchInput = false;

  constructor(
    container: HTMLElement,
    initialAppearance: PlayerAppearance,
    quality: GraphicsQuality,
    callbacks: EngineCallbacks = {},
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.seekerTheme = initialAppearance.seekerTheme || 'cyan';

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyGraphicsQuality(quality);

    this.renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || 16) / (container.clientHeight || 9),
      0.1,
      140,
    );

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.setupLighting(quality);

    // Local Hider Rig (unchanged)
    this.localHiderRig = new CharacterRig(initialAppearance.textureDataUrl);
    this.localHiderRig.rebuildModel(initialAppearance.shape, initialAppearance.size);
    this.localPose = initialAppearance.pose;
    this.scene.add(this.localHiderRig.group);

    // Local Seeker Rig (hidden until role === 'seeker')
    this.localSeekerRig = new SeekerRig(this.seekerTheme);
    this.localSeekerRig.group.visible = false;
    this.scene.add(this.localSeekerRig.group);

    this.bindWindowEvents();
    this.startLoop();
  }

  private setupLighting(quality: GraphicsQuality): void {
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x3f2e21, 0.72);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xfff3e0, 1.35);
    this.keyLight.position.set(14, 24, 12);
    this.keyLight.castShadow = !this.isSoftwareGl && quality !== 'low';
    const shadowSize = quality === 'high' ? 2048 : 1024;
    this.keyLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 65;
    const d = 24;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const fill1 = new THREE.PointLight(0xffedd5, 0.8, 36, 1.2);
    fill1.position.set(-10, 5.2, -6);
    this.scene.add(fill1);

    const fill2 = new THREE.PointLight(0xe0f2fe, 0.7, 36, 1.2);
    fill2.position.set(10, 5.2, 6);
    this.scene.add(fill2);
  }

  public applyGraphicsQuality(quality: GraphicsQuality): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      return;
    }
    const maxPr = quality === 'high' ? 2 : quality === 'medium' ? 1.35 : 0.9;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPr));
    this.renderer.shadowMap.enabled = quality !== 'low';
    if (this.keyLight) {
      this.keyLight.castShadow = quality !== 'low';
    }
  }

  public setControlPreferences(sensitivity: number, invertY: boolean): void {
    this.cameraSensitivity = sensitivity;
    this.invertY = invertY;
  }

  public loadMap(mapId: MapId): void {
    if (this.builtMap) {
      this.scene.remove(this.builtMap.group);
      this.builtMap.dispose();
      this.builtMap = null;
    }
    const anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const map = buildMap(mapId, Math.min(8, anisotropy));
    this.builtMap = map;
    this.scene.add(map.group);
    this.scene.background = new THREE.Color(map.skyColor);
    this.scene.fog = new THREE.FogExp2(map.skyColor, map.fogDensity);

    const spawn = map.hiderSpawns[0] || new THREE.Vector3(0, 0.05, 0);
    this.physics.position.copy(spawn);
    this.physics.velocityY = 0;

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  public getPainter(): CharacterPainter {
    return this.localHiderRig.painter;
  }

  public getLocalAppearance(): PlayerAppearance {
    return {
      shape: this.localHiderRig.getShape(),
      size: this.localHiderRig.getSize(),
      pose: this.localPose,
      textureDataUrl: this.localHiderRig.painter.exportSyncDataUrl(),
      accentColor: this.localHiderRig.painter.getDominantColorHex(),
      seekerTheme: this.seekerTheme,
    };
  }

  public setLocalShapeAndSize(shape: CharacterShape, size: CharacterSize): void {
    this.localHiderRig.rebuildModel(shape, size);
    this.emitAppearanceChange();
  }

  public setLocalPose(pose: CharacterPose): void {
    this.localPose = pose;
    this.emitAppearanceChange();
  }

  public rotateCharacterYaw(deltaRad: number): void {
    this.physics.yaw += deltaRad;
  }

  public setPaintStudioState(
    open: boolean,
    tool: PaintTool,
    colorHex: string,
    pattern: PaintPattern,
    brushSize: number,
  ): void {
    this.paintStudioOpen = open;
    this.activePaintTool = tool;
    this.activePaintColor = colorHex;
    this.activePaintPattern = pattern;
    this.activeBrushSize = brushSize;
    this.cameraDistance = open ? 2.45 : 4.6;
  }

  public fillBodyPart(part: BodyPartId): void {
    this.localHiderRig.painter.fillBodyPart(
      part,
      this.activePaintColor,
      this.activePaintPattern,
      true,
    );
    soundEngine.playPaintStroke();
    this.emitAppearanceChange();
  }

  public fillFullBody(): void {
    this.localHiderRig.painter.fillFullBody(
      this.activePaintColor,
      this.activePaintPattern,
      true,
    );
    soundEngine.playPaintStroke();
    this.emitAppearanceChange();
  }

  public resetPaintToWhite(): void {
    this.localHiderRig.painter.resetToWhite(true);
    soundEngine.playPaintStroke();
    this.emitAppearanceChange();
  }

  public undoPaint(): void {
    if (this.localHiderRig.painter.undo()) {
      this.emitAppearanceChange();
    }
  }

  public redoPaint(): void {
    if (this.localHiderRig.painter.redo()) {
      this.emitAppearanceChange();
    }
  }

  private emitAppearanceChange(): void {
    this.callbacks.onPaintModified?.(this.getLocalAppearance());
  }

  public setJoystick(x: number, z: number): void {
    this.input.moveX = x;
    this.input.moveZ = z;
  }

  public triggerJump(): void {
    this.input.jump = true;
  }

  public setCrouch(crouching: boolean): void {
    this.input.crouch = crouching;
  }

  public setFreeCamera(enabled: boolean): void {
    this.freeCameraMode = enabled;
    if (enabled) {
      this.freeCameraPos.copy(this.camera.position);
    }
  }

  public rotateCameraBy(dx: number, dy: number): void {
    const sens = (this.aiming ? 0.0034 : 0.0052) * this.cameraSensitivity;
    this.cameraYaw -= dx * sens;
    const ySign = this.invertY ? -1 : 1;
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch + dy * sens * ySign,
      -0.38,
      1.15,
    );
  }

  // === SEEKER WEAPON & ABILITY METHODS ===
  public setSeekerAim(aim: boolean): void {
    this.aiming = aim;
    if (aim) {
      this.cameraDistance = 2.65;
    } else {
      this.cameraDistance = 4.6;
    }
    this.emitSeekerHud(true);
  }

  public triggerWeaponInspect(): void {
    if (this.localRole !== 'seeker') return;
    this.inspectTimer = 2.2;
  }

  public reloadSeekerBlaster(): void {
    if (this.localRole !== 'seeker') return;
    if (this.reloadTimer > 0 || this.ammo >= this.maxAmmo) return;
    this.reloadTimer = this.reloadDuration;
    this.localSeekerRig.triggerReload(this.reloadDuration);
    soundEngine.playReload();
    this.callbacks.onSeekerActionEmit?.({ action: 'reload' });
    this.emitSeekerHud(true);
  }

  public fireSeekerBlaster(): void {
    if (this.localRole !== 'seeker') return;
    if (this.reloadTimer > 0) return;
    if (this.ammo <= 0) {
      this.reloadSeekerBlaster();
      return;
    }
    if (this.fireCooldown > 0) return;
    if (this.roomState && this.roomState.phase !== 'seeking') {
      this.callbacks.onSeekerClue?.('Weapon locked until Seeking Time begins!');
      return;
    }

    this.ammo -= 1;
    this.fireCooldown = 0.36;
    this.shootAnimTimer = 0.24;

    // Face camera aim direction immediately when firing
    this.physics.yaw = this.cameraYaw + Math.PI;
    this.localSeekerRig.group.rotation.y = this.physics.yaw;
    this.localSeekerRig.triggerShoot();
    soundEngine.playBlasterShot();

    // Raycast from screen center crosshair
    _ndc.set(0, 0);
    this.raycaster.setFromCamera(_ndc, this.camera);
    this.raycaster.near = 0.4;
    this.raycaster.far = 26;

    let maxHitDist = 26;
    let impactPoint = this.raycaster.ray.origin
      .clone()
      .addScaledVector(this.raycaster.ray.direction, 24);

    if (this.builtMap) {
      const wallHits = this.raycaster.intersectObjects(this.builtMap.paintableSurfaces, false);
      if (wallHits.length > 0 && wallHits[0].distance < maxHitDist) {
        maxHitDist = wallHits[0].distance;
        impactPoint.copy(wallHits[0].point);
      }
    }

    // Check active Hiders & Clones closer than wallHit
    let hitTarget: { id: string; isClone: boolean; dist: number; point: THREE.Vector3 } | null = null;

    if (this.roomState) {
      for (const p of this.roomState.players) {
        if (p.id === this.localPlayerId || p.found) continue;
        if (this.roomState.settings.gameMode !== 'double' && p.team !== 'hider') continue;
        const actor = this.remoteActors.get(p.id);
        if (!actor) continue;
        const meshes =
          actor.role === 'seeker' && actor.seekerRig
            ? [actor.seekerRig.group]
            : actor.hiderRig.paintableMeshes;
        const hits = this.raycaster.intersectObjects(meshes, true);
        if (hits.length > 0 && hits[0].distance < maxHitDist) {
          if (!hitTarget || hits[0].distance < hitTarget.dist) {
            hitTarget = {
              id: p.id,
              isClone: false,
              dist: hits[0].distance,
              point: hits[0].point.clone(),
            };
          }
        }
      }

      for (const c of this.roomState.clones) {
        const ca = this.cloneActors.get(c.id);
        if (!ca) continue;
        const hits = this.raycaster.intersectObjects(ca.rig.paintableMeshes, false);
        if (hits.length > 0 && hits[0].distance < maxHitDist) {
          if (!hitTarget || hits[0].distance < hitTarget.dist) {
            hitTarget = {
              id: c.id,
              isClone: true,
              dist: hits[0].distance,
              point: hits[0].point.clone(),
            };
          }
        }
      }
    }

    if (hitTarget) {
      impactPoint.copy(hitTarget.point);
      soundEngine.playHitConfirm();
      this.callbacks.onSeekerWeaponHit?.(hitTarget.id, hitTarget.isClone);
    }

    const muzzlePos = this.localSeekerRig.blaster.getMuzzleWorldPosition(_v3A).clone();
    const colorHex = getSeekerEnergyColors(this.seekerTheme).primary;
    this.spawnProjectileFX(muzzlePos, impactPoint, colorHex, Boolean(hitTarget));

    this.callbacks.onSeekerActionEmit?.({
      action: 'shoot',
      origin: { x: muzzlePos.x, y: muzzlePos.y, z: muzzlePos.z },
      target: { x: impactPoint.x, y: impactPoint.y, z: impactPoint.z },
      hitConfirmed: Boolean(hitTarget),
    });

    if (this.ammo === 0) {
      this.reloadSeekerBlaster();
    } else {
      this.emitSeekerHud(true);
    }
  }

  public triggerSeekerScanner(): void {
    if (this.localRole !== 'seeker' || this.scannerCooldown > 0) return;
    this.scannerCooldown = 12;
    this.scannerActiveTimer = 4.0;
    this.scannerScanTick = 0;
    soundEngine.playScanner();
    this.spawnRingFX(this.physics.position, getSeekerEnergyColors(this.seekerTheme).primary, 6.0);
    this.callbacks.onSeekerActionEmit?.({ action: 'scanner' });
    this.callbacks.onSeekerClue?.('Optical Scanner active: checking line-of-sight anomalies...');
    this.emitSeekerHud(true);
  }

  public triggerSeekerPulse(): void {
    if (this.localRole !== 'seeker' || this.pulseCooldown > 0) return;
    this.pulseCooldown = 18;
    soundEngine.playDetectionPulse();
    this.spawnRingFX(this.physics.position, 0x38bdf8, 13.5);
    this.callbacks.onSeekerActionEmit?.({ action: 'pulse' });

    // Directional clue only (never reveals player outlines through walls)
    if (this.roomState) {
      let nearestDist = Infinity;
      let nearestDelta = new THREE.Vector3();
      for (const p of this.roomState.players) {
        if (p.id === this.localPlayerId || p.found || p.team !== 'hider') continue;
        _v3A.set(p.position.x, p.position.y, p.position.z);
        const d = _v3A.distanceTo(this.physics.position);
        if (d <= 14 && d < nearestDist) {
          nearestDist = d;
          nearestDelta.copy(_v3A).sub(this.physics.position);
        }
      }
      if (nearestDist < Infinity) {
        const ns = nearestDelta.z < -1.5 ? 'North' : nearestDelta.z > 1.5 ? 'South' : '';
        const ew = nearestDelta.x > 1.5 ? 'East' : nearestDelta.x < -1.5 ? 'West' : '';
        const dir = [ns, ew].filter(Boolean).join('-') || 'very close by';
        this.callbacks.onSeekerClue?.(
          `Pulse Echo: Faint chameleon signal ${Math.round(nearestDist)}m ${dir}!`,
        );
      } else {
        this.callbacks.onSeekerClue?.('Pulse Echo: No hidden signals within 14m.');
      }
    }
    this.emitSeekerHud(true);
  }

  public triggerSeekerBoost(): void {
    if (this.localRole !== 'seeker' || this.boostCooldown > 0) return;
    this.boostCooldown = 15;
    this.boostActiveTimer = 4.5;
    soundEngine.playSpeedBoost();
    this.spawnRingFX(this.physics.position, 0xf97316, 3.2);
    this.callbacks.onSeekerActionEmit?.({ action: 'boost' });
    this.callbacks.onSeekerClue?.('Thruster Boost engaged!');
    this.emitSeekerHud(true);
  }

  public applyRemoteSeekerAction(event: SeekerActionEvent): void {
    const actor = this.remoteActors.get(event.playerId);
    if (!actor || !actor.seekerRig) return;

    const colorHex = getSeekerEnergyColors(actor.seekerTheme).primary;
    if (event.action === 'shoot') {
      actor.seekerRig.triggerShoot();
      if (event.origin && event.target) {
        this.spawnProjectileFX(
          new THREE.Vector3(event.origin.x, event.origin.y, event.origin.z),
          new THREE.Vector3(event.target.x, event.target.y, event.target.z),
          colorHex,
          Boolean(event.hitConfirmed),
        );
      }
    } else if (event.action === 'reload') {
      actor.seekerRig.triggerReload(this.reloadDuration);
    } else if (event.action === 'scanner') {
      actor.scannerTimer = 4.0;
      this.spawnRingFX(actor.targetPos, colorHex, 5.5);
    } else if (event.action === 'pulse') {
      this.spawnRingFX(actor.targetPos, 0x38bdf8, 12.0);
    } else if (event.action === 'boost') {
      actor.speedBoostTimer = 4.5;
      this.spawnRingFX(actor.targetPos, 0xf97316, 3.0);
    }
  }

  private emitSeekerHud(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastHudEmitAt < 120) return;
    this.lastHudEmitAt = now;
    this.callbacks.onSeekerHudUpdate?.({
      ammo: this.ammo,
      maxAmmo: this.maxAmmo,
      reloading: this.reloadTimer > 0,
      aiming: this.aiming,
      scannerCooldown: this.scannerCooldown,
      pulseCooldown: this.pulseCooldown,
      boostCooldown: this.boostCooldown,
      boostActive: this.boostActiveTimer > 0,
      scannerActive: this.scannerActiveTimer > 0,
    });
  }

  // === HIDER POINTER PAINTING & EYEDROPPER ===
  public handleCanvasPointer(
    clientX: number,
    clientY: number,
    phase: 'down' | 'move' | 'up',
  ): boolean {
    if (phase === 'up') {
      if (this.isPaintingStroke) {
        this.isPaintingStroke = false;
        this.emitAppearanceChange();
      }
      return false;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(_ndc, this.camera);

    if (this.activePaintTool === 'eyedropper' && phase === 'down' && this.builtMap) {
      const worldHits = this.raycaster.intersectObjects(this.builtMap.paintableSurfaces, false);
      if (worldHits.length > 0) {
        const sample = sampleWorldIntersection(worldHits[0]);
        soundEngine.playEyedropper();
        this.spawnRingFX(worldHits[0].point, new THREE.Color(sample.hex).getHex());
        this.callbacks.onSampledColor?.(sample);
        return true;
      }
    }

    if (
      this.localRole === 'hider' &&
      this.paintStudioOpen &&
      (this.activePaintTool === 'brush' || this.activePaintTool === 'eraser')
    ) {
      const charHits = this.raycaster.intersectObjects(this.localHiderRig.paintableMeshes, false);
      if (charHits.length > 0 && charHits[0].uv) {
        if (phase === 'down') {
          this.localHiderRig.painter.pushHistory();
          this.isPaintingStroke = true;
          soundEngine.playPaintStroke();
        }
        if (this.isPaintingStroke) {
          this.localHiderRig.painter.paintAtUV(
            charHits[0].uv.x,
            charHits[0].uv.y,
            this.activePaintColor,
            this.activeBrushSize,
            this.activePaintPattern,
            this.activePaintTool === 'eraser',
          );
        }
        return true;
      }
    }

    return false;
  }

  public syncRoomState(room: RoomState, localPlayerId: string | null): void {
    const prevPhase = this.roomState?.phase;
    const prevMap = this.roomState?.settings.mapId;
    this.roomState = room;
    this.localPlayerId = localPlayerId;

    if (!this.builtMap || prevMap !== room.settings.mapId) {
      this.loadMap(room.settings.mapId);
    }

    const localP = room.players.find((p) => p.id === localPlayerId);
    if (localP) {
      this.localRole = localP.team;
      this.seekerTheme = localP.appearance.seekerTheme || 'cyan';
      this.localSeekerRig.setTheme(this.seekerTheme);

      if (prevPhase !== room.phase) {
        this.physics.position.set(localP.position.x, localP.position.y, localP.position.z);
        this.physics.velocityY = 0;
        this.aiming = false;
        this.ammo = this.maxAmmo;
        this.reloadTimer = 0;
        this.scannerCooldown = 0;
        this.pulseCooldown = 0;
        this.boostCooldown = 0;
        this.setFreeCamera(Boolean(localP.found));
      }
    }

    // Sync Remote Players
    const activeIds = new Set<string>();
    room.players.forEach((p) => {
      if (p.id === localPlayerId) return;
      activeIds.add(p.id);
      let actor = this.remoteActors.get(p.id);
      const theme = p.appearance.seekerTheme || 'cyan';

      if (!actor) {
        const hiderRig = new CharacterRig(p.appearance.textureDataUrl);
        hiderRig.rebuildModel(p.appearance.shape, p.appearance.size);
        hiderRig.group.position.set(p.position.x, p.position.y, p.position.z);
        this.scene.add(hiderRig.group);

        let seekerRig: SeekerRig | null = null;
        if (p.team === 'seeker') {
          seekerRig = new SeekerRig(theme);
          seekerRig.group.position.set(p.position.x, p.position.y, p.position.z);
          this.scene.add(seekerRig.group);
          hiderRig.group.visible = false;
        }

        actor = {
          role: p.team,
          hiderRig,
          seekerRig,
          targetPos: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
          targetYaw: p.rotationY,
          targetAimPitch: p.aimPitch ?? 0,
          animation: p.animation,
          pose: p.appearance.pose,
          lastTextureUrl: p.appearance.textureDataUrl,
          seekerTheme: theme,
          speedBoostTimer: 0,
          scannerTimer: 0,
        };
        this.remoteActors.set(p.id, actor);
      } else {
        actor.role = p.team;
        actor.seekerTheme = theme;

        if (p.team === 'seeker' && !actor.seekerRig) {
          actor.seekerRig = new SeekerRig(theme);
          actor.seekerRig.group.position.copy(actor.targetPos);
          this.scene.add(actor.seekerRig.group);
        }
        if (actor.seekerRig) {
          actor.seekerRig.setTheme(theme);
        }

        if (
          actor.hiderRig.getShape() !== p.appearance.shape ||
          actor.hiderRig.getSize() !== p.appearance.size
        ) {
          actor.hiderRig.rebuildModel(p.appearance.shape, p.appearance.size);
        }
        if (actor.lastTextureUrl !== p.appearance.textureDataUrl) {
          actor.lastTextureUrl = p.appearance.textureDataUrl;
          actor.hiderRig.painter.loadFromDataUrl(p.appearance.textureDataUrl);
        }
        actor.pose = p.appearance.pose;
        actor.targetPos.set(p.position.x, p.position.y, p.position.z);
        actor.targetYaw = p.rotationY;
        actor.targetAimPitch = p.aimPitch ?? 0;
        actor.animation = p.animation;
      }

      const visible = p.team !== 'spectator' && !p.found;
      actor.hiderRig.group.visible = visible && p.team !== 'seeker';
      if (actor.seekerRig) {
        actor.seekerRig.group.visible = visible && p.team === 'seeker';
      }
    });

    for (const [id, actor] of this.remoteActors.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(actor.hiderRig.group);
        actor.hiderRig.dispose();
        if (actor.seekerRig) {
          this.scene.remove(actor.seekerRig.group);
          actor.seekerRig.dispose();
        }
        this.remoteActors.delete(id);
      }
    }

    this.syncClones(room.clones);
  }

  public syncClones(clones: CloneState[]): void {
    const activeCloneIds = new Set<string>();
    clones.forEach((c) => {
      activeCloneIds.add(c.id);
      let ca = this.cloneActors.get(c.id);
      if (!ca) {
        const rig = new CharacterRig(c.appearance.textureDataUrl);
        rig.rebuildModel(c.appearance.shape, c.appearance.size);
        rig.group.position.set(c.position.x, c.position.y, c.position.z);
        rig.group.rotation.y = c.rotationY;
        this.scene.add(rig.group);
        ca = { rig, pose: c.appearance.pose, lastTextureUrl: c.appearance.textureDataUrl };
        this.cloneActors.set(c.id, ca);
      } else {
        ca.rig.group.position.set(c.position.x, c.position.y, c.position.z);
        ca.rig.group.rotation.y = c.rotationY;
        ca.pose = c.appearance.pose;
      }
    });

    for (const [id, ca] of this.cloneActors.entries()) {
      if (!activeCloneIds.has(id)) {
        this.scene.remove(ca.rig.group);
        ca.rig.dispose();
        this.cloneActors.delete(id);
      }
    }
  }

  public applyRemoteDelta(
    id: string,
    pos: Vec3,
    rotY: number,
    anim: AnimationState,
    aimPitch?: number,
  ): void {
    const actor = this.remoteActors.get(id);
    if (!actor) return;
    actor.targetPos.set(pos.x, pos.y, pos.z);
    actor.targetYaw = rotY;
    actor.animation = anim;
    if (aimPitch !== undefined) actor.targetAimPitch = aimPitch;
  }

  public spawnRingFX(pos: THREE.Vector3 | Vec3, colorHex = 0x34d399, maxScale = 4.2): void {
    const geo = new THREE.RingGeometry(0.25, 0.42, 28);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.16, pos.z);
    this.scene.add(mesh);
    this.fxRings.push({ mesh, age: 0, maxAge: 0.9, maxScale });
  }

  private spawnProjectileFX(
    start: THREE.Vector3,
    end: THREE.Vector3,
    colorHex: number,
    hitConfirmed: boolean,
  ): void {
    const geo = new THREE.CylinderGeometry(0.032, 0.032, 0.65, 8);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    mesh.lookAt(end);
    this.scene.add(mesh);

    const dist = start.distanceTo(end);
    const duration = THREE.MathUtils.clamp(dist / 58, 0.04, 0.35);
    this.projectiles.push({
      mesh,
      start: start.clone(),
      end: end.clone(),
      age: 0,
      duration,
      colorHex: hitConfirmed ? 0xfbbf24 : colorHex,
      spawnedImpact: false,
    });
  }

  private spawnImpactSparks(point: THREE.Vector3, colorHex: number, count = 10): void {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.045, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(point);
      this.scene.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5.2,
        Math.random() * 3.8 + 0.8,
        (Math.random() - 0.5) * 5.2,
      );
      this.sparks.push({ mesh, vel, age: 0, maxAge: 0.38 });
    }
  }

  public getLocalPosition(): Vec3 {
    return {
      x: this.physics.position.x,
      y: this.physics.position.y,
      z: this.physics.position.z,
    };
  }

  public getLocalYaw(): number {
    return this.physics.yaw;
  }

  public findNearestCatchTarget(): { id: string; isClone: boolean; distance: number } | null {
    if (!this.roomState || this.roomState.phase !== 'seeking') return null;
    const localP = this.roomState.players.find((p) => p.id === this.localPlayerId);
    if (!localP || localP.team !== 'seeker' || localP.found) return null;

    let best: { id: string; isClone: boolean; distance: number } | null = null;
    const maxDist = 3.6;

    for (const p of this.roomState.players) {
      if (p.id === this.localPlayerId || p.found) continue;
      if (this.roomState.settings.gameMode !== 'double' && p.team !== 'hider') continue;
      const d = _v3A.set(p.position.x, p.position.y, p.position.z).distanceTo(this.physics.position);
      if (d <= maxDist && (!best || d < best.distance)) {
        best = { id: p.id, isClone: false, distance: d };
      }
    }

    for (const c of this.roomState.clones) {
      const d = _v3B.set(c.position.x, c.position.y, c.position.z).distanceTo(this.physics.position);
      if (d <= maxDist && (!best || d < best.distance)) {
        best = { id: c.id, isClone: true, distance: d };
      }
    }

    return best;
  }

  private bindWindowEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys.add(e.code);
    if (e.code === 'Space') this.input.jump = true;
    if (e.code === 'KeyC' || e.code === 'ControlLeft') this.input.crouch = !this.input.crouch;
    if (e.code === 'KeyR' && this.localRole === 'seeker') this.reloadSeekerBlaster();
    if (e.code === 'KeyF' && this.localRole === 'seeker') this.fireSeekerBlaster();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.elapsedTime;

      this.stepSimulation(dt, elapsed);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepSimulation(dt: number, elapsed: number): void {
    if (this.builtMap?.update) {
      this.builtMap.update(elapsed);
    }

    // Step Seeker Cooldowns & Reload
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.shootAnimTimer > 0) this.shootAnimTimer = Math.max(0, this.shootAnimTimer - dt);
    if (this.inspectTimer > 0) this.inspectTimer = Math.max(0, this.inspectTimer - dt);
    if (this.scannerCooldown > 0) this.scannerCooldown = Math.max(0, this.scannerCooldown - dt);
    if (this.pulseCooldown > 0) this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    if (this.boostCooldown > 0) this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    if (this.boostActiveTimer > 0) this.boostActiveTimer = Math.max(0, this.boostActiveTimer - dt);

    if (this.reloadTimer > 0) {
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);
      if (this.reloadTimer === 0) {
        this.ammo = this.maxAmmo;
      }
    }

    // Active Optical Scanner checks line-of-sight targets in front cone without wallhacks
    if (this.scannerActiveTimer > 0) {
      this.scannerActiveTimer = Math.max(0, this.scannerActiveTimer - dt);
      this.scannerScanTick -= dt;
      if (this.scannerScanTick <= 0 && this.roomState && this.builtMap) {
        this.scannerScanTick = 0.85;
        const forwardX = -Math.sin(this.cameraYaw);
        const forwardZ = -Math.cos(this.cameraYaw);
        const origin = _v3A.set(this.physics.position.x, this.physics.position.y + 1.3, this.physics.position.z);

        for (const p of this.roomState.players) {
          if (p.id === this.localPlayerId || p.found || p.team !== 'hider') continue;
          _v3B.set(p.position.x, p.position.y + 0.8, p.position.z);
          _v3C.copy(_v3B).sub(origin);
          const dist = _v3C.length();
          if (dist > 10.5) continue;
          _v3C.normalize();
          const dot = _v3C.x * forwardX + _v3C.z * forwardZ;
          if (dot < 0.55) continue; // ~56 deg forward cone

          this.raycaster.set(origin, _v3C);
          this.raycaster.near = 0.2;
          this.raycaster.far = dist;
          const blocked = this.raycaster.intersectObjects(this.builtMap.paintableSurfaces, false);
          if (blocked.length === 0) {
            this.spawnRingFX(p.position, 0x22d3ee, 2.2);
          }
        }
      }
    }

    const kbX =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const kbZ =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const activeInput: MovementInput = {
      moveX: kbX !== 0 || kbZ !== 0 ? kbX : this.input.moveX,
      moveZ: kbX !== 0 || kbZ !== 0 ? kbZ : this.input.moveZ,
      jump: this.input.jump,
      crouch: this.input.crouch,
      sprint:
        this.keys.has('ShiftLeft') ||
        this.keys.has('ShiftRight') ||
        Math.hypot(this.input.moveX, this.input.moveZ) > 0.78,
    };
    this.input.jump = false;

    const localP = this.roomState?.players.find((p) => p.id === this.localPlayerId);
    const isSpectator = localP?.found || localP?.team === 'spectator';
    const isFrozenObservation =
      this.roomState?.phase === 'observation' && localP?.team === 'hider';

    const isSeeker = this.localRole === 'seeker' && !isSpectator;
    this.localHiderRig.group.visible = !isSeeker && !isSpectator && !this.freeCameraMode;
    this.localSeekerRig.group.visible = isSeeker && !isSpectator && !this.freeCameraMode;

    // Dynamic FOV for Seeker Aim vs Speed Boost
    const targetFov = isSeeker && this.aiming ? 47 : isSeeker && this.boostActiveTimer > 0 ? 70 : 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 12, dt);
      this.camera.updateProjectionMatrix();
    }

    if (this.freeCameraMode || isSpectator) {
      const flySpeed = 8.5 * dt;
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);
      this.freeCameraPos.x += (forwardX * activeInput.moveZ + rightX * activeInput.moveX) * flySpeed;
      this.freeCameraPos.z += (forwardZ * activeInput.moveZ + rightZ * activeInput.moveX) * flySpeed;
      this.freeCameraPos.y = THREE.MathUtils.clamp(this.freeCameraPos.y, 1.2, 14);
      this.camera.position.copy(this.freeCameraPos);
      const lookX = this.freeCameraPos.x + forwardX * Math.cos(this.cameraPitch) * 4;
      const lookY = this.freeCameraPos.y - Math.sin(this.cameraPitch) * 4;
      const lookZ = this.freeCameraPos.z + forwardZ * Math.cos(this.cameraPitch) * 4;
      this.camera.lookAt(lookX, lookY, lookZ);
    } else if (this.builtMap) {
      const seekerWaiting =
        this.roomState?.phase === 'hiding' && localP?.team === 'seeker'
          ? { center: this.builtMap.waitingAreaCenter, radius: 3.4 }
          : null;

      const speedMult = isSeeker && this.boostActiveTimer > 0 ? 1.48 : 1.0;

      if (!isFrozenObservation && (!this.paintStudioOpen || isSeeker)) {
        stepPlayerPhysics(
          this.physics,
          activeInput,
          this.cameraYaw,
          this.builtMap.colliders,
          this.builtMap.bounds,
          isSeeker ? 'normal' : this.localHiderRig.getSize(),
          isSeeker ? 'standing' : this.localPose,
          dt,
          seekerWaiting,
          speedMult,
        );
      } else {
        this.physics.speed = 0;
      }

      // If aiming as Seeker, smoothly orient character toward camera look direction
      if (isSeeker && this.aiming) {
        const aimYaw = this.cameraYaw + Math.PI;
        let diff = aimYaw - this.physics.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.physics.yaw += diff * Math.min(1, dt * 16);
      }

      // Animation State Selection
      if (!this.physics.grounded) {
        this.localAnim = 'jump';
      } else if (!this.wasGrounded && this.physics.grounded) {
        this.localAnim = 'land';
        soundEngine.playLand();
      } else if (isSeeker && this.shootAnimTimer > 0) {
        this.localAnim = 'shoot';
      } else if (isSeeker && this.reloadTimer > 0) {
        this.localAnim = 'reload';
      } else if (isSeeker && this.aiming && this.physics.speed < 0.25) {
        this.localAnim = 'aim';
      } else if (isSeeker && this.inspectTimer > 0 && this.physics.speed < 0.25) {
        this.localAnim = 'inspect';
      } else if (isSeeker && this.scannerActiveTimer > 0 && this.physics.speed < 0.25) {
        this.localAnim = 'search';
      } else if (this.physics.speed > 5.0) {
        this.localAnim = 'run';
      } else if (this.physics.speed > 0.25) {
        this.localAnim = activeInput.crouch && !isSeeker ? 'sneak' : 'walk';
      } else if (this.roomState?.phase === 'match_results') {
        const won =
          (this.roomState.winnerTeam === 'hiders' && localP?.team === 'hider') ||
          (this.roomState.winnerTeam === 'seekers' && localP?.team === 'seeker');
        this.localAnim = won ? 'victory' : 'defeat';
      } else if (activeInput.crouch) {
        this.localAnim = 'crouch';
      } else {
        this.localAnim = 'idle';
      }
      this.wasGrounded = this.physics.grounded;

      if (this.physics.grounded && this.physics.speed > 0.5) {
        this.footstepTimer -= dt;
        if (this.footstepTimer <= 0) {
          soundEngine.playFootstep(this.localAnim === 'run');
          this.footstepTimer = this.localAnim === 'run' ? 0.28 : 0.42;
        }
      }

      if (isSeeker) {
        this.localSeekerRig.group.position.copy(this.physics.position);
        this.localSeekerRig.group.rotation.y = this.physics.yaw;
        this.localSeekerRig.update(dt, this.localAnim, {
          aimPitch: -this.cameraPitch,
          crouching: activeInput.crouch,
          speedBoost: this.boostActiveTimer > 0,
          scanning: this.scannerActiveTimer > 0,
          currentYaw: this.physics.yaw,
          ammoRatio: this.ammo / this.maxAmmo,
        });
        this.emitSeekerHud(false);
      } else {
        this.localHiderRig.group.position.copy(this.physics.position);
        this.localHiderRig.group.rotation.y = this.physics.yaw;
        this.localHiderRig.update(dt, this.localAnim, this.localPose);
      }

      const camH =
        !isSeeker && this.paintStudioOpen
          ? 0.92
          : isSeeker && this.aiming
            ? 1.48
            : !isSeeker && this.localPose === 'lying'
              ? 0.45
              : 1.24;

      updateThirdPersonCamera(
        this.camera,
        this.physics.position,
        this.cameraYaw,
        this.cameraPitch,
        this.cameraDistance,
        camH,
        this.paintStudioOpen && !isSeeker ? [] : this.builtMap.paintableSurfaces,
        dt,
        isSeeker && this.aiming ? 0.52 : 0,
      );

      const now = performance.now();
      if (now - this.lastTransformSentAt > 50) {
        this.lastTransformSentAt = now;
        this.callbacks.onLocalTransform?.(
          this.getLocalPosition(),
          this.physics.yaw,
          this.localAnim,
          isSeeker ? -this.cameraPitch : undefined,
        );
      }
    }

    // Interpolate Remote Actors (both Hiders & Seekers)
    for (const actor of this.remoteActors.values()) {
      if (actor.speedBoostTimer > 0) actor.speedBoostTimer = Math.max(0, actor.speedBoostTimer - dt);
      if (actor.scannerTimer > 0) actor.scannerTimer = Math.max(0, actor.scannerTimer - dt);

      const activeGroup =
        actor.role === 'seeker' && actor.seekerRig
          ? actor.seekerRig.group
          : actor.hiderRig.group;

      activeGroup.position.lerp(actor.targetPos, 1 - Math.exp(-12 * dt));
      let diff = actor.targetYaw - activeGroup.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      activeGroup.rotation.y += diff * (1 - Math.exp(-12 * dt));

      if (actor.role === 'seeker' && actor.seekerRig) {
        actor.seekerRig.update(dt, actor.animation, {
          aimPitch: actor.targetAimPitch,
          crouching: actor.animation === 'crouch',
          speedBoost: actor.speedBoostTimer > 0,
          scanning: actor.scannerTimer > 0,
          currentYaw: activeGroup.rotation.y,
        });
      } else {
        actor.hiderRig.update(dt, actor.animation, actor.pose);
      }
    }

    for (const ca of this.cloneActors.values()) {
      ca.rig.update(dt, 'idle', ca.pose);
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      const t = Math.min(1, p.age / p.duration);
      p.mesh.position.lerpVectors(p.start, p.end, t);
      if (t >= 1) {
        if (!p.spawnedImpact) {
          p.spawnedImpact = true;
          this.spawnImpactSparks(p.end, p.colorHex, 10);
          this.spawnRingFX(p.end, p.colorHex, 1.5);
        }
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // Update Impact Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.age += dt;
      if (sp.age >= sp.maxAge) {
        this.scene.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        (sp.mesh.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
      } else {
        sp.vel.y -= 9.8 * dt;
        sp.mesh.position.addScaledVector(sp.vel, dt);
        (sp.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - sp.age / sp.maxAge;
      }
    }

    // Update FX rings
    for (let i = this.fxRings.length - 1; i >= 0; i--) {
      const fx = this.fxRings[i];
      fx.age += dt;
      const progress = fx.age / fx.maxAge;
      if (progress >= 1) {
        this.scene.remove(fx.mesh);
        fx.mesh.geometry.dispose();
        (fx.mesh.material as THREE.Material).dispose();
        this.fxRings.splice(i, 1);
      } else {
        fx.mesh.scale.setScalar(1 + progress * fx.maxScale);
        (fx.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
      }
    }

    this.callbacks.onSeekerTargetChange?.(this.findNearestCatchTarget());
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    this.localHiderRig.dispose();
    this.localSeekerRig.dispose();
    for (const actor of this.remoteActors.values()) {
      actor.hiderRig.dispose();
      actor.seekerRig?.dispose();
    }
    for (const ca of this.cloneActors.values()) ca.rig.dispose();
    if (this.builtMap) this.builtMap.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
