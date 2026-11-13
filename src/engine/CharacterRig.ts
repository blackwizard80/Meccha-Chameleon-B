import * as THREE from 'three';
import {
  AnimationState,
  BodyPartId,
  CharacterPose,
  CharacterShape,
  CharacterSize,
} from '../types/game';
import { ATLAS_SIZE, BODY_PART_REGIONS, CharacterPainter } from './CharacterPainter';
import { createContactShadowTexture } from './TextureGenerator';

/**
 * Remap a BufferGeometry's UVs into one of the 13 non-overlapping regions on the 512x512 atlas.
 */
function remapGeometryUV(geometry: THREE.BufferGeometry, part: BodyPartId): void {
  const region = BODY_PART_REGIONS[part];
  const u0 = region.x / ATLAS_SIZE;
  const u1 = (region.x + region.w) / ATLAS_SIZE;
  // Canvas Y=0 is top, Three.js UV V=1 is top
  const v1 = 1 - region.y / ATLAS_SIZE;
  const v0 = 1 - (region.y + region.h) / ATLAS_SIZE;

  const uv = geometry.attributes.uv;
  if (!uv) return;
  const pad = 0.004;
  for (let i = 0; i < uv.count; i++) {
    const u = THREE.MathUtils.clamp(uv.getX(i), 0, 1);
    const v = THREE.MathUtils.clamp(uv.getY(i), 0, 1);
    uv.setXY(
      i,
      THREE.MathUtils.lerp(u0 + pad, u1 - pad, u),
      THREE.MathUtils.lerp(v0 + pad, v1 - pad, v),
    );
  }
  uv.needsUpdate = true;
}

/**
 * Sculpt a human-shaped head profile using LatheGeometry (jawline, cheekbones, cranium)
 */
function createSculptedHeadGeometry(shape: CharacterShape): THREE.BufferGeometry {
  if (shape === 'cubic') {
    const geo = new THREE.BoxGeometry(0.34, 0.36, 0.34, 2, 2, 2);
    return geo;
  }
  const segs = shape === 'polygonal' ? 7 : 20;
  const bulge = shape === 'blobby' ? 1.16 : shape === 'macho' ? 0.96 : shape === 'octopus' ? 1.2 : 1.0;
  const points = [
    new THREE.Vector2(0.001, -0.17),
    new THREE.Vector2(0.085 * bulge, -0.155),
    new THREE.Vector2(0.145 * bulge, -0.09),
    new THREE.Vector2(0.175 * bulge, 0.0),
    new THREE.Vector2(0.182 * bulge, 0.09),
    new THREE.Vector2(0.145 * bulge, 0.165),
    new THREE.Vector2(0.07 * bulge, 0.205),
    new THREE.Vector2(0.001, 0.215),
  ];
  const geo = new THREE.LatheGeometry(points, segs);
  geo.scale(0.95, 1.0, 1.04);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted torso profile (front chest & rear back halves so Chest and Back are independently paintable!)
 */
function createTorsoHalfGeometry(
  shape: CharacterShape,
  isFront: boolean,
): THREE.BufferGeometry {
  const segs = shape === 'polygonal' ? 6 : 16;
  const shoulderW =
    shape === 'macho' ? 1.32 : shape === 'blobby' ? 1.15 : shape === 'octopus' ? 0.92 : 1.0;
  const waistW =
    shape === 'macho' ? 0.86 : shape === 'blobby' ? 1.24 : shape === 'octopus' ? 1.05 : 0.95;

  if (shape === 'cubic') {
    const w = 0.44 * shoulderW;
    const d = 0.13;
    const geo = new THREE.BoxGeometry(w, 0.52, d, 2, 2, 1);
    geo.translate(0, 0.26, isFront ? d * 0.5 : -d * 0.5);
    return geo;
  }

  // Half-lathe (phiStart = -PI/2 to +PI/2 for front +Z, PI/2 to 3PI/2 for back -Z)
  const phiStart = isFront ? -Math.PI / 2 : Math.PI / 2;
  const points = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.18 * waistW, 0.02),
    new THREE.Vector2(0.165 * waistW, 0.16),
    new THREE.Vector2(0.195 * shoulderW, 0.34),
    new THREE.Vector2(0.215 * shoulderW, 0.48),
    new THREE.Vector2(0.11, 0.54),
    new THREE.Vector2(0.001, 0.55),
  ];
  const geo = new THREE.LatheGeometry(points, segs, phiStart, Math.PI);
  geo.scale(1.12, 1.0, 0.72);
  geo.computeVertexNormals();
  return geo;
}

