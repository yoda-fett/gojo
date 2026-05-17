-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "accessible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "connecting_room_id" TEXT;
