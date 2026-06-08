// src/app/api/profile/route.ts
// GET /api/profile  -> current user's scheduling profile
// PUT /api/profile  -> update profile (sleep/meal/exercise prefs, work blocks)
//
// The profile is the primary input to the scheduling engine, so it's validated
// strictly. The profile row is guaranteed to exist (created with the user), but
// we upsert defensively.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isPremium } from "@/server/auth/current-user";
import { handle, ok, badRequest } from "@/lib/api-response";
import { updateProfileSchema } from "@/types";
import type { Prisma } from "@prisma/client";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const profile =
      user.profile ??
      (await prisma.userProfile.create({ data: { userId: user.id } }));
    return ok(profile);
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const input = updateProfileSchema.parse(await req.json());

    // Cross-field rule the engine relies on: the floor can't exceed the target.
    if (input.minSleepHours > input.targetSleepHours) {
      throw badRequest("minSleepHours cannot exceed targetSleepHours");
    }

    // Free users are locked to a 6h minimum-sleep floor; only Premium may go 4–6h.
    if (!isPremium(user) && input.minSleepHours < 6) {
      throw badRequest("A minimum sleep below 6h requires Premium.");
    }

    // Json columns are passed through as-is; Prisma accepts numbers for Decimal.
    const data: Prisma.UserProfileUncheckedCreateInput = {
      userId: user.id,
      wakeTime: input.wakeTime,
      sleepTime: input.sleepTime,
      targetSleepHours: input.targetSleepHours,
      minSleepHours: input.minSleepHours,
      mealTimes: input.mealTimes,
      exerciseEnabled: input.exerciseEnabled,
      exerciseMinutes: input.exerciseMinutes,
      napEnabled: input.napEnabled,
      napMinutes: input.napMinutes,
      commuteMinutes: input.commuteMinutes,
      workBlocks: input.workBlocks as unknown as Prisma.InputJsonValue,
      optionalActivities: input.optionalActivities,
    };

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: data,
      update: data,
    });

    return ok(profile);
  });
}