function createLimbSegmentGeometry(
  topR: number,
  botR: number,
  length: number,
  shape: CharacterShape,
): THREE.BufferGeometry {
  if (shape === 'cubic') {
    const avg = (topR + botR) * 0.95;
    const geo = new THREE.BoxGeometry(avg * 1.6, length, avg * 1.6);
    geo.translate(0, -length * 0.5, 0);
    return geo;
  }
  const segs = shape === 'polygonal' ? 6 : 14;
  const bulge = shape === 'blobby' ? 1.22 : shape === 'macho' ? 1.24 : 1.0;
  const geo = new THREE.CylinderGeometry(topR * bulge, botR * bulge, length, segs, 2);
  geo.translate(0, -length * 0.5, 0);
  return geo;
}

function createSculptedFootGeometry(shape: CharacterShape): THREE.BufferGeometry {
  if (shape === 'cubic') {
    const geo = new THREE.BoxGeometry(0.11, 0.075, 0.21);
    geo.translate(0, 0.0375, 0.045);
    return geo;
  }
  const segs = shape === 'polygonal' ? 5 : 12;
  const geo = new THREE.CylinderGeometry(0.052, 0.062, 0.19, segs, 1);
  geo.rotateX(Math.PI / 2);
  geo.scale(1.0, 0.68, 1.0);
  geo.translate(0, 0.038, 0.045);
  return geo;
}

export interface CharacterJoints {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  leftHand: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  rightHand: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  leftFoot: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  rightFoot: THREE.Group;
  eyes: [THREE.Group, THREE.Group];
  tentacles: THREE.Group[];
}

export class CharacterRig {
  public readonly group: THREE.Group;
  public readonly joints: CharacterJoints;
  public readonly painter: CharacterPainter;
  public readonly material: THREE.MeshStandardMaterial;
  public readonly paintableMeshes: THREE.Mesh[] = [];
  public readonly contactShadow: THREE.Mesh;

  private shape: CharacterShape = 'normal';
  private size: CharacterSize = 'normal';
  private animTime = 0;
  private blinkTimer = 2.4;
  private landPulse = 0;
  private prevAnim: AnimationState = 'idle';

  constructor(initialTextureDataUrl?: string | null) {
    this.group = new THREE.Group();
    this.painter = new CharacterPainter(initialTextureDataUrl);

    this.material = new THREE.MeshStandardMaterial({
      map: this.painter.texture,
      color: 0xffffff,
      roughness: 0.52,
      metalness: 0.04,
      flatShading: false,
    });

    // Soft radial contact shadow grounded at y=0.015
    const shadowGeo = new THREE.PlaneGeometry(0.95, 0.95);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.y = 0.015;
    this.group.add(this.contactShadow);

    this.joints = this.createEmptyJoints();
    this.group.add(this.joints.root);

    this.rebuildModel('normal', 'normal');
  }

  private createEmptyJoints(): CharacterJoints {
    return {
      root: new THREE.Group(),
      bodyPivot: new THREE.Group(),
      pelvis: new THREE.Group(),
      spine: new THREE.Group(),
      neck: new THREE.Group(),
      head: new THREE.Group(),
      leftShoulder: new THREE.Group(),
      leftElbow: new THREE.Group(),
      leftHand: new THREE.Group(),
      rightShoulder: new THREE.Group(),
      rightElbow: new THREE.Group(),
      rightHand: new THREE.Group(),
      leftHip: new THREE.Group(),
      leftKnee: new THREE.Group(),
      leftFoot: new THREE.Group(),
      rightHip: new THREE.Group(),
      rightKnee: new THREE.Group(),
      rightFoot: new THREE.Group(),
      eyes: [new THREE.Group(), new THREE.Group()],
      tentacles: [],
    };
  }

