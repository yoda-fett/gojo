-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "contact_email" VARCHAR(120),
ADD COLUMN     "contact_phone" VARCHAR(20),
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
ADD COLUMN     "pan" VARCHAR(10),
ADD COLUMN     "state_code" VARCHAR(2),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
