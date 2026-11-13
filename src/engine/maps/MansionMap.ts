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
 * MAP 01: HIDE AND SEEK MANSION
 * Multi-room estate (36m x 32m):
 * - Central Grand Foyer + Twin Staircases + Upper Balcony Overlook
 * - West Wing: Living Room (sofas, fireplace, bookshelves, lamps, plants) + Study
 * - North-West: Kitchen (island counter, fridge, stove, cabinets, bar stools)
 * - North-East: Dining Room (long oak table, 6 chairs, china cabinet)
 * - East Wing: Master Bedroom (bed, wardrobe, vanity) + Tiled Bathroom (clawfoot tub, vanity)
 * - South Wing: Seeker Waiting Lounge (glass-arched vestibule)
 */
export function buildMansionMap(anisotropy = 4): BuiltMap {
  const m = new MapAssembly();

  // Calibrated PBR Material Palette
  const oakFloor = m.trackMat(createWoodMaterial('#7c4d2b', '#4d2b15', 'Oak Floor', [8, 8], 0.58, anisotropy));
  const darkWalnut = m.trackMat(createWoodMaterial('#4a2c1a', '#29150a', 'Walnut Wood', [2, 2], 0.52, anisotropy));
  const lightPine = m.trackMat(createWoodMaterial('#b5895a', '#8c6137', 'Pine Crate', [2, 2], 0.72, anisotropy));
  const marbleTile = m.trackMat(createTileMaterial('#e7e5e4', '#d6d3d1', '#9ca3af', 'Marble Tile', [6, 6], 0.3, anisotropy));
  const bathTile = m.trackMat(createTileMaterial('#bae6fd', '#e0f2fe', '#64748b', 'Bath Tile', [4, 4], 0.25, anisotropy));
  const foyerWall = m.trackMat(createWallpaperMaterial('#dfd3c3', '#c7b8a3', 'Cream Wallpaper', [8, 2], anisotropy));
  const livingWall = m.trackMat(createWallpaperMaterial('#6d8b74', '#506a56', 'Sage Wallpaper', [6, 2], anisotropy));
  const bedWall = m.trackMat(createWallpaperMaterial('#7d6b91', '#604f73', 'Plum Wallpaper', [6, 2], anisotropy));
  const crimsonRug = m.trackMat(createRugMaterial('#881337', '#4c0519', '#eab308', 'Crimson Rug', anisotropy));
  const navyRug = m.trackMat(createRugMaterial('#1e3a5f', '#0f172a', '#93c5fd', 'Navy Rug', anisotropy));
  const velvetSofa = m.trackMat(createFabricMaterial('#991b1b', 'Red Velvet'));
  const tealSofa = m.trackMat(createFabricMaterial('#0f766e', 'Teal Fabric'));
  const creamFabric = m.trackMat(createFabricMaterial('#f5f5f4', 'Linen Sheet'));
  const brassMetal = m.trackMat(createMetalMaterial('#d4af37', 'Polished Brass', 0.28, 0.88, false, anisotropy));
  const steelMetal = m.trackMat(createMetalMaterial('#94a3b8', 'Kitchen Steel', 0.25, 0.85, false, anisotropy));
  const stoneBrick = m.trackMat(createConcreteMaterial('#78716c', '#44403c', 'Fireplace Stone', [2, 2], 0.85, anisotropy));
  const potMat = m.trackMat(createConcreteMaterial('#b45309', '#78350f', 'Terracotta Pot', [1, 1], 0.78, anisotropy));
  const leafMat = m.trackMat(createFabricMaterial('#15803d', 'Plant Foliage', 0.65));

  // Main Ground Floor (36 x 32)
  m.addBox(36, 0.2, 32, 0, -0.2, 0, oakFloor, { collide: true, walkableTop: true, castShadow: false });
  // Kitchen & Bathroom tiled zones (+0.02 Y offset to avoid Z-fighting)
  m.addBox(11, 0.04, 10, -11.5, 0, -10, marbleTile, { collide: false, castShadow: false });
  m.addBox(9, 0.04, 9, 12.5, 0, -10.5, bathTile, { collide: false, castShadow: false });
  // Living room & Foyer carpets
  m.addBox(6.5, 0.03, 5.2, -10.5, 0, 5.5, crimsonRug, { collide: false, castShadow: false });
  m.addBox(5.2, 0.03, 7.0, 0, 0, 1.5, navyRug, { collide: false, castShadow: false });

  // Outer Perimeter Walls (Height 5.8m)
  const wallH = 5.8;
  m.addBox(36, wallH, 0.5, 0, 0, -15.75, foyerWall);
  m.addBox(36, wallH, 0.5, 0, 0, 15.75, foyerWall);
  m.addBox(0.5, wallH, 32, -17.75, 0, 0, foyerWall);
  m.addBox(0.5, wallH, 32, 17.75, 0, 0, foyerWall);

  // Interior Partition Walls with wide doorways for multiple routes
  // West Wing Divider (x = -6, doorways at z = -3 and z = 7)
  m.addBox(0.4, wallH, 7.5, -6, 0, -11.7, livingWall);
  m.addBox(0.4, wallH, 6.2, -6, 0, 1.8, livingWall);
  m.addBox(0.4, wallH, 5.5, -6, 0, 12.8, livingWall);
  // Kitchen-Living Divider (z = -5, x from -17.5 to -6, doorway at x = -11)
  m.addBox(4.2, wallH, 0.4, -15.4, 0, -5, foyerWall);
  m.addBox(3.5, wallH, 0.4, -7.8, 0, -5, foyerWall);

  // East Wing Divider (x = 6, doorways at z = -3 and z = 7)
  m.addBox(0.4, wallH, 7.5, 6, 0, -11.7, bedWall);
  m.addBox(0.4, wallH, 6.2, 6, 0, 1.8, bedWall);
  m.addBox(0.4, wallH, 5.5, 6, 0, 12.8, bedWall);
  // Bathroom-Bedroom Divider (z = -6, x from 6 to 17.5, doorway at x = 9.5)
  m.addBox(1.8, wallH, 0.4, 6.9, 0, -6, bathTile);
  m.addBox(5.8, wallH, 0.4, 14.6, 0, -6, bathTile);

  // Upper Balcony & Twin Staircases in Grand Foyer
  const balcY = 2.8;
  m.addBox(11.6, 0.28, 4.4, 0, balcY - 0.28, -13.3, oakFloor, { walkableTop: true });
  // Balcony railing posts & top bar
  m.addBox(11.6, 0.1, 0.14, 0, balcY + 0.9, -11.15, darkWalnut);
  for (let rx = -5.5; rx <= 5.5; rx += 1.1) {
    m.addBox(0.08, 0.9, 0.08, rx, balcY, -11.15, darkWalnut, { collide: false });
  }
  // Left & Right Stepped Staircases leading to Balcony
  for (let s = 0; s < 8; s++) {
    const sy = s * 0.35;
    const sz = -7.6 - s * 0.44;
    m.addBox(2.2, 0.35, 0.46, -4.3, sy, sz, darkWalnut, { walkableTop: true });
    m.addBox(2.2, 0.35, 0.46, 4.3, sy, sz, darkWalnut, { walkableTop: true });
  }
  // Decorative balustrade crates/vases on balcony
  m.addBox(0.9, 0.9, 0.9, -1.8, balcY, -14.6, lightPine, { walkableTop: true });
  m.addBox(0.75, 0.75, 0.75, 2.2, balcY, -14.5, lightPine, { walkableTop: true });
  m.addPottedPlant(0, balcY, -14.8, potMat, leafMat, 0.95);

  // === LIVING ROOM (West-South: x -17..-6, z -4..15) ===
  m.addSofa(-11.5, 4.2, 0, velvetSofa, darkWalnut);
  m.addSofa(-14.3, 6.8, Math.PI / 2, tealSofa, darkWalnut);
  m.addTable(1.8, 0.55, 1.0, -11.5, 0, 6.5, darkWalnut); // Coffee table (hide under/behind)
  // Stone Fireplace on West wall
  m.addBox(1.2, 2.6, 3.2, -16.9, 0, 6.5, stoneBrick, { walkableTop: true });
  m.addBox(1.4, 0.18, 3.5, -16.8, 1.7, 6.5, darkWalnut); // Mantle
  m.addWallPainting(-16.18, 2.9, 6.5, Math.PI / 2, brassMetal, '#0369a1', '#fde047');
  // Tall Bookshelves & Lamps
  m.addBox(0.65, 2.8, 2.4, -17.1, 0, 1.2, darkWalnut);
  m.addBox(0.65, 2.8, 2.4, -17.1, 0, 12.2, darkWalnut);
  m.addFloorLamp(-15.5, 0, 13.8, brassMetal, creamFabric);
  m.addPottedPlant(-7.2, 0, 13.5, potMat, leafMat, 1.15);
  m.addBox(0.95, 0.95, 0.95, -8.2, 0, 0.5, lightPine, { walkableTop: true });
  m.addBox(0.7, 0.7, 0.7, -8.2, 0.95, 0.5, lightPine, { walkableTop: true });

  // === KITCHEN (North-West: x -17..-6, z -15..-5) ===
  m.addBox(4.2, 0.95, 1.3, -11.5, 0, -10.2, darkWalnut, { walkableTop: true }); // Kitchen Island
  m.addBox(4.3, 0.08, 1.4, -11.5, 0.95, -10.2, marbleTile, { walkableTop: true });
  m.addBox(1.2, 2.3, 1.0, -16.6, 0, -14.2, steelMetal, { walkableTop: true }); // Fridge
  m.addBox(4.4, 0.95, 1.0, -12.2, 0, -14.8, lightPine, { walkableTop: true }); // Countertop
  m.addBox(1.3, 0.98, 1.05, -14.6, 0, -14.8, steelMetal, { walkableTop: true }); // Stove
  m.addChair(-10.5, 0, -8.8, Math.PI, darkWalnut, creamFabric);
  m.addChair(-12.5, 0, -8.8, Math.PI, darkWalnut, creamFabric);
  m.addBox(0.85, 0.85, 0.85, -7.2, 0, -14.4, lightPine, { walkableTop: true });

  // === DINING ROOM (North-Center / East Foyer: x -5..5, z -9..-3) ===
  m.addTable(3.6, 0.82, 1.6, 0, 0, -3.6, darkWalnut);
  [-1.1, 0, 1.1].forEach((ox) => {
    m.addChair(ox, 0, -2.5, Math.PI, darkWalnut, velvetSofa);
    m.addChair(ox, 0, -4.7, 0, darkWalnut, velvetSofa);
  });
  m.addWallPainting(-1.8, 2.6, -15.42, 0, brassMetal, '#7c2d12', '#fbbf24');
  m.addWallPainting(1.8, 2.6, -15.42, 0, brassMetal, '#14532d', '#a7f3d0');

  // === MASTER BEDROOM (East-South: x 6..17, z -5..15) ===
  // Four-poster Bed (space underneath + headboard)
  m.addBox(2.8, 0.25, 3.4, 13.8, 0.35, 5.2, creamFabric, { walkableTop: true });
  m.addBox(2.9, 1.5, 0.25, 13.8, 0, 6.9, darkWalnut);
  m.addBox(0.14, 2.2, 0.14, 12.45, 0, 3.55, darkWalnut);
  m.addBox(0.14, 2.2, 0.14, 15.15, 0, 3.55, darkWalnut);
  m.addBox(0.14, 2.2, 0.14, 12.45, 0, 6.85, darkWalnut);
  m.addBox(0.14, 2.2, 0.14, 15.15, 0, 6.85, darkWalnut);
  // Wardrobe & Vanity Desk
  m.addBox(1.1, 2.6, 2.2, 16.8, 0, 0.5, darkWalnut);
  m.addTable(1.8, 0.78, 0.85, 11.2, 0, 13.8, lightPine);
  m.addChair(11.2, 0, 12.8, 0, darkWalnut, tealSofa);
  m.addSofa(9.2, 4.5, Math.PI / 2, tealSofa, darkWalnut);
  m.addFloorLamp(16.6, 0, 7.6, brassMetal, creamFabric);
  m.addWallPainting(17.42, 2.4, 5.2, -Math.PI / 2, brassMetal, '#581c87', '#f472b6');

  // === BATHROOM (North-East: x 6..17, z -15..-6) ===
  // Tub walls (hollow interior feel with raised sides)
  m.addBox(2.4, 0.68, 1.35, 15.2, 0, -13.8, creamFabric, { walkableTop: true });
  m.addBox(2.2, 0.9, 0.85, 12.0, 0, -14.8, marbleTile, { walkableTop: true });
  m.addPottedPlant(7.2, 0, -14.5, potMat, leafMat, 0.85);
  m.addBox(0.9, 1.9, 0.8, 16.7, 0, -8.5, lightPine);

  // === SEEKER WAITING VESTIBULE (South Center: x -4..4, z 11..15) ===
  m.addBox(8.4, 0.12, 4.0, 0, 0, 13.2, marbleTile, { collide: false });
  m.addSofa(-2.2, 13.5, Math.PI / 2, velvetSofa, darkWalnut);
  m.addSofa(2.2, 13.5, -Math.PI / 2, velvetSofa, darkWalnut);
  m.addPottedPlant(-4.8, 0, 14.5, potMat, leafMat, 1.0);
  m.addPottedPlant(4.8, 0, 14.5, potMat, leafMat, 1.0);

  return {
    id: 'mansion',
    name: 'Hide & Seek Mansion',
    group: m.group,
    colliders: m.colliders,
    paintableSurfaces: m.paintableSurfaces,
    hiderSpawns: [
      new THREE.Vector3(-11.5, 0.05, 1.5),
      new THREE.Vector3(-12.5, 0.05, -12.0),
      new THREE.Vector3(11.0, 0.05, 1.5),
      new THREE.Vector3(11.5, 0.05, -10.5),
      new THREE.Vector3(0, balcY + 0.05, -13.2),
      new THREE.Vector3(-9.5, 0.05, 11.5),
      new THREE.Vector3(10.5, 0.05, 10.5),
      new THREE.Vector3(0, 0.05, -0.5),
    ],
    seekerSpawns: [
      new THREE.Vector3(0, 0.05, 13.2),
      new THREE.Vector3(-1.2, 0.05, 13.2),
      new THREE.Vector3(1.2, 0.05, 13.2),
      new THREE.Vector3(0, 0.05, 12.0),
    ],
    waitingAreaCenter: new THREE.Vector3(0, 0.05, 13.2),
    observationLineupOrigin: new THREE.Vector3(0, 0.05, 3.0),
    bounds: { minX: -17.2, maxX: 17.2, minZ: -15.2, maxZ: 15.2 },
    skyColor: 0x1e2436,
    fogDensity: 0.012,
    dispose: () => m.dispose(),
  };
}
