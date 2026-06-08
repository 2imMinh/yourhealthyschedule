// src/app/api/schedule/blocks/[blockId]/route.ts
// PATCH /api/schedule/blocks/:blockId  { startTime, endTime }  (ISO datetimes)
// Lets the user manually adjust the start/end time of a scheduled activity.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok, notFound, badRequest } from "@/lib/api-response";

const bodySchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { blockId } = await params;
    const input = bodySchema.parse(await req.json());

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    if (end.getTime() <= start.getTime()) {
      throw badRequest("End time must be after start time.");
    }

    // Ownership check via the parent schedule.
    const block = await prisma.scheduleBlock.findFirst({
      where: { id: blockId, schedule: { userId: user.id } },
    });
    if (!block) throw notFound("Schedule block not found");

    const updated = await prisma.scheduleBlock.update({
      where: { id: blockId },
      data: { startTime: start, endTime: end, isFixed: true },
    });

    return ok(updated);
  });
}
