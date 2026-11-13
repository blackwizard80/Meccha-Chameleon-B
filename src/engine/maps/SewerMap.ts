import * as THREE from 'three';
import {
  createConcreteMaterial,
  createHazardStripeMaterial,
  createMetalMaterial,
  createTileMaterial,
  createWoodMaterial,
} from '../TextureGenerator';
import { BuiltMap, MapAssembly } from './MapTypes';

/**
 * MAP 03: SEWER
 * Underground industrial drainage complex (40m x 36m):
 * - Central Concrete Drainage Channel with animated shimmering water & crossing bridges
 * - Elevated Metal Grate Walkways & Industrial Platforms with safety railings
 * - Cross-Connecting Vaulted Concrete Tunnels & Hidden Recessed Alcoves
 * - Pump Maintenance Rooms (electrical cabinets, pressure pipes, rusted & painted barrels)
 * - Warning Hazard Trim, Metal Doors, Drainage Culverts, Stacked Crates
 */
export function buildSewerMap(anisotropy = 4): BuiltMap {
  const m = new MapAssembly();

  const rawConcrete = m.trackMat(createConcreteMaterial('#64748b', '#334155', 'Raw Concrete', [8, 8], 0.9, anisotropy));
  const mossyConcrete = m.trackMat(createConcreteMaterial('#4d6b57', '#2f4538', 'Mossy Concrete', [6, 6], 0.88, anisotropy));
  const darkTunnel = m.trackMat(createConcreteMaterial('#3f4854', '#1e293b', 'Tunnel Wall', [6, 2], 0.88, anisotropy));
  const metalGrate = m.trackMat(createMetalMaterial('#475569', 'Metal Grate', 0.38, 0.85, true, anisotropy));
  const rustedPipe = m.trackMat(createMetalMaterial('#9a3412', 'Rusted Pipe', 0.48, 0.72, false, anisotropy));
  const tealPipe = m.trackMat(createMetalMaterial('#0f766e', 'Coolant Pipe', 0.35, 0.78, false, anisotropy));
  const blueBarrel = m.trackMat(createMetalMaterial('#1d4ed8', 'Chemical Drum', 0.36, 0.65, false, anisotropy));
  const yellowBarrel = m.trackMat(createMetalMaterial('#ca8a04', 'Hazard Drum', 0.38, 0.6, false, anisotropy));
  const crateMat = m.trackMat(createWoodMaterial('#926239', '#5c3a1e', 'Supply Crate', [2, 2], 0.8, anisotropy));
  const hazardMat = m.trackMat(createHazardStripeMaterial('Hazard Stripe'));
  const controlTile = m.trackMat(createTileMaterial('#334155', '#1e293b', '#0f172a', 'Control Floor', [4, 4], 0.45, anisotropy));

  // Animated Sewer Water Texture
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 256;
  waterCanvas.height = 256;
  const wctx = waterCanvas.getContext('2d')!;
  wctx.fillStyle = '#0f3f44';
  wctx.fillRect(0, 0, 256, 256);
  wctx.strokeStyle = 'rgba(94, 234, 212, 0.28)';
  wctx.lineWidth = 3;
  for (let y = 16; y < 256; y += 32) {
    wctx.beginPath();
    wctx.moveTo(0, y);
    wctx.bezierCurveTo(80, y + 10, 170, y - 10, 256, y);
    wctx.stroke();
  }
  const waterTex = new THREE.CanvasTexture(waterCanvas);
  waterTex.colorSpace = THREE.SRGBColorSpace;
  waterTex.wrapS = THREE.RepeatWrapping;
  waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(2, 10);
  const waterMat = m.trackMat(
    new THREE.MeshStandardMaterial({
      map: waterTex,
      roughness: 0.16,
      metalness: 0.25,
    }),
  );
  waterMat.userData = {
    paintColor: '#0f3f44',
    paintPattern: 'solid',
    paintLabel: 'Sewer Water',
    sourceCanvas: waterCanvas,
  };

  // Main Basin Floor (40 x 36)
  // Left & Right Concrete Banks (walkable at y=0) separated by Central Water Channel (x: -3.2..3.2, sunken slightly)
  m.addBox(16.8, 0.4, 36, -11.6, -0.4, 0, rawConcrete, { walkableTop: true, castShadow: false });
  m.addBox(16.8, 0.4, 36, 11.6, -0.4, 0, rawConcrete, { walkableTop: true, castShadow: false });
  // Sunken Water Channel Bed + Water Surface (walkable shallow wade at y=-0.22)
  m.addBox(6.8, 0.2, 36, 0, -0.45, 0, mossyConcrete, { walkableTop: true, castShadow: false });
  m.addBox(6.4, 0.04, 35.6, 0, -0.24, 0, waterMat, { collide: false, castShadow: false });

  // Hazard curbs along the water canal edges
  m.addBox(0.35, 0.14, 35.6, -3.2, 0, 0, hazardMat, { collide: false });
  m.addBox(0.35, 0.14, 35.6, 3.2, 0, 0, hazardMat, { collide: false });

  // Crossing Bridges over the Central Canal (z = -9, 0, +9)
  [-9, 0, 9].forEach((bz) => {
    m.addBox(7.2, 0.22, 2.8, 0, 0.02, bz, metalGrate, { walkableTop: true });
    m.addBox(6.8, 0.9, 0.1, 0, 0.24, bz - 1.35, hazardMat, { collide: true });
    m.addBox(6.8, 0.9, 0.1, 0, 0.24, bz + 1.35, hazardMat, { collide: true });
  });

  // Outer Perimeter Concrete Walls (Height 6.2m)
  const wallH = 6.2;
  m.addBox(40, wallH, 0.6, 0, 0, -17.7, darkTunnel);
  m.addBox(40, wallH, 0.6, 0, 0, 17.7, darkTunnel);
  m.addBox(0.6, wallH, 36, -19.7, 0, 0, darkTunnel);
  m.addBox(0.6, wallH, 36, 19.7, 0, 0, darkTunnel);

  // Vaulted Concrete Tunnel Arches / Ribs along West & East corridors
  [-14, -7, 0, 7, 14].forEach((tz) => {
    m.addBox(1.2, wallH, 0.8, -11.5, 0, tz, mossyConcrete);
    m.addBox(1.2, wallH, 0.8, 11.5, 0, tz, mossyConcrete);
    // Overhead cross-pipes
    m.addCylinder(0.36, 0.36, 38, 0, 4.2, tz, tealPipe, { rotZ: Math.PI / 2, collide: false });
  });

  // === ELEVATED METAL WALKWAYS & PLATFORMS (West & East Industrial Zones) ===
  const platY = 2.1;
  m.addBox(5.2, 0.22, 10.5, -16.8, platY - 0.22, -5.0, metalGrate, { walkableTop: true });
  // Ramps/Stairs to West Platform
  for (let s = 0; s < 6; s++) {
    m.addBox(2.2, 0.35, 0.6, -15.3, s * 0.35, 0.6 + s * 0.55, metalGrate, { walkableTop: true });
  }
  // East Industrial Platform
  m.addBox(5.2, 0.22, 10.5, 16.8, platY - 0.22, 4.0, metalGrate, { walkableTop: true });
  for (let s = 0; s < 6; s++) {
    m.addBox(2.2, 0.35, 0.6, 15.3, s * 0.35, -1.6 - s * 0.55, metalGrate, { walkableTop: true });
  }

  // === MAINTENANCE & PUMP ROOMS ===
  // North-West Pump Room (x -19..-13, z -17..-10)
  m.addBox(6.5, 0.04, 7.0, -16.0, 0, -13.5, controlTile, { collide: false });
  m.addBox(0.4, wallH, 4.2, -12.8, 0, -15.2, darkTunnel);
  m.addBox(1.2, 2.2, 2.6, -18.5, 0, -14.5, metalGrate); // Electrical cabinet
  m.addBox(1.2, 2.2, 1.8, -18.5, 0, -11.5, hazardMat); // Generator
  // Large Drainage Culvert Pipes along North wall
  m.addCylinder(1.25, 1.25, 4.5, -6.5, 0, -15.2, rawConcrete, { rotX: Math.PI / 2, collide: true, walkableTop: true });
  m.addCylinder(1.25, 1.25, 4.5, 6.5, 0, -15.2, mossyConcrete, { rotX: Math.PI / 2, collide: true, walkableTop: true });

  // Horizontal & Vertical Industrial Pipes
  m.addCylinder(0.4, 0.4, 16, -19.0, 1.2, 5.0, rustedPipe, { rotX: Math.PI / 2, collide: true });
  m.addCylinder(0.4, 0.4, 16, 19.0, 1.2, -5.0, tealPipe, { rotX: Math.PI / 2, collide: true });
  m.addCylinder(0.45, 0.45, wallH, -5.8, 0, -4.0, rustedPipe, { collide: true });
  m.addCylinder(0.45, 0.45, wallH, 5.8, 0, 4.0, tealPipe, { collide: true });

  // Clusters of Chemical Drums & Supply Crates for camouflage hiding!
  const barrelSpots: [number, number, number, THREE.Material][] = [
    [-7.5, 0, 4.5, blueBarrel],
    [-8.4, 0, 5.1, yellowBarrel],
    [-7.6, 0, 5.8, blueBarrel],
    [8.2, 0, -5.2, yellowBarrel],
    [9.1, 0, -4.6, blueBarrel],
    [8.0, 0, -4.0, rustedPipe],
    [-16.8, platY, -7.5, yellowBarrel],
    [-17.8, platY, -6.8, blueBarrel],
    [16.8, platY, 6.5, blueBarrel],
    [17.8, platY, 5.8, yellowBarrel],
    [14.8, 0, -13.5, blueBarrel],
    [15.8, 0, -13.5, yellowBarrel],
  ];
  barrelSpots.forEach(([bx, by, bz, mat]) => {
    m.addCylinder(0.42, 0.42, 1.08, bx, by, bz, mat, { collide: true, walkableTop: true });
  });

  // Crates & Metal Doors in Recessed Alcoves
  m.addBox(1.1, 1.1, 1.1, -17.5, 0, 11.5, crateMat, { walkableTop: true });
  m.addBox(0.95, 0.95, 0.95, -16.3, 0, 11.7, crateMat, { walkableTop: true });
  m.addBox(0.85, 0.85, 0.85, -17.3, 1.1, 11.5, crateMat, { walkableTop: true });

  m.addBox(1.15, 1.15, 1.15, 16.5, 0, 13.8, crateMat, { walkableTop: true });
  m.addBox(1.15, 1.15, 1.15, 15.2, 0, 14.0, crateMat, { walkableTop: true });
  m.addBox(2.4, 3.0, 0.35, 19.3, 0, -11.5, metalGrate); // Sealed Metal Door

  // Seeker Waiting Bay (South Control Platform)
  m.addBox(8.0, 0.12, 4.2, 0, 0.02, 15.0, controlTile, { collide: true, walkableTop: true });
  m.addBox(8.2, 0.25, 0.35, 0, 0.14, 12.8, hazardMat, { collide: false });

  return {
    id: 'sewer',
    name: 'Underground Sewer',
    group: m.group,
    colliders: m.colliders,
    paintableSurfaces: m.paintableSurfaces,
    hiderSpawns: [
      new THREE.Vector3(-15.5, 0.05, -13.5),
      new THREE.Vector3(-16.8, platY + 0.05, -5.0),
      new THREE.Vector3(16.8, platY + 0.05, 4.0),
      new THREE.Vector3(14.5, 0.05, -11.0),
      new THREE.Vector3(-8.5, 0.05, -8.0),
      new THREE.Vector3(8.5, 0.05, 8.0),
      new THREE.Vector3(-15.5, 0.05, 9.5),
      new THREE.Vector3(14.5, 0.05, 12.0),
    ],
    seekerSpawns: [
      new THREE.Vector3(0, 0.15, 15.0),
      new THREE.Vector3(-1.3, 0.15, 15.0),
      new THREE.Vector3(1.3, 0.15, 15.0),
      new THREE.Vector3(0, 0.15, 13.8),
    ],
    waitingAreaCenter: new THREE.Vector3(0, 0.15, 15.0),
    observationLineupOrigin: new THREE.Vector3(0, 0.25, 0.0),
    bounds: { minX: -19.0, maxX: 19.0, minZ: -17.0, maxZ: 17.0 },
    skyColor: 0x0b1519,
    fogDensity: 0.018,
    update: (elapsed: number) => {
      waterTex.offset.y = -elapsed * 0.12;
      waterTex.offset.x = Math.sin(elapsed * 0.6) * 0.03;
    },
    dispose: () => m.dispose(),
  };
}
