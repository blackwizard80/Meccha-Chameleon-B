import * as THREE from 'three';
import {
  createConcreteMaterial,
  createFabricMaterial,
  createMetalMaterial,
  createRugMaterial,
  createTileMaterial,
  createWallpaperMaterial,
  createWoodMaterial,
} from '../TextureGenerator';
import { BuiltMap, MapAssembly } from './MapTypes';

/**
 * MAP 02: INDOOR COUNTRY
 * Expansive rustic timber lodge & barn interior (38m x 34m):
 * - Grand Timber Hall with wooden pillars, mezzanine loft, and stepped wooden stairs
 * - Country Hearth Kitchen (butcher block, cast-iron hearth oven, copper counters, pantry shelves)
 * - Storage Barn Wing (stacked wooden crates, hay bales, oak barrels, tool racks)
 * - Small Side Rooms & Corridors (Craft Room, Reading Parlor)
 * - Varied floor zones: Plank oak, Terracotta tile, Stone hearth, Woven country rugs
 */
export function buildIndoorCountryMap(anisotropy = 4): BuiltMap {
  const m = new MapAssembly();

  const pinePlank = m.trackMat(createWoodMaterial('#a47148', '#6f4518', 'Country Pine', [9, 9], 0.65, anisotropy));
  const barnTimber = m.trackMat(createWoodMaterial('#5c3a21', '#382212', 'Barn Timber', [3, 3], 0.72, anisotropy));
  const crateWood = m.trackMat(createWoodMaterial('#c89d66', '#8d6334', 'Crate Wood', [2, 2], 0.76, anisotropy));
  const terracotta = m.trackMat(createTileMaterial('#c26d4a', '#a95838', '#78350f', 'Terracotta Tile', [6, 6], 0.55, anisotropy));
  const stoneHearth = m.trackMat(createConcreteMaterial('#78716c', '#57534e', 'Stone Hearth', [3, 3], 0.88, anisotropy));
  const countryWall = m.trackMat(createWallpaperMaterial('#efe6d5', '#d6c7b0', 'Plaster Wall', [8, 2], anisotropy));
  const hayMat = m.trackMat(createFabricMaterial('#d9a441', 'Straw Hay', 0.94));
  const plaidFabric = m.trackMat(createRugMaterial('#b91c1c', '#7f1d1d', '#fef3c7', 'Plaid Rug', anisotropy));
  const oliveFabric = m.trackMat(createFabricMaterial('#4d7c0f', 'Olive Cloth'));
  const denimFabric = m.trackMat(createFabricMaterial('#1d4ed8', 'Denim Cushion'));
  const copperMetal = m.trackMat(createMetalMaterial('#b87333', 'Copper Pan', 0.28, 0.85, false, anisotropy));
  const ironMetal = m.trackMat(createMetalMaterial('#334155', 'Cast Iron', 0.5, 0.75, false, anisotropy));
  const potMat = m.trackMat(createConcreteMaterial('#9a3412', '#7c2d12', 'Clay Pot', [1, 1], 0.8, anisotropy));
  const leafMat = m.trackMat(createFabricMaterial('#166534', 'Fern Foliage', 0.65));

  // Ground floor (38 x 34)
  m.addBox(38, 0.2, 34, 0, -0.2, 0, pinePlank, { collide: true, walkableTop: true, castShadow: false });
  // Kitchen terracotta floor & hearth stone apron
  m.addBox(12, 0.04, 12, -12, 0, -10, terracotta, { collide: false, castShadow: false });
  m.addBox(7, 0.05, 5, 0, 0, -13.5, stoneHearth, { collide: false, castShadow: false });
  // Woven country rugs
  m.addBox(6.8, 0.03, 5.2, 0, 0, 2.5, plaidFabric, { collide: false, castShadow: false });
  m.addBox(5.0, 0.03, 4.0, 12, 0, -10, plaidFabric, { collide: false, castShadow: false });

  // Outer perimeter walls (height 6.0m)
  const wallH = 6.0;
  m.addBox(38, wallH, 0.5, 0, 0, -16.75, countryWall);
  m.addBox(38, wallH, 0.5, 0, 0, 16.75, countryWall);
  m.addBox(0.5, wallH, 34, -18.75, 0, 0, countryWall);
  m.addBox(0.5, wallH, 34, 18.75, 0, 0, countryWall);

  // Exposed structural wooden support beams
  [-11, -4, 4, 11].forEach((bx) => {
    [-9, 1, 10].forEach((bz) => {
      m.addBox(0.45, wallH, 0.45, bx, 0, bz, barnTimber);
    });
  });

  // === COUNTRY HEARTH & LOUNGE (North-Center) ===
  m.addBox(3.8, 3.0, 1.4, 0, 0, -15.8, stoneHearth);
  m.addBox(4.1, 0.2, 1.6, 0, 1.6, -15.7, barnTimber);
  m.addSofa(-2.2, -10.8, Math.PI / 4, oliveFabric, barnTimber);
  m.addSofa(2.2, -10.8, -Math.PI / 4, oliveFabric, barnTimber);
  m.addTable(1.8, 0.52, 1.1, 0, 0, -10.8, barnTimber);

  // === COUNTRY KITCHEN (North-West: x -18..-6, z -16..-4) ===
  // Partition wall with open doorway
  m.addBox(0.4, wallH, 5.5, -6, 0, -13.7, countryWall);
  m.addBox(0.4, wallH, 4.0, -6, 0, -5.8, countryWall);
  m.addBox(5.2, 0.4, 0.4, -15.9, 0, -4, countryWall);
  m.addBox(3.5, 0.4, 0.4, -8.2, 0, -4, countryWall);

  // Butcher block island + copper pots
  m.addBox(3.4, 0.96, 1.5, -12.2, 0, -10.2, crateWood, { walkableTop: true });
  m.addCylinder(0.28, 0.24, 0.25, -11.4, 0.96, -10.2, copperMetal, { collide: false });
  m.addCylinder(0.22, 0.2, 0.2, -12.8, 0.96, -10.0, copperMetal, { collide: false });
  // Cast-iron hearth stove & pantry shelves
  m.addBox(1.8, 1.15, 1.1, -17.3, 0, -11.5, ironMetal, { walkableTop: true });
  m.addBox(4.8, 0.95, 1.0, -12.5, 0, -15.8, barnTimber, { walkableTop: true });
  m.addBox(0.7, 2.4, 2.6, -18.0, 0, -7.2, barnTimber);
  m.addTable(2.6, 0.82, 1.4, -12.0, 0, -6.4, barnTimber);
  m.addChair(-12.8, 0, -5.3, Math.PI, barnTimber, denimFabric);
  m.addChair(-11.2, 0, -5.3, Math.PI, barnTimber, denimFabric);

  // === STORAGE BARN & MEZZANINE LOFT (East Wing: x 6..18, z -16..16) ===
  m.addBox(0.4, wallH, 8.0, 6.2, 0, -12.5, barnTimber);
  m.addBox(0.4, wallH, 6.0, 6.2, 0, 5.0, barnTimber);

  // Mezzanine Loft Platform (y = 2.6) + Wooden Ramp/Stairs
  const loftY = 2.6;
  m.addBox(11.6, 0.28, 7.6, 12.4, loftY - 0.28, -12.5, barnTimber, { walkableTop: true });
  for (let s = 0; s < 7; s++) {
    m.addBox(2.2, 0.37, 0.55, 8.2, s * 0.37, -8.2 + s * 0.55, crateWood, { walkableTop: true });
  }
  // Stacked Hay Bales & Crates on Loft & Barn Floor
  m.addBox(1.4, 0.85, 0.9, 15.8, loftY, -14.8, hayMat, { walkableTop: true });
  m.addBox(1.4, 0.85, 0.9, 14.3, loftY, -14.8, hayMat, { walkableTop: true });
  m.addBox(1.4, 0.85, 0.9, 15.0, loftY + 0.85, -14.8, hayMat, { walkableTop: true });
  m.addBox(0.95, 0.95, 0.95, 11.5, loftY, -14.2, crateWood, { walkableTop: true });

  // Ground-level Barn Crates, Barrels & Hay Stacks
  m.addBox(1.4, 0.9, 1.0, 16.5, 0, -2.5, hayMat, { walkableTop: true });
  m.addBox(1.4, 0.9, 1.0, 15.0, 0, -2.5, hayMat, { walkableTop: true });
  m.addBox(1.1, 1.1, 1.1, 16.5, 0, 2.0, crateWood, { walkableTop: true });
  m.addBox(0.9, 0.9, 0.9, 16.5, 1.1, 2.0, crateWood, { walkableTop: true });
  m.addBox(1.1, 1.1, 1.1, 15.2, 0, 2.2, crateWood, { walkableTop: true });
  m.addCylinder(0.42, 0.42, 1.05, 11.2, 0, -2.0, barnTimber, { collide: true, walkableTop: true });
  m.addCylinder(0.42, 0.42, 1.05, 12.2, 0, -1.6, barnTimber, { collide: true, walkableTop: true });
  m.addCylinder(0.42, 0.42, 1.05, 11.5, 0, -0.8, barnTimber, { collide: true, walkableTop: true });

  // === CRAFT ROOM & SMALL READING PARLOR (South-West & South-East) ===
  m.addBox(0.4, wallH, 7.0, -6, 0, 9.5, countryWall);
  m.addTable(2.4, 0.8, 1.1, -12.5, 0, 8.5, crateWood);
  m.addBox(0.8, 2.3, 2.4, -17.9, 0, 11.0, barnTimber);
  m.addSofa(-10.5, 13.8, Math.PI, denimFabric, barnTimber);
  m.addPottedPlant(-7.5, 0, 14.8, potMat, leafMat, 1.1);
  m.addPottedPlant(16.8, 0, 14.5, potMat, leafMat, 1.15);

  // Central Lodge Picnic Tables & Shelves
  m.addTable(3.2, 0.8, 1.5, 0, 0, 2.5, barnTimber);
  m.addBox(2.8, 0.48, 0.55, 0, 0, 3.6, crateWood, { walkableTop: true }); // Bench
  m.addBox(2.8, 0.48, 0.55, 0, 0, 1.4, crateWood, { walkableTop: true }); // Bench
  m.addWallPainting(-18.42, 2.5, 3.5, Math.PI / 2, barnTimber, '#065f46', '#fde047');
  m.addWallPainting(0, 2.9, -15.05, 0, copperMetal, '#9a3412', '#fed7aa');

  // Seeker Waiting Porch (South Center)
  m.addBox(8.6, 0.1, 4.2, 0, 0, 14.0, stoneHearth, { collide: false });
  m.addCylinder(0.4, 0.4, 1.0, -4.6, 0, 13.5, barnTimber, { collide: true, walkableTop: true });
  m.addCylinder(0.4, 0.4, 1.0, 4.6, 0, 13.5, barnTimber, { collide: true, walkableTop: true });

  return {
    id: 'indoor_country',
    name: 'Indoor Country',
    group: m.group,
    colliders: m.colliders,
    paintableSurfaces: m.paintableSurfaces,
    hiderSpawns: [
      new THREE.Vector3(-12.5, 0.05, -13.0),
      new THREE.Vector3(-12.0, 0.05, 4.5),
      new THREE.Vector3(12.5, loftY + 0.05, -12.5),
      new THREE.Vector3(13.5, 0.05, 5.5),
      new THREE.Vector3(0, 0.05, -7.5),
      new THREE.Vector3(-14.5, 0.05, 13.0),
      new THREE.Vector3(9.5, 0.05, -1.5),
      new THREE.Vector3(2.5, 0.05, 5.5),
    ],
    seekerSpawns: [
      new THREE.Vector3(0, 0.05, 14.0),
      new THREE.Vector3(-1.3, 0.05, 14.0),
      new THREE.Vector3(1.3, 0.05, 14.0),
      new THREE.Vector3(0, 0.05, 12.6),
    ],
    waitingAreaCenter: new THREE.Vector3(0, 0.05, 14.0),
    observationLineupOrigin: new THREE.Vector3(0, 0.05, 4.0),
    bounds: { minX: -18.2, maxX: 18.2, minZ: -16.2, maxZ: 16.2 },
    skyColor: 0x261f1a,
    fogDensity: 0.011,
    dispose: () => m.dispose(),
  };
}