  public getShape(): CharacterShape {
    return this.shape;
  }

  public getSize(): CharacterSize {
    return this.size;
  }

  public rebuildModel(shape: CharacterShape, size: CharacterSize): void {
    this.shape = shape;
    this.size = size;

    // Dispose old meshes cleanly
    this.paintableMeshes.forEach((m) => m.geometry.dispose());
    this.paintableMeshes.length = 0;

    while (this.joints.root.children.length > 0) {
      this.joints.root.remove(this.joints.root.children[0]);
    }
    this.joints.tentacles = [];

    this.material.flatShading = shape === 'polygonal';
    this.material.needsUpdate = true;

    const addPartMesh = (
      geo: THREE.BufferGeometry,
      part: BodyPartId,
      parent: THREE.Object3D,
      pos: [number, number, number] = [0, 0, 0],
    ): THREE.Mesh => {
      remapGeometryUV(geo, part);
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.bodyPart = part;
      mesh.userData.isCharacterPart = true;
      parent.add(mesh);
      this.paintableMeshes.push(mesh);
      return mesh;
    };

    const j = this.joints;
    j.bodyPivot = new THREE.Group();
    j.pelvis = new THREE.Group();
    j.pelvis.position.set(0, 0.78, 0); // Hip height
    j.root.add(j.bodyPivot);
    j.bodyPivot.add(j.pelvis);

    // Spine & Torso (Chest + Back)
    j.spine = new THREE.Group();
    j.pelvis.add(j.spine);
    addPartMesh(createTorsoHalfGeometry(shape, true), 'chest', j.spine);
    addPartMesh(createTorsoHalfGeometry(shape, false), 'back', j.spine);

    // Neck
    j.neck = new THREE.Group();
    j.neck.position.set(0, 0.54, 0);
    j.spine.add(j.neck);
    const neckGeo = new THREE.CylinderGeometry(
      0.068,
      0.078,
      0.11,
      shape === 'polygonal' ? 6 : 12,
    );
    neckGeo.translate(0, 0.055, 0);
    addPartMesh(neckGeo, 'neck', j.neck);

    // Head + Visible Face Plate + 2 Expressive Eyes
    j.head = new THREE.Group();
    j.head.position.set(0, 0.25, 0);
    j.neck.add(j.head);
    addPartMesh(createSculptedHeadGeometry(shape), 'head', j.head);

    // Sculpted face mask sitting slightly proud on the front of the head
    const faceGeo =
      shape === 'cubic'
        ? new THREE.BoxGeometry(0.28, 0.26, 0.04)
        : new THREE.CylinderGeometry(0.165, 0.145, 0.25, shape === 'polygonal' ? 6 : 16, 1, false, -0.75, 1.5);
    const faceMesh = addPartMesh(faceGeo, 'face', j.head, [
      0,
      -0.015,
      shape === 'cubic' ? 0.16 : 0.025,
    ]);
    faceMesh.castShadow = false;

    // Subtle nose ridge on face
    const noseGeo = new THREE.ConeGeometry(0.026, 0.055, 6);
    noseGeo.rotateX(Math.PI * 0.42);
    addPartMesh(noseGeo, 'face', j.head, [0, -0.02, shape === 'cubic' ? 0.19 : 0.18]);

    // Expressive eyes (not overwritten by white paint, give unmistakable humanoid face)
    const eyeMatWhite = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.05,
    });
    const eyeMatPupil = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.15,
      metalness: 0.1,
    });
    const eyeZ = shape === 'cubic' ? 0.185 : 0.168;

    [-1, 1].forEach((side, idx) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.062, 0.032, eyeZ);

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), eyeMatWhite);
      sclera.scale.set(0.9, 1.1, 0.55);
      eyeGroup.add(sclera);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), eyeMatPupil);
      pupil.position.set(0, 0, 0.013);
      pupil.scale.set(0.95, 1.05, 0.55);
      eyeGroup.add(pupil);

      j.head.add(eyeGroup);
      j.eyes[idx] = eyeGroup;
    });

    // Arms & Hands with individual fingers
    const shoulderOffset = shape === 'macho' ? 0.29 : shape === 'blobby' ? 0.26 : 0.235;
    const buildArm = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const shoulder = isLeft ? j.leftShoulder : j.rightShoulder;
      const elbow = isLeft ? j.leftElbow : j.rightElbow;
      const hand = isLeft ? j.leftHand : j.rightHand;
      const armPart: BodyPartId = isLeft ? 'leftArm' : 'rightArm';
      const handPart: BodyPartId = isLeft ? 'leftHand' : 'rightHand';

      shoulder.position.set(sign * shoulderOffset, 0.46, 0);
      j.spine.add(shoulder);

      // Shoulder cap joint
      addPartMesh(
        new THREE.SphereGeometry(shape === 'macho' ? 0.072 : 0.055, 10, 8),
        armPart,
        shoulder,
      );
      addPartMesh(createLimbSegmentGeometry(0.052, 0.044, 0.24, shape), armPart, shoulder);

      elbow.position.set(0, -0.24, 0);
      shoulder.add(elbow);
      addPartMesh(createLimbSegmentGeometry(0.043, 0.036, 0.23, shape), armPart, elbow);

      hand.position.set(0, -0.24, 0);
      elbow.add(hand);

      // Palm
      const palmGeo = new THREE.BoxGeometry(0.068, 0.075, 0.036);
      palmGeo.translate(0, -0.032, 0);
      addPartMesh(palmGeo, handPart, hand);

      // 4 fingers + 1 thumb for recognizable hand silhouette
      for (let f = 0; f < 4; f++) {
        const fingerGeo = new THREE.CylinderGeometry(0.007, 0.006, 0.048, 6);
        fingerGeo.translate(0, -0.024, 0);
        const fx = (f - 1.5) * 0.016;
        addPartMesh(fingerGeo, handPart, hand, [fx, -0.068, 0]);
      }
      const thumbGeo = new THREE.CylinderGeometry(0.008, 0.007, 0.038, 6);
      thumbGeo.rotateZ(sign * -0.55);
      addPartMesh(thumbGeo, handPart, hand, [-sign * 0.038, -0.038, 0.012]);
    };

    buildArm(true);
    buildArm(false);

    // Legs & Feet
    const hipX = shape === 'blobby' ? 0.12 : 0.105;
    const buildLeg = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const hip = isLeft ? j.leftHip : j.rightHip;
      const knee = isLeft ? j.leftKnee : j.rightKnee;
      const foot = isLeft ? j.leftFoot : j.rightFoot;
      const legPart: BodyPartId = isLeft ? 'leftLeg' : 'rightLeg';
      const footPart: BodyPartId = isLeft ? 'leftFoot' : 'rightFoot';

      hip.position.set(sign * hipX, 0, 0);
      j.pelvis.add(hip);

      addPartMesh(createLimbSegmentGeometry(0.078, 0.062, 0.36, shape), legPart, hip);

      knee.position.set(0, -0.36, 0);
      hip.add(knee);
      addPartMesh(createLimbSegmentGeometry(0.06, 0.048, 0.35, shape), legPart, knee);

      foot.position.set(0, -0.36, 0);
      knee.add(foot);
      addPartMesh(createSculptedFootGeometry(shape), footPart, foot);
    };

    buildLeg(true);
    buildLeg(false);

    // Octopus-like extra side tentacles curling out from lower hips
    if (shape === 'octopus') {
      const angles = [-2.2, -1.1, 1.1, 2.2];
      angles.forEach((ang, idx) => {
        const tGroup = new THREE.Group();
        tGroup.position.set(Math.sin(ang) * 0.15, -0.06, Math.cos(ang) * 0.13);
        tGroup.rotation.y = ang;
        j.pelvis.add(tGroup);

        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, -0.18, 0.14),
          new THREE.Vector3(0, -0.38, 0.24),
          new THREE.Vector3(0, -0.52, 0.38),
        ]);
        const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.036, 8, false);
        addPartMesh(tubeGeo, idx % 2 === 0 ? 'leftLeg' : 'rightLeg', tGroup);
        j.tentacles.push(tGroup);
      });
    }

    // Apply Size scaling
    const scaleVec =
      size === 'petite'
        ? new THREE.Vector3(0.74, 0.74, 0.74)
        : size === 'plump'
          ? new THREE.Vector3(1.28, 1.06, 1.28)
          : new THREE.Vector3(1.0, 1.0, 1.0);
    j.root.scale.copy(scaleVec);
    this.contactShadow.scale.setScalar(size === 'petite' ? 0.75 : size === 'plump' ? 1.3 : 1.0);
  }

  /**
   * Smoothly blend skeletal joints toward the active animation & hiding pose.
   */
  public update(delta: number, animation: AnimationState, pose: CharacterPose): void {
    const dt = Math.min(delta, 0.05);
    this.animTime += dt;
    const t = this.animTime;

    if (animation === 'land' && this.prevAnim !== 'land') {
      this.landPulse = 0.22;
    }
    this.prevAnim = animation;
    this.landPulse = Math.max(0, this.landPulse - dt);

    // Natural eye blink
    this.blinkTimer -= dt;
    let eyeScaleY = 1;
    if (this.blinkTimer <= 0) {
      if (this.blinkTimer > -0.12) {
        eyeScaleY = 0.1;
      } else {
        this.blinkTimer = 2.5 + Math.random() * 2.5;
      }
    }
    this.joints.eyes.forEach((eg) => {
      eg.scale.y = THREE.MathUtils.damp(eg.scale.y, eyeScaleY, 24, dt);
    });

    // Target joint values
    let pelvisY = 0.78;
    let bodyPosY = 0;
    let bodyRotX = 0;
    let bodyRotZ = 0;
    let spineRotX = 0;
    let spineRotY = 0;
    let headRotX = 0;
    let headRotY = 0;
    let lArmX = 0;
    let lArmZ = 0.14;
    let lElbX = -0.12;
    let rArmX = 0;
    let rArmZ = -0.14;
    let rElbX = -0.12;
    let lHipX = 0;
    let lHipZ = 0;
    let lKneeX = 0;
    let rHipX = 0;
    let rHipZ = 0;
    let rKneeX = 0;

    // 1. Movement / Emotion Animations take precedence when moving/jumping/end-of-round
    if (animation === 'walk' || animation === 'run' || animation === 'sneak') {
      const freq = animation === 'run' ? 11.5 : animation === 'sneak' ? 5.0 : 7.5;
      const amp = animation === 'run' ? 0.85 : animation === 'sneak' ? 0.35 : 0.52;
      const phase = t * freq;

      if (animation === 'sneak') {
        pelvisY = 0.58 + Math.abs(Math.sin(phase)) * 0.03;
        spineRotX = 0.35;
        lHipX = Math.sin(phase) * amp - 0.35;
        rHipX = -Math.sin(phase) * amp - 0.35;
        lKneeX = 0.65;
        rKneeX = 0.65;
        lArmX = -Math.sin(phase) * 0.35 - 0.35;
        rArmX = Math.sin(phase) * 0.35 - 0.35;
        lElbX = -0.6;
        rElbX = -0.6;
      } else {
        pelvisY = 0.76 + Math.abs(Math.sin(phase)) * (animation === 'run' ? 0.075 : 0.035);
        spineRotX = animation === 'run' ? 0.22 : 0.06;
        lHipX = Math.sin(phase) * amp;
        rHipX = -Math.sin(phase) * amp;
        lKneeX = Math.max(0, -Math.sin(phase - 0.5) * (animation === 'run' ? 1.1 : 0.65));
        rKneeX = Math.max(0, Math.sin(phase - 0.5) * (animation === 'run' ? 1.1 : 0.65));
        lArmX = -Math.sin(phase) * amp * 0.9;
        rArmX = Math.sin(phase) * amp * 0.9;
        lElbX = animation === 'run' ? -1.1 : -0.35;
        rElbX = animation === 'run' ? -1.1 : -0.35;
      }
    } else if (animation === 'jump') {
      pelvisY = 0.82;
      lHipX = -0.45;
      lKneeX = 0.75;
      rHipX = -0.2;
      rKneeX = 0.4;
      lArmX = -2.2;
      rArmX = -2.2;
      lArmZ = 0.35;
      rArmZ = -0.35;
    } else if (animation === 'land' || this.landPulse > 0) {
      pelvisY = 0.62;
      spineRotX = 0.25;
      lHipX = -0.5;
      rHipX = -0.5;
      lKneeX = 0.95;
      rKneeX = 0.95;
      lArmX = 0.35;
      rArmX = 0.35;
    } else if (animation === 'victory') {
      pelvisY = 0.78 + Math.abs(Math.sin(t * 6)) * 0.14;
      lArmX = -2.6 + Math.sin(t * 8) * 0.25;
      rArmX = -2.6 - Math.sin(t * 8) * 0.25;
      lArmZ = 0.4;
      rArmZ = -0.4;
      headRotX = -0.15;
    } else if (animation === 'defeat') {
      pelvisY = 0.52;
      spineRotX = 0.45;
      headRotX = 0.4;
      lHipX = -0.9;
      rHipX = -0.9;
      lKneeX = 1.6;
      rKneeX = 1.6;
      lArmX = 0.4;
      rArmX = 0.4;
    } else if (animation === 'look') {
      headRotY = Math.sin(t * 2.2) * 0.65;
      spineRotY = Math.sin(t * 2.2) * 0.18;
      lArmX = -0.5;
      lElbX = -1.2;
    } else {
      // Stationary: apply the player's selected Hiding Pose!
      const breath = Math.sin(t * 2.1) * 0.015;
      switch (pose) {
        case 'crouching':
          pelvisY = 0.48 + breath;
          spineRotX = 0.38;
          lHipX = -0.95;
          rHipX = -0.95;
          lKneeX = 1.75;
          rKneeX = 1.75;
          lArmX = -0.35;
          rArmX = -0.35;
          lElbX = -0.8;
          rElbX = -0.8;
          break;
        case 'sitting':
          pelvisY = 0.22;
          spineRotX = 0.05 + breath;
          lHipX = -1.45;
          rHipX = -1.45;
          lHipZ = -0.12;
          rHipZ = 0.12;
          lKneeX = 0.2;
          rKneeX = 0.2;
          lArmX = -0.25;
          rArmX = -0.25;
          lElbX = -0.5;
          rElbX = -0.5;
          break;
        case 'lying':
          pelvisY = 0.18;
          bodyPosY = 0.0;
          bodyRotX = -Math.PI / 2;
          lArmZ = 0.08;
          rArmZ = -0.08;
          break;
        case 'curled':
          pelvisY = 0.24;
          bodyRotX = 0.25;
          spineRotX = 1.05;
          headRotX = 0.55;
          lHipX = -1.95;
          rHipX = -1.95;
          lKneeX = 2.2;
          rKneeX = 2.2;
          lArmX = -1.35;
          rArmX = -1.35;
          lElbX = -1.45;
          rElbX = -1.45;
          break;
        case 'leaning':
          pelvisY = 0.74;
          bodyRotX = -0.22;
          spineRotX = -0.05;
          lHipX = 0.18;
          rHipX = -0.12;
          lKneeX = 0.12;
          lArmZ = 0.28;
          rArmZ = -0.28;
          lElbX = -0.95;
          rElbX = -0.95;
          break;
        case 'statue':
          // Tucked vertical pillar/lamp camouflage pose
          pelvisY = 0.78;
          lArmX = -Math.PI + 0.08;
          rArmX = -Math.PI + 0.08;
          lArmZ = -0.06;
          rArmZ = 0.06;
          lElbX = 0;
          rElbX = 0;
          break;
        case 'standing':
        default:
          pelvisY = 0.78 + breath;
          lArmZ = 0.14 + breath * 0.5;
          rArmZ = -0.14 - breath * 0.5;
          headRotY = Math.sin(t * 0.8) * 0.08;
          break;
      }
    }

    const dampSpeed = 14;
    const j = this.joints;
    j.pelvis.position.y = THREE.MathUtils.damp(j.pelvis.position.y, pelvisY, dampSpeed, dt);
    j.bodyPivot.position.y = THREE.MathUtils.damp(j.bodyPivot.position.y, bodyPosY, dampSpeed, dt);
    j.bodyPivot.rotation.x = THREE.MathUtils.damp(j.bodyPivot.rotation.x, bodyRotX, dampSpeed, dt);
    j.bodyPivot.rotation.z = THREE.MathUtils.damp(j.bodyPivot.rotation.z, bodyRotZ, dampSpeed, dt);
    j.spine.rotation.x = THREE.MathUtils.damp(j.spine.rotation.x, spineRotX, dampSpeed, dt);
    j.spine.rotation.y = THREE.MathUtils.damp(j.spine.rotation.y, spineRotY, dampSpeed, dt);
    j.head.rotation.x = THREE.MathUtils.damp(j.head.rotation.x, headRotX, dampSpeed, dt);
    j.head.rotation.y = THREE.MathUtils.damp(j.head.rotation.y, headRotY, dampSpeed, dt);

    j.leftShoulder.rotation.x = THREE.MathUtils.damp(j.leftShoulder.rotation.x, lArmX, dampSpeed, dt);
    j.leftShoulder.rotation.z = THREE.MathUtils.damp(j.leftShoulder.rotation.z, lArmZ, dampSpeed, dt);
    j.leftElbow.rotation.x = THREE.MathUtils.damp(j.leftElbow.rotation.x, lElbX, dampSpeed, dt);

    j.rightShoulder.rotation.x = THREE.MathUtils.damp(j.rightShoulder.rotation.x, rArmX, dampSpeed, dt);
    j.rightShoulder.rotation.z = THREE.MathUtils.damp(j.rightShoulder.rotation.z, rArmZ, dampSpeed, dt);
    j.rightElbow.rotation.x = THREE.MathUtils.damp(j.rightElbow.rotation.x, rElbX, dampSpeed, dt);

    j.leftHip.rotation.x = THREE.MathUtils.damp(j.leftHip.rotation.x, lHipX, dampSpeed, dt);
    j.leftHip.rotation.z = THREE.MathUtils.damp(j.leftHip.rotation.z, lHipZ, dampSpeed, dt);
    j.leftKnee.rotation.x = THREE.MathUtils.damp(j.leftKnee.rotation.x, lKneeX, dampSpeed, dt);

    j.rightHip.rotation.x = THREE.MathUtils.damp(j.rightHip.rotation.x, rHipX, dampSpeed, dt);
    j.rightHip.rotation.z = THREE.MathUtils.damp(j.rightHip.rotation.z, rHipZ, dampSpeed, dt);
    j.rightKnee.rotation.x = THREE.MathUtils.damp(j.rightKnee.rotation.x, rKneeX, dampSpeed, dt);

    // Subtle octopus tentacle sway
    j.tentacles.forEach((ten, idx) => {
      ten.rotation.x = Math.sin(t * 2.5 + idx) * 0.14;
    });
  }

  public dispose(): void {
    this.paintableMeshes.forEach((m) => m.geometry.dispose());
    this.material.dispose();
    this.painter.dispose();
    this.contactShadow.geometry.dispose();
    (this.contactShadow.material as THREE.Material).dispose();
  }
}
