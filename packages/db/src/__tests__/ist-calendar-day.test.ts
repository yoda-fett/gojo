import { describe, expect, it } from 'vitest';

import {
  dateFromKey,
  dateKeyInTz,
  istDateKey,
  istDateFromKey,
  todayInIST,
  todayInTz,
} from '../ist-calendar-day.js';

describe('ist-calendar-day', () => {
  describe('UTC anchoring (the @db.Date regression fix)', () => {
    // The historical bug: istDateFromKey('2026-05-24') returned a Date whose
    // UTC date was '2026-05-23'. Prisma then compared yesterday's date against
    // a @db.Date column. Anchoring at UTC midnight fixes the round-trip.

    it('dateFromKey anchors at UTC midnight so the UTC date equals the key', () => {
      const d = dateFromKey('2026-05-24');
      expect(d.toISOString()).toBe('2026-05-24T00:00:00.000Z');
      expect(d.toISOString().slice(0, 10)).toBe('2026-05-24');
    });

    it('istDateFromKey produces a Date whose UTC date equals the input key', () => {
      const d = istDateFromKey('2026-05-24');
      expect(d.toISOString().slice(0, 10)).toBe('2026-05-24');
    });

    it('todayInIST round-trips: its UTC date portion equals istDateKey(now)', () => {
      const now = new Date();
      const t = todayInIST(now);
      expect(t.toISOString().slice(0, 10)).toBe(istDateKey(now));
    });
  });

  describe('IST evening boundary (the symptom that surfaced the bug)', () => {
    // 2026-05-24 17:41 IST  =  2026-05-24 12:11 UTC
    // 2026-05-24 23:00 IST  =  2026-05-24 17:30 UTC  (post-18:30 IST shift)
    // 2026-05-25 03:00 IST  =  2026-05-24 21:30 UTC  (well into the broken window)

    it('mid-day IST → IST date key matches expected IST calendar day', () => {
      const midDay = new Date('2026-05-24T12:11:00.000Z'); // 17:41 IST
      expect(istDateKey(midDay)).toBe('2026-05-24');
    });

    it('post-18:30 IST → still the same IST calendar day, NOT yesterday', () => {
      const evening = new Date('2026-05-24T17:30:00.000Z'); // 23:00 IST
      expect(istDateKey(evening)).toBe('2026-05-24');
      // The crucial assertion: the Date returned by todayInIST(...) has the
      // correct UTC date portion for Prisma @db.Date comparisons.
      expect(todayInIST(evening).toISOString().slice(0, 10)).toBe('2026-05-24');
    });

    it('past IST midnight → next IST calendar day', () => {
      const earlyMorning = new Date('2026-05-24T19:30:00.000Z'); // 01:00 IST May 25
      expect(istDateKey(earlyMorning)).toBe('2026-05-25');
      expect(todayInIST(earlyMorning).toISOString().slice(0, 10)).toBe('2026-05-25');
    });
  });

  describe('property-tz aware helpers', () => {
    it('dateKeyInTz honors arbitrary IANA timezones', () => {
      const instant = new Date('2026-05-24T12:11:00.000Z'); // 17:41 IST, 08:11 EDT, 20:11 SGT
      expect(dateKeyInTz(instant, 'Asia/Kolkata')).toBe('2026-05-24');
      expect(dateKeyInTz(instant, 'America/New_York')).toBe('2026-05-24');
      expect(dateKeyInTz(instant, 'Asia/Singapore')).toBe('2026-05-24');
    });

    it('dateKeyInTz catches the day rollover for non-IST timezones', () => {
      // 2026-05-24 23:30 UTC → 04:30 IST May 25, but only 19:30 EDT May 24
      const lateUtc = new Date('2026-05-24T23:30:00.000Z');
      expect(dateKeyInTz(lateUtc, 'Asia/Kolkata')).toBe('2026-05-25');
      expect(dateKeyInTz(lateUtc, 'America/New_York')).toBe('2026-05-24');
    });

    it('todayInTz round-trips through UTC midnight for the property tz', () => {
      const evening = new Date('2026-05-24T17:30:00.000Z'); // 23:00 IST
      const t = todayInTz('Asia/Kolkata', evening);
      expect(t.toISOString()).toBe('2026-05-24T00:00:00.000Z');
    });

    it('todayInTz with property tz = IST equals todayInIST', () => {
      const now = new Date('2026-05-24T17:30:00.000Z');
      expect(todayInTz('Asia/Kolkata', now).toISOString()).toBe(todayInIST(now).toISOString());
    });
  });
});
