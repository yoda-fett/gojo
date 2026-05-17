-- AlterTable
ALTER TABLE "catalog_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "consumable_write_offs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_restocks" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "laundry_logs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "linen_arrivals" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "linen_write_offs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "default_check_in_time" VARCHAR(5),
ADD COLUMN     "default_check_out_time" VARCHAR(5),
ADD COLUMN     "number_of_floors" INTEGER;

-- AlterTable
ALTER TABLE "room_consumable_states" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "room_linen_states" ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "consumable_write_offs_property_id_catalog_item_id_recorded_at_i" RENAME TO "consumable_write_offs_property_id_catalog_item_id_recorded__idx";

-- RenameIndex
ALTER INDEX "notification_logs_reservation_channel_key" RENAME TO "notification_logs_reservation_id_channel_key";

-- RenameIndex
ALTER INDEX "room_blocks_room_id_start_end_idx" RENAME TO "room_blocks_room_id_start_date_end_date_idx";

-- RenameIndex
ALTER INDEX "upi_settlement_reconciliations_date_property_key" RENAME TO "upi_settlement_reconciliations_date_property_id_key";

-- RenameIndex
ALTER INDEX "webhook_events_channel_provider_event_key" RENAME TO "webhook_events_channel_id_provider_event_id_key";

-- RenameIndex
ALTER INDEX "webhook_events_channel_status_idx" RENAME TO "webhook_events_channel_id_processing_status_idx";

-- RenameIndex
ALTER INDEX "webhook_events_property_received_idx" RENAME TO "webhook_events_property_id_received_at_idx";
