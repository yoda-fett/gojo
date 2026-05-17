-- Story 12.7f: RateMultiplier model — seasonal / channel multipliers.
CREATE TABLE "rate_multipliers" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "multiplier" DECIMAL(6,4) NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "channel" TEXT,
    "room_type_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    CONSTRAINT "rate_multipliers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rate_multipliers_property_id_type_idx" ON "rate_multipliers"("property_id", "type");
