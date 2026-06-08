// src/app/api/checklist/[blockId]/route.ts
// POST /api/checklist/:blockId
// Marks a scheduled block COMPLETED / SKIPPED / PARTIAL. Writes the
// CompletionLog (one per block, upserted) that feeds analytics and the
// productivity model, and advances the linked task's progress.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok, notFound } from "@/lib/api-response";
import { completeBlockSchema } from "@/types";

type Params = { params: Promise<{ blockId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { blockId } = await params;
    const input = completeBlockSchema.parse(await req.json());

    // Ownership: the block must belong to one of the user's schedules.
    const block = await prisma.scheduleBlock.findFirst({
      where: { id: blockId, schedule: { userId: user.id } },
    });
    if (!block) throw notFound("Schedule block not found");

    const durationMin = Math.round(
      (block.endTime.getTime() - block.startTime.getTime()) / 60000,
    );
    const minutes = input.actualMinutes ?? durationMin;

    const completion = await prisma.$transaction(async (tx) => {
      const log = await tx.completionLog.upsert({
        where: { blockId },
        create: {
          blockId,
          userId: user.id,
          activityType: block.activityType, // denormalized for analytics
          status: input.status,
          actualMinutes: minutes,
        },
        update: {
          status: input.status,
          actualMinutes: minutes,
          completedAt: new Date(),
        },
      });

      // Advance the linked task when a task block is completed.
      if (block.taskId && input.status === "COMPLETED") {
        const task = await tx.task.findUnique({ where: { id: block.taskId } });
        if (task && task.status !== "DONE") {
          const remaining = Math.max(0, task.remainingMinutes - minutes);
          await tx.task.update({
            where: { id: task.id },
            data: {
              remainingMinutes: remaining,
              status: remaining === 0 ? "DONE" : task.status,
              completedAt: remaining === 0 ? new Date() : task.completedAt,
            },
          });
        }
      }

      return log;
    });

    return ok(completion);
  });
}
