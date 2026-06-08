// prisma/seed.ts
// Dev seed: creates a demo user with a realistic profile and a few tasks so the
// app has something to schedule on first run. Run with `npm run db:seed`.
// NOTE: the demo user id won't match a real Clerk session — use this for local
// engine/API testing, not for signing in through the UI.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = process.env.SEED_USER_ID ?? "user_seed_demo";
  const email = process.env.SEED_USER_EMAIL ?? "demo@example.com";

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email,
      timezone: "America/New_York",
      profile: {
        create: {
          wakeTime: "06:30",
          sleepTime: "22:30",
          targetSleepHours: 8.0,
          minSleepHours: 6.0,
          mealTimes: ["06:30", "11:30", "19:00"],
          exerciseEnabled: true,
          exerciseMinutes: 45,
          commuteMinutes: 0,
          workBlocks: [{ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:30" }],
          optionalActivities: ["cooking", "entertainment"],
        },
      },
      subscription: { create: { tier: "FREE", status: "ACTIVE" } },
    },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const inThreeDays = new Date();
  inThreeDays.setDate(inThreeDays.getDate() + 3);

  const tasks = [
    { title: "Finish quarterly report", estimatedMinutes: 120, priority: "HIGH" as const, deadline: tomorrow },
    { title: "Study for exam — chapter 4", estimatedMinutes: 180, priority: "MEDIUM" as const, deadline: inThreeDays },
    { title: "Reply to client emails", estimatedMinutes: 30, priority: "URGENT" as const, deadline: tomorrow },
    { title: "Read research paper", estimatedMinutes: 60, priority: "LOW" as const, deadline: null },
  ];

  // Clear prior seed tasks for idempotency, then recreate.
  await prisma.task.deleteMany({ where: { userId } });
  for (const t of tasks) {
    await prisma.task.create({
      data: {
        userId,
        title: t.title,
        estimatedMinutes: t.estimatedMinutes,
        remainingMinutes: t.estimatedMinutes,
        priority: t.priority,
        deadline: t.deadline,
      },
    });
  }

  console.log(`Seeded user ${userId} with ${tasks.length} tasks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
