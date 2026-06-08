// src/app/api/recommendations/substitutions/route.ts
// POST /api/recommendations/substitutions  (premium)
// Body: { minutesShort, activities: [{type,title,minutes}] }
// Returns AI (or fallback) substitution suggestions to reclaim time.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, isPremium } from "@/server/auth/current-user";
import { handle, ok, premiumRequired } from "@/lib/api-response";
import { suggestSubstitutions } from "@/server/services/ai.service";

const bodySchema = z.object({
  minutesShort: z.number().int().min(0).max(24 * 60),
  activities: z
    .array(
      z.object({
        type: z.string().max(40),
        title: z.string().max(120),
        minutes: z.number().int().min(0).max(24 * 60),
      }),
    )
    .max(20),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!isPremium(user)) throw premiumRequired("Substitution suggestions are premium.");
    const ctx = bodySchema.parse(await req.json());
    const suggestions = await suggestSubstitutions(ctx);
    return ok({ suggestions });
  });
}
