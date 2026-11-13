import * as THREE from 'three';
import { SeekerTheme } from '../types/game';

export function getSeekerEnergyColors(theme: SeekerTheme = 'cyan'): {
  primary: number;
  emissive: number;
  css: string;
} {
  if (theme === 'amber') {
    return { primary: 0xfbbf24, emissive: 0xd97706, css: '#fbbf24' };
  }
  if (theme === 'emerald') {
    return { primary: 0x34d399, emissive: 0x059669, css: '#34d399' };
  }
  return { primary: 0x22d3ee, emissive: 0x0891b2, css: '#22d3ee' };
}

export class SeekerBlaster {
  public readonly group = new THREE.Group();
  public readonly muzzleAnchor = new THREE.Object3D();

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  private readonly magazineGroup = new THREE.Group();
  private readonly muzzleFlash: THREE.Group;
  private readonly energyMat: THREE.MeshStandardMaterial;
  private readonly barrelGlowMat: THREE.MeshStandardMaterial;
  private readonly indicatorMat: THREE.MeshStandardMaterial;
  private readonly flashMat: THREE.MeshBasicMaterial;

  private recoilOffset = 0;
  private flashTimer = 0;
  private chargePhase = 0;

  constructor(theme: SeekerTheme = 'cyan') {
    const colors = getSeekerEnergyColors(theme);

    const navyMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x162447, roughness: 0.42, metalness: 0.35 }),
    );
    const whiteArmorMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.25 }),
    );
    const gunMetalMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.28, metalness: 0.85 }),
    );
    const orangeTrimMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.38, metalness: 0.2 }),
    );
    const gripMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.08 }),
    );
    const glassMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.38,
      }),
    );

    this.energyMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: colors.primary,
        emissive: colors.emissive,
        emissiveIntensity: 1.5,
        roughness: 0.15,
        metalness: 0.1,
      }),
    );

    this.barrelGlowMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: colors.primary,
        emissive: colors.emissive,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      }),
    );

    this.indicatorMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x16a34a,
        emissiveIntensity: 1.2,
        roughness: 0.2,
      }),
    );

    const addBox = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      parent: THREE.Object3D = this.group,
      rx = 0,
    ) => {
      const geo = this.trackGeo(new THREE.BoxGeometry(w, h, d));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      if (rx) mesh.rotation.x = rx;
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const addCyl = (
      rt: number,
      rb: number,
      h: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      parent: THREE.Object3D = this.group,
      rotX = Math.PI / 2,
    ) => {
      const geo = this.trackGeo(new THREE.CylinderGeometry(rt, rb, h, 14));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rotX;
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Blaster points forward along +Z; Grip sits near (0, 0, 0)
    // 1. Main Receiver Body (Dark navy + white upper cowl + orange accent)
    addBox(0.088, 0.125, 0.36, 0, 0.085, 0.08, navyMat);
    addBox(0.094, 0.055, 0.32, 0, 0.15, 0.09, whiteArmorMat);
    addBox(0.098, 0.018, 0.22, 0, 0.11, 0.11, orangeTrimMat);

    // 2. Angled Pistol Grip + Trigger Guard + Trigger
    addBox(0.054, 0.15, 0.072, 0, -0.025, -0.02, gripMat, this.group, 0.28);
    addBox(0.024, 0.012, 0.09, 0, 0.005, 0.055, gunMetalMat);
    addBox(0.014, 0.036, 0.018, 0, 0.032, 0.042, orangeTrimMat, this.group, 0.3);

    // 3. Precision Barrel & Forward Shroud
    addCyl(0.024, 0.026, 0.28, 0, 0.115, 0.36, gunMetalMat);
    addBox(0.072, 0.068, 0.22, 0, 0.072, 0.32, navyMat);
    // Glowing Barrel Emitter Rings & Muzzle Tip
    addCyl(0.031, 0.031, 0.022, 0, 0.115, 0.31, this.barrelGlowMat);
    addCyl(0.031, 0.031, 0.022, 0, 0.115, 0.41, this.barrelGlowMat);
    addCyl(0.032, 0.028, 0.036, 0, 0.115, 0.495, gunMetalMat);
    addCyl(0.021, 0.021, 0.012, 0, 0.115, 0.514, this.energyMat);

    // 4. Transparent Energy Ammunition Chamber + Core
    addBox(0.066, 0.05, 0.14, 0, 0.115, 0.11, glassMat);
    addCyl(0.018, 0.018, 0.125, 0, 0.115, 0.11, this.energyMat);

    // 5. Removable Energy Cell Magazine (underneath forward receiver)
    this.magazineGroup.position.set(0, 0.01, 0.14);
    this.group.add(this.magazineGroup);
    addBox(0.056, 0.12, 0.075, 0, -0.035, 0, navyMat, this.magazineGroup);
    addBox(0.06, 0.08, 0.026, 0, -0.03, 0, this.energyMat, this.magazineGroup);
    addBox(0.062, 0.022, 0.08, 0, -0.095, 0, orangeTrimMat, this.magazineGroup);

    // 6. Top-Mounted Holographic Sight
    addBox(0.052, 0.018, 0.11, 0, 0.184, 0.06, gunMetalMat);
    addBox(0.048, 0.042, 0.014, 0, 0.21, 0.105, gunMetalMat);
    addBox(0.048, 0.042, 0.014, 0, 0.21, 0.015, gunMetalMat);
    addBox(0.04, 0.036, 0.006, 0, 0.21, 0.06, glassMat);
    // Tiny glowing holographic dot inside lens
    addBox(0.008, 0.008, 0.008, 0, 0.21, 0.06, this.energyMat);

    // 7. Side Tactical Attachment & Indicator LEDs
    addBox(0.028, 0.038, 0.13, 0.055, 0.085, 0.28, gunMetalMat);
    addCyl(0.012, 0.012, 0.04, 0.058, 0.085, 0.35, this.energyMat);
    addBox(0.012, 0.012, 0.016, -0.048, 0.13, 0.02, this.indicatorMat);
    addBox(0.012, 0.012, 0.016, -0.048, 0.13, -0.01, this.energyMat);

    // 8. Muzzle Anchor & Stylized Muzzle Flash
    this.muzzleAnchor.position.set(0, 0.115, 0.525);
    this.group.add(this.muzzleAnchor);

    this.muzzleFlash = new THREE.Group();
    this.muzzleFlash.position.copy(this.muzzleAnchor.position);
    this.muzzleFlash.visible = false;
    this.flashMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: colors.primary,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    const coneGeo = this.trackGeo(new THREE.ConeGeometry(0.075, 0.24, 8));
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, 0.12);
    this.muzzleFlash.add(new THREE.Mesh(coneGeo, this.flashMat));

    const ringGeo = this.trackGeo(new THREE.RingGeometry(0.04, 0.12, 16));
    const ringMesh = new THREE.Mesh(ringGeo, this.flashMat);
    ringMesh.position.z = 0.02;
    this.muzzleFlash.add(ringMesh);
    this.group.add(this.muzzleFlash);
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  public setTheme(theme: SeekerTheme): void {
    const c = getSeekerEnergyColors(theme);
    this.energyMat.color.setHex(c.primary);
    this.energyMat.emissive.setHex(c.emissive);
    this.barrelGlowMat.color.setHex(c.primary);
    this.barrelGlowMat.emissive.setHex(c.emissive);
    this.flashMat.color.setHex(c.primary);
  }

  public triggerFireFX(): void {
    this.recoilOffset = 0.085;
    this.flashTimer = 0.085;
    this.muzzleFlash.visible = true;
    this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
  }

  public getMuzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateWorldMatrix(true, false);
    return this.muzzleAnchor.getWorldPosition(out);
  }

  public update(
    dt: number,
    options: { reloading: boolean; reloadProgress: number; ammoRatio: number },
  ): void {
    this.chargePhase += dt * 4.5;

    // Recoil spring recovery
    this.recoilOffset = THREE.MathUtils.damp(this.recoilOffset, 0, 22, dt);
    this.group.position.z = -this.recoilOffset;

    // Muzzle flash timer
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.muzzleFlash.scale.setScalar(0.85 + Math.random() * 0.4);
      if (this.flashTimer <= 0) {
        this.muzzleFlash.visible = false;
      }
    }

    // Magazine drop-and-lock animation during Reload
    if (options.reloading) {
      const p = options.reloadProgress; // 0..1
      const drop = p < 0.5 ? p * 2 : (1 - p) * 2;
      this.magazineGroup.position.y = 0.01 - drop * 0.16;
      this.energyMat.emissiveIntensity = 0.5 + Math.sin(this.chargePhase * 3) * 0.5;
      this.indicatorMat.color.setHex(0xf59e0b);
      this.indicatorMat.emissive.setHex(0xd97706);
    } else {
      this.magazineGroup.position.y = THREE.MathUtils.damp(
        this.magazineGroup.position.y,
        0.01,
        18,
        dt,
      );
      const pulse = 1.2 + Math.sin(this.chargePhase) * 0.35;
      this.energyMat.emissiveIntensity = pulse * Math.max(0.25, options.ammoRatio);
      this.barrelGlowMat.emissiveIntensity =
        (this.flashTimer > 0 ? 2.4 : 0.75) + Math.sin(this.chargePhase) * 0.2;

      if (options.ammoRatio <= 0.25) {
        this.indicatorMat.color.setHex(0xef4444);
        this.indicatorMat.emissive.setHex(0xdc2626);
      } else {
        this.indicatorMat.color.setHex(0x22c55e);
        this.indicatorMat.emissive.setHex(0x16a34a);
      }
    }
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
