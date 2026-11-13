import * as THREE from 'three';
import { MapId } from '../../types/game';

export interface AABBCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  /** If true, player can walk on top of this box (e.g. stairs, platforms, tables, beds) */
  walkableTop?: boolean;
}

export interface BuiltMap {
  id: MapId;
  name: string;
  group: THREE.Group;
  colliders: AABBCollider[];
  paintableSurfaces: THREE.Object3D[];
  hiderSpawns: THREE.Vector3[];
  seekerSpawns: THREE.Vector3[];
  waitingAreaCenter: THREE.Vector3;
  observationLineupOrigin: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  skyColor: number;
  fogDensity: number;
  update?: (elapsed: number) => void;
  dispose: () => void;
}

export class MapAssembly {
  public readonly group = new THREE.Group();
  public readonly colliders: AABBCollider[] = [];
  public readonly paintableSurfaces: THREE.Object3D[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  public trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  public trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  /**
   * Create a grounded box centered at (cx, yBottom + h/2, cz) with optional AABB collider.
   */
  public addBox(
    w: number,
    h: number,
    d: number,
    x: number,
    yBottom: number,
    z: number,
    material: THREE.Material,
    options: {
      collide?: boolean;
      walkableTop?: boolean;
      castShadow?: boolean;
      receiveShadow?: boolean;
      paintable?: boolean;
      rotY?: number;
    } = {},
  ): THREE.Mesh {
    const geo = this.trackGeo(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, yBottom + h * 0.5, z);
    if (options.rotY) mesh.rotation.y = options.rotY;
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
    this.group.add(mesh);

    if (options.paintable !== false) {
      this.paintableSurfaces.push(mesh);
    }

    if (options.collide !== false) {
      // Compute world-aligned bounds if rotated by 90 deg increments or general
      const rot = options.rotY ?? 0;
      const cos = Math.abs(Math.cos(rot));
      const sin = Math.abs(Math.sin(rot));
      const bw = w * cos + d * sin;
      const bd = w * sin + d * cos;
      this.colliders.push({
        minX: x - bw * 0.5,
        maxX: x + bw * 0.5,
        minY: yBottom,
        maxY: yBottom + h,
        minZ: z - bd * 0.5,
        maxZ: z + bd * 0.5,
        walkableTop: options.walkableTop ?? false,
      });
    }
    return mesh;
  }

  public addCylinder(
    rTop: number,
    rBot: number,
    h: number,
    x: number,
    yBottom: number,
    z: number,
    material: THREE.Material,
    options: {
      collide?: boolean;
      walkableTop?: boolean;
      segs?: number;
      rotX?: number;
      rotZ?: number;
      paintable?: boolean;
    } = {},
  ): THREE.Mesh {
    const geo = this.trackGeo(
      new THREE.CylinderGeometry(rTop, rBot, h, options.segs ?? 14),
    );
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, yBottom + h * 0.5, z);
    if (options.rotX) mesh.rotation.x = options.rotX;
    if (options.rotZ) mesh.rotation.z = options.rotZ;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    if (options.paintable !== false) this.paintableSurfaces.push(mesh);

    if (options.collide) {
      const r = Math.max(rTop, rBot);
      this.colliders.push({
        minX: x - r,
        maxX: x + r,
        minY: yBottom,
        maxY: yBottom + h,
        minZ: z - r,
        maxZ: z + r,
        walkableTop: options.walkableTop ?? false,
      });
    }
    return mesh;
  }

  /**
   * Composite Sofa (base, cushions, backrest, armrests) — great for hiding behind/beside!
   */
  public addSofa(
    x: number,
    z: number,
    rotY: number,
    fabricMat: THREE.Material,
    woodMat: THREE.Material,
  ): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    this.group.add(g);

    const addPart = (w: number, h: number, d: number, px: number, py: number, pz: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
      mesh.position.set(px, py + h * 0.5, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      this.paintableSurfaces.push(mesh);
    };

    // Legs
    addPart(0.1, 0.12, 0.1, -1.05, 0, -0.38, woodMat);
    addPart(0.1, 0.12, 0.1, 1.05, 0, -0.38, woodMat);
    addPart(0.1, 0.12, 0.1, -1.05, 0, 0.38, woodMat);
    addPart(0.1, 0.12, 0.1, 1.05, 0, 0.38, woodMat);
    // Base + Seat cushions
    addPart(2.3, 0.28, 0.92, 0, 0.12, 0, fabricMat);
    addPart(0.68, 0.14, 0.78, -0.7, 0.4, 0.04, fabricMat);
    addPart(0.68, 0.14, 0.78, 0, 0.4, 0.04, fabricMat);
    addPart(0.68, 0.14, 0.78, 0.7, 0.4, 0.04, fabricMat);
    // Backrest + Armrests
    addPart(2.3, 0.52, 0.22, 0, 0.4, -0.35, fabricMat);
    addPart(0.22, 0.42, 0.92, -1.04, 0.32, 0, fabricMat);
    addPart(0.22, 0.42, 0.92, 1.04, 0.32, 0, fabricMat);

    const cos = Math.abs(Math.cos(rotY));
    const sin = Math.abs(Math.sin(rotY));
    const bw = 2.3 * cos + 0.92 * sin;
    const bd = 2.3 * sin + 0.92 * cos;
    this.colliders.push({
      minX: x - bw * 0.5,
      maxX: x + bw * 0.5,
      minY: 0,
      maxY: 0.92,
      minZ: z - bd * 0.5,
      maxZ: z + bd * 0.5,
      walkableTop: true,
    });
  }

