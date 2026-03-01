-- AlterTable
ALTER TABLE "judges" ADD COLUMN     "appointmentDate" TIMESTAMP(3),
ADD COLUMN     "barAdmissionDate" TIMESTAMP(3),
ADD COLUMN     "barAdmissionState" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "courthouseAddress" TEXT,
ADD COLUMN     "courthousePhone" TEXT,
ADD COLUMN     "division" TEXT,
ADD COLUMN     "isChiefJudge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoUrl" TEXT;
