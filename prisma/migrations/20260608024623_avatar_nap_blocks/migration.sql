-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'NAP';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "birthDate" DATE,
ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "napEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "napMinutes" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "wakeTime" SET DEFAULT '06:30',
ALTER COLUMN "sleepTime" SET DEFAULT '22:30',
ALTER COLUMN "targetSleepHours" SET DEFAULT 8.0,
ALTER COLUMN "mealTimes" SET DEFAULT '["06:30","11:30","19:00"]';
