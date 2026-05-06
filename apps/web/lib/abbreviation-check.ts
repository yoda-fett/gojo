const BANNED_ABBREVIATIONS = ['Occ %', 'Occ.', 'RevPAR', 'F&B', 'OOO rooms', 'RNA'];

export function checkHotelAbbreviations(text: string) {
  return BANNED_ABBREVIATIONS.filter((entry) => text.includes(entry));
}
