import * as THREE from 'three';
import { AnimationState, SeekerTheme } from '../types/game';
import { getSeekerEnergyColors, SeekerBlaster } from './SeekerBlaster';
import { createContactShadowTexture } from './TextureGenerator';

function createTacticalFabricTexture(baseHex: string, seamHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  // Diagonal tactical ripstop weave
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = -128; i < 256; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.stroke();
  }
  // Vertical stitching seam
  ctx.strokeStyle = seamHex;
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(64, 128);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createShoulderBadgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(32, 8);
  ctx.lineTo(54, 22);
  ctx.lineTo(48, 52);
  ctx.lineTo(32, 58);
  ctx.lineTo(16, 52);
  ctx.lineTo(10, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.arc(32, 33, 10, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SeekerRig {
  public readonly group = new THREE.Group();
  public readonly blaster: SeekerBlaster;
  public readonly contactShadow: THREE.Mesh;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  private readonly bodyRoot = new THREE.Group();
  private readonly pelvis = new THREE.Group();
  private readonly spine = new THREE.Group();
  private readonly neck = new THREE.Group();
  private readonly head = new THREE.Group();

  private readonly leftShoulder = new THREE.Group();
  private readonly leftElbow = new THREE.Group();
  private readonly leftHand = new THREE.Group();

  private readonly rightShoulder = new THREE.Group();
  private readonly rightElbow = new THREE.Group();
  private readonly rightHand = new THREE.Group();
  private readonly weaponMount = new THREE.Group();

  private readonly leftHip = new THREE.Group();
  private readonly leftKnee = new THREE.Group();
  private readonly leftFoot = new THREE.Group();

  private readonly rightHip = new THREE.Group();
  private readonly rightKnee = new THREE.Group();
  private readonly rightFoot = new THREE.Group();

  private readonly flashlightCone: THREE.Mesh;
  private readonly thrusterJets: THREE.Mesh[] = [];
  private readonly energyMat: THREE.MeshStandardMaterial;
  private readonly visorMat: THREE.MeshStandardMaterial;

  private animTime = 0;
  private shootPulse = 0;
  private reloadTimer = 0;
  private reloadDuration = 1.6;
  private prevYaw = 0;

  constructor(theme: SeekerTheme = 'cyan') {
    const colors = getSeekerEnergyColors(theme);

    // Stylized PBR Color Palette: Dark Navy, White, Metallic Grey, Orange, Glowing Cyan
    const trouserTex = this.trackTex(createTacticalFabricTexture('#111d38', '#334155'));
    const jacketTex = this.trackTex(createTacticalFabricTexture('#172554', '#0f172a'));
    const badgeTex = this.trackTex(createShoulderBadgeTexture());

    const navyJacketMat = this.trackMat(
      new THREE.MeshStandardMaterial({ map: jacketTex, roughness: 0.58, metalness: 0.12 }),
    );
    const navyTrouserMat = this.trackMat(
      new THREE.MeshStandardMaterial({ map: trouserTex, roughness: 0.72, metalness: 0.06 }),
    );
    const whiteArmorMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.2 }),
    );
    const metalMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.28, metalness: 0.82 }),
    );
    const darkMetalMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.65 }),
    );
    const orangeMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.38, metalness: 0.18 }),
    );
    const gloveBootMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.15 }),
    );
    const badgeMat = this.trackMat(
      new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.35, metalness: 0.2 }),
    );

    this.energyMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: colors.primary,
        emissive: colors.emissive,
        emissiveIntensity: 1.6,
        roughness: 0.15,
      }),
    );

    this.visorMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: colors.emissive,
        emissiveIntensity: 0.25,
        roughness: 0.08,
        metalness: 0.25,
        transparent: true,
        opacity: 0.52,
      }),
    );

    // Contact shadow
    const shadowTex = this.trackTex(createContactShadowTexture());
    const shadowMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      }),
    );
    this.contactShadow = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(1.1, 1.1)), shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.015;
    this.group.add(this.contactShadow);

    this.group.add(this.bodyRoot);
    this.pelvis.position.set(0, 0.84, 0);
    this.bodyRoot.add(this.pelvis);

    const addPart = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      parent: THREE.Object3D,
      pos: [number, number, number] = [0, 0, 0],
      rot: [number, number, number] = [0, 0, 0],
    ) => {
      this.trackGeo(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // === PELVIS, UTILITY BELT & SIDE POUCHES ===
    addPart(new THREE.BoxGeometry(0.36, 0.14, 0.24), navyTrouserMat, this.pelvis, [0, 0.04, 0]);
    // Heavy Utility Belt
    addPart(new THREE.BoxGeometry(0.39, 0.075, 0.265), darkMetalMat, this.pelvis, [0, 0.09, 0]);
    addPart(new THREE.BoxGeometry(0.1, 0.068, 0.03), metalMat, this.pelvis, [0, 0.09, 0.135]);
    addPart(new THREE.BoxGeometry(0.04, 0.025, 0.035), this.energyMat, this.pelvis, [0, 0.09, 0.14]);
    // Side Equipment Pouches
    addPart(new THREE.BoxGeometry(0.08, 0.11, 0.12), gloveBootMat, this.pelvis, [-0.21, 0.06, 0.01]);
    addPart(new THREE.BoxGeometry(0.08, 0.11, 0.12), gloveBootMat, this.pelvis, [0.21, 0.06, 0.01]);
    addPart(new THREE.BoxGeometry(0.085, 0.02, 0.125), orangeMat, this.pelvis, [-0.21, 0.105, 0.01]);

    // === UPPER BODY: TACTICAL JACKET, CHEST ARMOR, BACKPACK & FLASHLIGHT ===
    this.spine.position.set(0, 0.11, 0);
    this.pelvis.add(this.spine);

    // Tapered jacket torso
    const torsoPts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.185, 0.02),
      new THREE.Vector2(0.178, 0.18),
      new THREE.Vector2(0.225, 0.36),
      new THREE.Vector2(0.235, 0.48),
      new THREE.Vector2(0.12, 0.54),
      new THREE.Vector2(0.001, 0.55),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPts, 16);
    torsoGeo.scale(1.08, 1.0, 0.72);
    addPart(torsoGeo, navyJacketMat, this.spine);

    // Jacket collar
    addPart(new THREE.CylinderGeometry(0.115, 0.125, 0.08, 14, 1, true), whiteArmorMat, this.spine, [0, 0.53, 0]);

    // Front Chest Armor Plate + Glowing Cyan Core + Straps
    addPart(new THREE.BoxGeometry(0.36, 0.28, 0.08), whiteArmorMat, this.spine, [0, 0.34, 0.14]);
    addPart(new THREE.BoxGeometry(0.26, 0.18, 0.03), metalMat, this.spine, [0, 0.34, 0.175]);
    addPart(new THREE.BoxGeometry(0.14, 0.032, 0.02), this.energyMat, this.spine, [0, 0.36, 0.19]);
    addPart(new THREE.BoxGeometry(0.045, 0.32, 0.025), orangeMat, this.spine, [-0.11, 0.31, 0.165], [0, 0, -0.14]);
    addPart(new THREE.BoxGeometry(0.045, 0.32, 0.025), orangeMat, this.spine, [0.11, 0.31, 0.165], [0, 0, 0.14]);

    // Shoulder-Mounted Small Flashlight + Subtle Cone Beam
    addPart(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 10), metalMat, this.spine, [-0.17, 0.49, 0.11], [Math.PI / 2, 0, 0]);
    addPart(new THREE.CylinderGeometry(0.02, 0.02, 0.015, 10), this.energyMat, this.spine, [-0.17, 0.49, 0.16], [Math.PI / 2, 0, 0]);
    const coneGeo = new THREE.ConeGeometry(0.45, 1.8, 14, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    coneGeo.translate(0, 0, 0.9);
    const coneMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: colors.primary,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.flashlightCone = new THREE.Mesh(this.trackGeo(coneGeo), coneMat);
    this.flashlightCone.position.set(-0.17, 0.49, 0.17);
    this.spine.add(this.flashlightCone);

    // Shoulder Radio Comms Mic
    addPart(new THREE.BoxGeometry(0.045, 0.06, 0.035), darkMetalMat, this.spine, [0.17, 0.48, 0.12]);

    // Futuristic Backpack + Dual Energy Canisters + Radio Antenna + Thruster Jets
    const pack = new THREE.Group();
    pack.position.set(0, 0.31, -0.185);
    this.spine.add(pack);
    addPart(new THREE.BoxGeometry(0.3, 0.36, 0.14), darkMetalMat, pack);
    addPart(new THREE.BoxGeometry(0.24, 0.22, 0.04), whiteArmorMat, pack, [0, 0.04, -0.06]);
    addPart(new THREE.CylinderGeometry(0.038, 0.038, 0.28, 10), metalMat, pack, [-0.1, 0, -0.05]);
    addPart(new THREE.CylinderGeometry(0.038, 0.038, 0.28, 10), metalMat, pack, [0.1, 0, -0.05]);
    addPart(new THREE.BoxGeometry(0.035, 0.18, 0.03), this.energyMat, pack, [0, 0.03, -0.085]);
    addPart(new THREE.BoxGeometry(0.26, 0.025, 0.03), orangeMat, pack, [0, -0.12, -0.065]);
    // Backpack Radio Antenna
    addPart(new THREE.CylinderGeometry(0.008, 0.012, 0.34, 6), metalMat, pack, [0.12, 0.3, -0.02]);
    addPart(new THREE.SphereGeometry(0.018, 8, 8), this.energyMat, pack, [0.12, 0.47, -0.02]);
    // Speed Boost Jet Cones
    [-0.1, 0.1].forEach((tx) => {
      const jGeo = new THREE.ConeGeometry(0.045, 0.24, 8);
      jGeo.rotateX(Math.PI);
      const jMat = this.trackMat(
        new THREE.MeshBasicMaterial({
          color: colors.primary,
          transparent: true,
          opacity: 0.85,
        }),
      );
      const jet = new THREE.Mesh(this.trackGeo(jGeo), jMat);
      jet.position.set(tx, -0.24, -0.04);
      jet.visible = false;
      pack.add(jet);
      this.thrusterJets.push(jet);
    });

    // === NECK, HEAD & FUTURISTIC TACTICAL HELMET ===
    this.neck.position.set(0, 0.54, 0);
    this.spine.add(this.neck);
    addPart(new THREE.CylinderGeometry(0.068, 0.078, 0.1, 12), gloveBootMat, this.neck, [0, 0.04, 0]);

    this.head.position.set(0, 0.22, 0);
    this.neck.add(this.head);

    // Sculpted Helmet Dome (Navy + White Top Crown + Metallic Cheek Panels)
    const helmPts = [
      new THREE.Vector2(0.001, -0.15),
      new THREE.Vector2(0.145, -0.14),
      new THREE.Vector2(0.195, -0.05),
      new THREE.Vector2(0.205, 0.06),
      new THREE.Vector2(0.175, 0.16),
      new THREE.Vector2(0.09, 0.22),
      new THREE.Vector2(0.001, 0.23),
    ];
    addPart(new THREE.LatheGeometry(helmPts, 18), navyJacketMat, this.head);
    // White Helmet Crest & Cheek Armor
    addPart(new THREE.BoxGeometry(0.12, 0.12, 0.32), whiteArmorMat, this.head, [0, 0.15, -0.02]);
    addPart(new THREE.BoxGeometry(0.06, 0.025, 0.14), orangeMat, this.head, [0, 0.215, -0.05]);
    addPart(new THREE.BoxGeometry(0.05, 0.13, 0.16), whiteArmorMat, this.head, [-0.18, -0.03, 0.02]);
    addPart(new THREE.BoxGeometry(0.05, 0.13, 0.16), whiteArmorMat, this.head, [0.18, -0.03, 0.02]);

    // Protective Face Mask / Respirator
    addPart(new THREE.BoxGeometry(0.18, 0.11, 0.1), darkMetalMat, this.head, [0, -0.09, 0.145]);
    addPart(new THREE.BoxGeometry(0.11, 0.05, 0.04), metalMat, this.head, [0, -0.095, 0.19]);

    // Glowing Cyan Eye Lenses (visible behind the large translucent glass visor!)
    addPart(new THREE.BoxGeometry(0.058, 0.03, 0.03), this.energyMat, this.head, [-0.065, 0.025, 0.165], [0, 0, -0.12]);
    addPart(new THREE.BoxGeometry(0.058, 0.03, 0.03), this.energyMat, this.head, [0.065, 0.025, 0.165], [0, 0, 0.12]);

    // Large Curved Transparent Glass Visor
    const visorGeo = new THREE.CylinderGeometry(0.205, 0.198, 0.165, 20, 1, true, -Math.PI * 0.42, Math.PI * 0.84);
    const visor = addPart(visorGeo, this.visorMat, this.head, [0, 0.02, 0.015]);
    visor.castShadow = false;

    // Helmet Side Comms Pods + Small Antenna
    addPart(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 12), metalMat, this.head, [-0.21, 0.01, -0.01], [0, 0, Math.PI / 2]);
    addPart(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 12), metalMat, this.head, [0.21, 0.01, -0.01], [0, 0, Math.PI / 2]);
    addPart(new THREE.CylinderGeometry(0.028, 0.028, 0.055, 10), this.energyMat, this.head, [-0.215, 0.01, -0.01], [0, 0, Math.PI / 2]);
    addPart(new THREE.CylinderGeometry(0.028, 0.028, 0.055, 10), this.energyMat, this.head, [0.215, 0.01, -0.01], [0, 0, Math.PI / 2]);
    addPart(new THREE.CylinderGeometry(0.006, 0.01, 0.18, 6), metalMat, this.head, [-0.22, 0.13, -0.02]);
    addPart(new THREE.SphereGeometry(0.014, 8, 8), orangeMat, this.head, [-0.22, 0.22, -0.02]);

    // === ARMS, SHOULDER ARMOR, BADGES, GLOVES & WEAPON MOUNT ===
    const buildArm = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const shoulder = isLeft ? this.leftShoulder : this.rightShoulder;
      const elbow = isLeft ? this.leftElbow : this.rightElbow;
      const hand = isLeft ? this.leftHand : this.rightHand;

      shoulder.position.set(sign * 0.275, 0.46, 0);
      this.spine.add(shoulder);

      // Shoulder Pauldron Armor + Orange Insignia Badge
      addPart(new THREE.BoxGeometry(0.14, 0.14, 0.18), whiteArmorMat, shoulder, [sign * 0.02, 0.02, 0]);
      addPart(new THREE.BoxGeometry(0.145, 0.03, 0.185), orangeMat, shoulder, [sign * 0.02, 0.06, 0]);
      addPart(new THREE.BoxGeometry(0.015, 0.075, 0.075), badgeMat, shoulder, [sign * 0.092, 0.01, 0]);

      // Upper Sleeve
      addPart(new THREE.CylinderGeometry(0.058, 0.05, 0.24, 12), navyJacketMat, shoulder, [0, -0.12, 0]);

      // Elbow & Armored Forearm Guard
      elbow.position.set(0, -0.24, 0);
      shoulder.add(elbow);
      addPart(new THREE.CylinderGeometry(0.052, 0.044, 0.22, 12), metalMat, elbow, [0, -0.11, 0]);
      addPart(new THREE.BoxGeometry(0.075, 0.16, 0.085), whiteArmorMat, elbow, [0, -0.11, 0.015]);
      addPart(new THREE.BoxGeometry(0.02, 0.1, 0.02), this.energyMat, elbow, [sign * 0.042, -0.11, 0.02]);

      // Tactical Glove + Fingers
      hand.position.set(0, -0.23, 0);
      elbow.add(hand);
      addPart(new THREE.BoxGeometry(0.072, 0.08, 0.055), gloveBootMat, hand, [0, -0.03, 0]);
      for (let f = 0; f < 4; f++) {
        addPart(
          new THREE.BoxGeometry(0.014, 0.045, 0.016),
          gloveBootMat,
          hand,
          [(f - 1.5) * 0.016, -0.075, 0.01],
        );
      }

      if (!isLeft) {
        this.weaponMount.position.set(0, -0.04, 0.035);
        hand.add(this.weaponMount);
      }
    };

    buildArm(true);
    buildArm(false);

    // Attach 3D Futuristic Blaster to Right Hand Weapon Mount
    this.blaster = new SeekerBlaster(theme);
    this.weaponMount.add(this.blaster.group);

    // === LEGS, KNEE PADS & TACTICAL BOOTS ===
    const buildLeg = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const hip = isLeft ? this.leftHip : this.rightHip;
      const knee = isLeft ? this.leftKnee : this.rightKnee;
      const foot = isLeft ? this.leftFoot : this.rightFoot;

      hip.position.set(sign * 0.115, 0, 0);
      this.pelvis.add(hip);

      // Thigh + Holster Strap
      addPart(new THREE.CylinderGeometry(0.086, 0.068, 0.38, 12), navyTrouserMat, hip, [0, -0.19, 0]);
      if (!isLeft) {
        addPart(new THREE.CylinderGeometry(0.089, 0.085, 0.05, 12), darkMetalMat, hip, [0, -0.16, 0]);
        addPart(new THREE.BoxGeometry(0.05, 0.12, 0.08), gloveBootMat, hip, [0.08, -0.16, 0]);
      }

      // Knee Pad + Shin
      knee.position.set(0, -0.38, 0);
      hip.add(knee);
      addPart(new THREE.BoxGeometry(0.11, 0.11, 0.06), whiteArmorMat, knee, [0, 0.0, 0.058]);
      addPart(new THREE.BoxGeometry(0.08, 0.03, 0.02), orangeMat, knee, [0, 0.04, 0.085]);
      addPart(new THREE.CylinderGeometry(0.066, 0.054, 0.36, 12), navyTrouserMat, knee, [0, -0.18, 0]);
      // Armored shin plate
      addPart(new THREE.BoxGeometry(0.095, 0.24, 0.055), darkMetalMat, knee, [0, -0.2, 0.045]);

      // Tactical Boot
      foot.position.set(0, -0.36, 0);
      knee.add(foot);
      addPart(new THREE.BoxGeometry(0.12, 0.095, 0.24), gloveBootMat, foot, [0, -0.048, 0.045]);
      addPart(new THREE.BoxGeometry(0.126, 0.025, 0.25), darkMetalMat, foot, [0, -0.085, 0.045]);
      addPart(new THREE.BoxGeometry(0.122, 0.02, 0.08), whiteArmorMat, foot, [0, -0.045, 0.13]);
    };

    buildLeg(true);
    buildLeg(false);
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  private trackTex<T extends THREE.Texture>(t: T): T {
    this.textures.push(t);
    return t;
  }

  public setTheme(theme: SeekerTheme): void {
    const c = getSeekerEnergyColors(theme);
    this.energyMat.color.setHex(c.primary);
    this.energyMat.emissive.setHex(c.emissive);
    this.visorMat.emissive.setHex(c.emissive);
    this.blaster.setTheme(theme);
  }

  public triggerShoot(): void {
    this.shootPulse = 0.22;
    this.blaster.triggerFireFX();
  }

  public triggerReload(duration = 1.6): void {
    this.reloadDuration = duration;
    this.reloadTimer = duration;
  }

  public update(
    delta: number,
    animation: AnimationState,
    options: {
      aimPitch?: number;
      crouching?: boolean;
      speedBoost?: boolean;
      scanning?: boolean;
      currentYaw?: number;
      ammoRatio?: number;
    } = {},
  ): void {
    const dt = Math.min(delta, 0.05);
    this.animTime += dt;
    const t = this.animTime;

    if (this.shootPulse > 0) this.shootPulse = Math.max(0, this.shootPulse - dt);
    if (this.reloadTimer > 0) this.reloadTimer = Math.max(0, this.reloadTimer - dt);

    const isReloading = animation === 'reload' || this.reloadTimer > 0;
    const reloadProgress = isReloading
      ? 1 - this.reloadTimer / Math.max(0.1, this.reloadDuration)
      : 0;

    this.blaster.update(dt, {
      reloading: isReloading,
      reloadProgress,
      ammoRatio: options.ammoRatio ?? 1,
    });

    // Jetpack thruster cones visible during Speed Boost
    this.thrusterJets.forEach((jet, i) => {
      jet.visible = Boolean(options.speedBoost);
      if (jet.visible) {
        jet.scale.y = 0.85 + Math.sin(t * 28 + i) * 0.28;
      }
    });

    // Flashlight cone intensifies during scanning or search
    const coneMat = this.flashlightCone.material as THREE.MeshBasicMaterial;
    coneMat.opacity = options.scanning ? 0.22 : animation === 'search' ? 0.14 : 0.06;

    // Turning tilt banking
    const yaw = options.currentYaw ?? this.group.rotation.y;
    const yawRate = THREE.MathUtils.clamp((yaw - this.prevYaw) / Math.max(0.008, dt), -5, 5);
    this.prevYaw = yaw;

    const aimPitch = options.aimPitch ?? 0;

    // Target joint angles
    let pelvisY = 0.84;
    let bodyTiltZ = -yawRate * 0.035;
    let spineX = 0;
    let spineY = 0;
    let headX = 0;
    let headY = 0;

    // Right arm (holds blaster)
    let rShX = -0.68;
    let rShY = 0.18;
    let rShZ = -0.15;
    let rElbX = -0.82;
    let wpnRotX = 0.92;
    let wpnRotY = 0.18;
    let wpnRotZ = 0;

    // Left arm (supports blaster grip / animations)
    let lShX = -0.78;
    let lShY = -0.45;
    let lShZ = 0.18;
    let lElbX = -0.95;

    // Legs
    let lHipX = 0;
    let lKneeX = 0;
    let rHipX = 0;
    let rKneeX = 0;

    const crouching = Boolean(options.crouching || animation === 'crouch');
    if (crouching) {
      pelvisY = 0.56;
      spineX = 0.28;
      lHipX = -0.82;
      rHipX = -0.82;
      lKneeX = 1.48;
      rKneeX = 1.48;
    }

    if (animation === 'walk' || animation === 'run') {
      const freq = animation === 'run' ? 11.0 : 7.2;
      const amp = animation === 'run' ? 0.82 : 0.48;
      const phase = t * freq;
      pelvisY = (crouching ? 0.55 : 0.82) + Math.abs(Math.sin(phase)) * (animation === 'run' ? 0.065 : 0.03);
      spineX += animation === 'run' ? 0.2 : 0.06;
      lHipX += Math.sin(phase) * amp;
      rHipX += -Math.sin(phase) * amp;
      lKneeX += Math.max(0, -Math.sin(phase - 0.5) * (animation === 'run' ? 1.05 : 0.6));
      rKneeX += Math.max(0, Math.sin(phase - 0.5) * (animation === 'run' ? 1.05 : 0.6));

      if (animation === 'run') {
        // Tactical across-chest sprint grip
        rShX = -0.85;
        rShY = 0.48;
        rElbX = -1.1;
        lShX = -0.7;
        lShY = -0.55;
        wpnRotY = 0.65;
      } else {
        rShX += Math.sin(phase) * 0.06;
        lShX += -Math.sin(phase) * 0.06;
      }
    } else if (animation === 'jump') {
      pelvisY = 0.88;
      lHipX = -0.45;
      lKneeX = 0.78;
      rHipX = -0.18;
      rKneeX = 0.42;
    } else if (animation === 'land') {
      pelvisY = 0.66;
      spineX = 0.22;
      lHipX = -0.52;
      rHipX = -0.52;
      lKneeX = 1.0;
      rKneeX = 1.0;
    } else if (animation === 'aim' || animation === 'shoot' || this.shootPulse > 0) {
      // Weapon raised cleanly to eye-level sight!
      spineY = 0.28;
      headY = -0.24;
      rShX = -1.42 + aimPitch * 0.75;
      rShY = 0.08;
      rShZ = -0.05;
      rElbX = -0.28;
      wpnRotX = 0.12;
      wpnRotY = -0.06;
      lShX = -1.36 + aimPitch * 0.75;
      lShY = -0.56;
      lShZ = 0.12;
      lElbX = -0.58;

      if (this.shootPulse > 0) {
        const kick = (this.shootPulse / 0.22) * 0.22;
        rShX -= kick;
        lShX -= kick * 0.7;
        spineX -= kick * 0.35;
      }
    } else if (isReloading) {
      spineX += 0.14;
      headX = 0.25;
      rShX = -0.95;
      rShY = 0.35;
      rElbX = -0.75;
      wpnRotX = 0.55;
      wpnRotZ = 0.45;
      // Left hand drops & slams magazine back in
      const slap = Math.sin(reloadProgress * Math.PI * 2);
      lShX = -0.82 + slap * 0.22;
      lShY = -0.48;
      lElbX = -1.1 + slap * 0.35;
    } else if (animation === 'inspect') {
      // Weapon inspection showcase animation
      spineY = 0.18;
      headX = 0.16;
      headY = -0.15;
      rShX = -1.18;
      rShY = 0.36;
      rElbX = -0.88;
      wpnRotX = 0.45 + Math.sin(t * 2.2) * 0.25;
      wpnRotY = 0.55 + Math.cos(t * 1.8) * 0.35;
      wpnRotZ = Math.sin(t * 2.2) * 0.4;
      lShX = -0.52;
      lShZ = 0.28;
      lElbX = -0.45;
    } else if (animation === 'search' || animation === 'look' || options.scanning) {
      // Sweeping scan left-right looking for hidden chameleons
      const sweep = Math.sin(t * 2.4);
      spineY = sweep * 0.35;
      headY = sweep * 0.45;
      rShX = -1.15;
      rElbX = -0.55;
      wpnRotX = 0.28;
      lShX = -1.1;
      lShY = -0.4;
      lElbX = -0.65;
    } else if (animation === 'victory') {
      pelvisY = 0.84 + Math.abs(Math.sin(t * 6)) * 0.12;
      rShX = -2.55;
      rElbX = -0.25;
      wpnRotX = 0.3;
      lShX = -2.45 + Math.sin(t * 8) * 0.25;
      lShZ = 0.35;
      lElbX = -0.2;
    } else if (animation === 'defeat') {
      pelvisY = 0.68;
      spineX = 0.38;
      headX = 0.35;
      rShX = -0.25;
      rElbX = -0.3;
      wpnRotX = 1.2;
      lShX = -0.2;
      lElbX = -0.3;
    } else {
      // Tactical Idle breathing
      const breath = Math.sin(t * 2.0) * 0.02;
      pelvisY += breath * 0.4;
      rShX += breath;
      lShX += breath;
      headY = Math.sin(t * 0.85) * 0.14;
    }

    const d = 14;
    this.pelvis.position.y = THREE.MathUtils.damp(this.pelvis.position.y, pelvisY, d, dt);
    this.bodyRoot.rotation.z = THREE.MathUtils.damp(this.bodyRoot.rotation.z, bodyTiltZ, d, dt);
    this.spine.rotation.x = THREE.MathUtils.damp(this.spine.rotation.x, spineX, d, dt);
    this.spine.rotation.y = THREE.MathUtils.damp(this.spine.rotation.y, spineY, d, dt);
    this.head.rotation.x = THREE.MathUtils.damp(this.head.rotation.x, headX, d, dt);
    this.head.rotation.y = THREE.MathUtils.damp(this.head.rotation.y, headY, d, dt);

    this.rightShoulder.rotation.set(
      THREE.MathUtils.damp(this.rightShoulder.rotation.x, rShX, d, dt),
      THREE.MathUtils.damp(this.rightShoulder.rotation.y, rShY, d, dt),
      THREE.MathUtils.damp(this.rightShoulder.rotation.z, rShZ, d, dt),
    );
    this.rightElbow.rotation.x = THREE.MathUtils.damp(this.rightElbow.rotation.x, rElbX, d, dt);

    this.weaponMount.rotation.set(
      THREE.MathUtils.damp(this.weaponMount.rotation.x, wpnRotX, d, dt),
      THREE.MathUtils.damp(this.weaponMount.rotation.y, wpnRotY, d, dt),
      THREE.MathUtils.damp(this.weaponMount.rotation.z, wpnRotZ, d, dt),
    );

    this.leftShoulder.rotation.set(
      THREE.MathUtils.damp(this.leftShoulder.rotation.x, lShX, d, dt),
      THREE.MathUtils.damp(this.leftShoulder.rotation.y, lShY, d, dt),
      THREE.MathUtils.damp(this.leftShoulder.rotation.z, lShZ, d, dt),
    );
    this.leftElbow.rotation.x = THREE.MathUtils.damp(this.leftElbow.rotation.x, lElbX, d, dt);

    this.leftHip.rotation.x = THREE.MathUtils.damp(this.leftHip.rotation.x, lHipX, d, dt);
    this.leftKnee.rotation.x = THREE.MathUtils.damp(this.leftKnee.rotation.x, lKneeX, d, dt);
    this.rightHip.rotation.x = THREE.MathUtils.damp(this.rightHip.rotation.x, rHipX, d, dt);
    this.rightKnee.rotation.x = THREE.MathUtils.damp(this.rightKnee.rotation.x, rKneeX, d, dt);
  }

  public dispose(): void {
    this.blaster.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
