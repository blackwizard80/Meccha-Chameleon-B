import { MapId } from '../../types/game';
import { buildIndoorCountryMap } from './IndoorCountryMap';
import { buildMansionMap } from './MansionMap';
import { BuiltMap } from './MapTypes';
import { buildSewerMap } from './SewerMap';

export interface MapMetadata {
  id: MapId;
  name: string;
  subtitle: string;
  palette: [string, string, string];
  highlights: string[];
}

export const MAP_CATALOG: MapMetadata[] = [
  {
    id: 'mansion',
    name: 'Hide & Seek Mansion',
    subtitle: 'Grand foyer, living room, kitchen, dining hall & twin staircases',
    palette: ['#7c4d2b', '#881337', '#6d8b74'],
    highlights: ['Under-table & behind-sofa spots', 'Upper balcony overlook', '6 themed rooms'],
  },
  {
    id: 'indoor_country',
    name: 'Indoor Country',
    subtitle: 'Timber lodge, hearth kitchen, storage barn & hayloft',
    palette: ['#a47148', '#c26d4a', '#d9a441'],
    highlights: ['Hay bale & crate stacks', 'Mezzanine loft', '4 distinct floor materials'],
  },
  {
    id: 'sewer',
    name: 'Underground Sewer',
    subtitle: 'Vaulted concrete tunnels, water canal, pipes & metal catwalks',
    palette: ['#4d6b57', '#0f766e', '#ca8a04'],
    highlights: ['Elevated grate walkways', 'Drainage culverts', 'Chemical drum clusters'],
  },
];

export function buildMap(mapId: MapId, anisotropy = 4): BuiltMap {
  switch (mapId) {
    case 'indoor_country':
      return buildIndoorCountryMap(anisotropy);
    case 'sewer':
      return buildSewerMap(anisotropy);
    case 'mansion':
    default:
      return buildMansionMap(anisotropy);
  }
}