  /**
   * Composite Table (4 corner legs + apron + tabletop) so players can hide UNDER it!
   */
  public addTable(
    w: number,
    h: number,
    d: number,
    x: number,
    yBottom: number,
    z: number,
    mat: THREE.Material,
  ): void {
    const legH = h - 0.1;
    const lx = w * 0.5 - 0.12;
    const lz = d * 0.5 - 0.12;
    this.addBox(0.1, legH, 0.1, x - lx, yBottom, z - lz, mat, { collide: true });
    this.addBox(0.1, legH, 0.1, x + lx, yBottom, z - lz, mat, { collide: true });
    this.addBox(0.1, legH, 0.1, x - lx, yBottom, z + lz, mat, { collide: true });
    this.addBox(0.1, legH, 0.1, x + lx, yBottom, z + lz, mat, { collide: true });
    // Tabletop collider starts at legH so crouched/curled hiders fit underneath!
    this.addBox(w, 0.1, d, x, yBottom + legH, z, mat, { collide: true, walkableTop: true });
  }

  /**
   * Composite Chair
   */
  public addChair(
    x: number,
    yBottom: number,
    z: number,
    rotY: number,
    woodMat: THREE.Material,
    cushionMat: THREE.Material,
  ): void {
    const g = new THREE.Group();
    g.position.set(x, yBottom, z);
    g.rotation.y = rotY;
    this.group.add(g);

    const addPart = (w: number, h: number, d: number, px: number, py: number, pz: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(w, h, d)), m);
      mesh.position.set(px, py + h * 0.5, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      this.paintableSurfaces.push(mesh);
    };

    addPart(0.06, 0.45, 0.06, -0.2, 0, -0.2, woodMat);
    addPart(0.06, 0.45, 0.06, 0.2, 0, -0.2, woodMat);
    addPart(0.06, 0.45, 0.06, -0.2, 0, 0.2, woodMat);
    addPart(0.06, 0.45, 0.06, 0.2, 0, 0.2, woodMat);
    addPart(0.5, 0.08, 0.5, 0, 0.45, 0, cushionMat);
    addPart(0.5, 0.52, 0.07, 0, 0.53, -0.21, woodMat);

    this.colliders.push({
      minX: x - 0.27,
      maxX: x + 0.27,
      minY: yBottom,
      maxY: yBottom + 0.55,
      minZ: z - 0.27,
      maxZ: z + 0.27,
      walkableTop: true,
    });
  }

  /**
   * Composite Potted Plant (Terracotta pot + soil + layered foliage fronds)
   */
  public addPottedPlant(
    x: number,
    yBottom: number,
    z: number,
    potMat: THREE.Material,
    leafMat: THREE.Material,
    scale = 1,
  ): void {
    this.addCylinder(0.26 * scale, 0.18 * scale, 0.45 * scale, x, yBottom, z, potMat, {
      collide: true,
    });
    const frondCount = 6;
    for (let i = 0; i < frondCount; i++) {
      const ang = (i / frondCount) * Math.PI * 2;
      const geo = this.trackGeo(new THREE.ConeGeometry(0.18 * scale, 0.72 * scale, 6));
      const leaf = new THREE.Mesh(geo, leafMat);
      leaf.position.set(
        x + Math.cos(ang) * 0.14 * scale,
        yBottom + 0.65 * scale,
        z + Math.sin(ang) * 0.14 * scale,
      );
      leaf.rotation.z = Math.cos(ang) * -0.45;
      leaf.rotation.x = Math.sin(ang) * 0.45;
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      this.group.add(leaf);
      this.paintableSurfaces.push(leaf);
    }
  }

  /**
   * Composite Standing Lamp
   */
  public addFloorLamp(
    x: number,
    yBottom: number,
    z: number,
    metalMat: THREE.Material,
    shadeMat: THREE.Material,
  ): void {
    this.addCylinder(0.22, 0.24, 0.06, x, yBottom, z, metalMat, { collide: true });
    this.addCylinder(0.035, 0.04, 1.65, x, yBottom + 0.06, z, metalMat, { collide: false });
    this.addCylinder(0.2, 0.32, 0.36, x, yBottom + 1.55, z, shadeMat, { collide: false });
  }

  /**
   * Framed Wall Painting
   */
  public addWallPainting(
    x: number,
    y: number,
    z: number,
    rotY: number,
    frameMat: THREE.Material,
    artColorHex: string,
    accentHex: string,
  ): void {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    this.group.add(g);

    const frame = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.5, 1.05, 0.07)), frameMat);
    frame.castShadow = true;
    g.add(frame);
    this.paintableSurfaces.push(frame);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = artColorHex;
    ctx.fillRect(0, 0, 128, 96);
    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.arc(44, 42, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 68, 128, 28);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const artMat = this.trackMat(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    artMat.userData = {
      paintColor: artColorHex,
      paintPattern: 'solid',
      paintLabel: 'Canvas Art',
      sourceCanvas: canvas,
    };
    const art = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(1.32, 0.88)), artMat);
    art.position.z = 0.04;
    g.add(art);
    this.paintableSurfaces.push(art);
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => {
      const std = m as THREE.MeshStandardMaterial;
      std.map?.dispose();
      m.dispose();
    });
  }
}
