export const PREDEFINED_LOCATIONS = [
  'Saint-Victor',
  'Moulins',
  'Vichy',
  'Saint-Pourçain',
] as const;

export type PredefinedLocation = typeof PREDEFINED_LOCATIONS[number] | 'autre';
