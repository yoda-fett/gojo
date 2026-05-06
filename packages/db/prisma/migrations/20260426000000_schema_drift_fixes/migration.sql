-- AlterTable
ALTER TABLE "alerts" ALTER COLUMN "dismissed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "resolved_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cancellation_policies" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "folio_lines" ALTER COLUMN "reversed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "posted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "folios" ALTER COLUMN "settled_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "guests" ALTER COLUMN "consent_given_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "idempotency_keys" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "otp_sessions" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "invalidated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "properties" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "property_access" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "invited_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rate_plans" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reservations" ALTER COLUMN "check_in" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "check_out" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "cancelled_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "no_show_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "room_types" ALTER COLUMN "amenities" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rooms" ALTER COLUMN "hold_expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "state_divergence_events" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "trial_started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "trial_ends_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "webhook_secrets" ALTER COLUMN "active_from" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "active_until" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- RenameIndex
ALTER INDEX "alerts_property_entity_idx" RENAME TO "alerts_property_id_entity_id_idx";

-- RenameIndex
ALTER INDEX "alerts_property_status_created_idx" RENAME TO "alerts_property_id_status_created_at_idx";

-- RenameIndex
ALTER INDEX "audit_logs_entity_idx" RENAME TO "audit_logs_entity_type_entity_id_idx";

-- RenameIndex
ALTER INDEX "audit_logs_property_created_idx" RENAME TO "audit_logs_property_id_created_at_idx";

-- RenameIndex
ALTER INDEX "cancellation_policies_property_idx" RENAME TO "cancellation_policies_property_id_idx";

-- RenameIndex
ALTER INDEX "folio_lines_folio_gst_idx" RENAME TO "folio_lines_folio_id_gst_slab_idx";

-- RenameIndex
ALTER INDEX "folio_lines_folio_posted_idx" RENAME TO "folio_lines_folio_id_posted_at_idx";

-- RenameIndex
ALTER INDEX "folios_property_status_idx" RENAME TO "folios_property_id_status_idx";

-- RenameIndex
ALTER INDEX "guests_property_phone_idx" RENAME TO "guests_property_id_phone_idx";

-- RenameIndex
ALTER INDEX "idempotency_keys_status_updated_idx" RENAME TO "idempotency_keys_status_updated_at_idx";

-- RenameIndex
ALTER INDEX "otp_sessions_phone_created_idx" RENAME TO "otp_sessions_phone_created_at_idx";

-- RenameIndex
ALTER INDEX "property_access_property_role_idx" RENAME TO "property_access_property_id_role_idx";

-- RenameIndex
ALTER INDEX "rate_plans_property_room_type_idx" RENAME TO "rate_plans_property_id_room_type_id_idx";

-- RenameIndex
ALTER INDEX "refresh_tokens_property_user_idx" RENAME TO "refresh_tokens_property_id_user_id_idx";

-- RenameIndex
ALTER INDEX "reservations_property_booking_reference_idx" RENAME TO "reservations_property_id_booking_reference_idx";

-- RenameIndex
ALTER INDEX "reservations_property_check_in_idx" RENAME TO "reservations_property_id_check_in_idx";

-- RenameIndex
ALTER INDEX "reservations_property_check_out_idx" RENAME TO "reservations_property_id_check_out_idx";

-- RenameIndex
ALTER INDEX "reservations_property_status_idx" RENAME TO "reservations_property_id_status_idx";

-- RenameIndex
ALTER INDEX "rooms_property_hold_expires_idx" RENAME TO "rooms_property_id_hold_expires_at_idx";

-- RenameIndex
ALTER INDEX "rooms_property_state_idx" RENAME TO "rooms_property_id_state_idx";

-- RenameIndex
ALTER INDEX "state_divergence_events_property_created_idx" RENAME TO "state_divergence_events_property_id_created_at_idx";

-- RenameIndex
ALTER INDEX "subscriptions_property_status_idx" RENAME TO "subscriptions_property_id_status_idx";

-- RenameIndex
ALTER INDEX "webhook_secrets_property_provider_active_idx" RENAME TO "webhook_secrets_property_id_provider_is_active_idx";
