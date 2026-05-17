export type InventoryBand = 'HEALTHY' | 'LOW' | 'EMPTY';

/** Band thresholds per story 11.3 / Section 8.1 */
export function bandForInStorage(inStorage: number, totalOwned: number): InventoryBand {
  if (inStorage <= 0) return 'EMPTY';
  const lowCeiling = Math.max(1, Math.ceil(totalOwned * 0.2));
  if (inStorage <= lowCeiling) return 'LOW';
  return 'HEALTHY';
}

export function bandLabel(band: InventoryBand): string {
  if (band === 'EMPTY') return 'Empty';
  if (band === 'LOW') return 'Low';
  return 'Healthy';
}
