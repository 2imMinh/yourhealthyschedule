// src/app/api/tasks/[id]/route.ts
// PATCH  /api/tasks/:id  -> update a task (fields, status, mark done)
// DELETE /api/tasks/:id  -> soft delete
//
// Note: in Next.js 15, dynamic route `params` is a Promise and must be awaited.
// Ownership is enforced by scoping the write to { id, userId }: a user can only
// mutate their own rows, and a miss yields 404 (not a 403 that leaks existence).

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok, notFound } from "@/lib/api-response";
import { updateTaskSchema } from "@/types";
import type { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const input = updateTaskSchema.parse(await req.json());

    const data: Prisma.TaskUpdateManyMutationInput = { ...input };

    // Keep remainingMinutes consistent when the estimate changes.
    if (input.estimatedMinutes !== undefined) {
      data.remainingMinutes = input.estimatedMinutes;
    }
    // Marking done closes the task out.
    if (input.status === "DONE") {
      data.completedAt = new Date();
      data.remainingMinutes = 0;
    }

    const result = await prisma.task.updateMany({
      where: { id, userId: user.id, deletedAt: null },
      data,
    });
    if (result.count === 0) throw notFound("Task not found");

    const task = await prisma.task.findUnique({ where: { id } });
    return ok(task);
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const result = await prisma.task.updateMany({
      where: { id, userId: user.id, deletedAt: null },
      data: { deletedAt: new Date(), status: "CANCELED" },
    });
    if (result.count === 0) throw notFound("Task not found");

    return ok({ id, deleted: true });
  });
}
