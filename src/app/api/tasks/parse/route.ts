// src/app/api/tasks/parse/route.ts
// POST /api/tasks/parse  { text } -> a structured task DRAFT (not saved).
// The client shows the draft for confirmation, then calls POST /api/tasks.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok } from "@/lib/api-response";
import { parseTaskFromText } from "@/server/services/ai.service";

const bodySchema = z.object({ text: z.string().min(1).max(2000) });

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(); // auth required; result isn't user-specific
    const { text } = bodySchema.parse(await req.json());
    const draft = await parseTaskFromText(text);
    return ok(draft);
  });
}
