-- CreateTable
CREATE TABLE "FixedCommitment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL DEFAULT 'WORK',
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedCommitment_userId_idx" ON "FixedCommitment"("userId");

-- AddForeignKey
ALTER TABLE "FixedCommitment" ADD CONSTRAINT "FixedCommitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
