-- Story 12.7g: ceilingRate removed entirely. Floor rate is the sole rate bound.
ALTER TABLE "room_types" DROP COLUMN IF EXISTS "ceiling_rate";
