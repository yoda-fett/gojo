-- Story 12.5: cold-start linen distribution support.
ALTER TABLE "properties" ADD COLUMN "cold_start_linen_deferred" BOOLEAN DEFAULT false;
ALTER TABLE "room_linen_states" ADD COLUMN "seed_source" TEXT;
