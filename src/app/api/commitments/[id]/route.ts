// src/app/api/commitments/[id]/route.ts
// PATCH  -> update a commitment ; DELETE -> remove it
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok, notFound } from "@/lib/api-response";
import { commitmentSchema } from "@/types";

async function owned(userId: string, id: string) {
  return prisma.fixedCommitment.findFirst({ where: { id, userId } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    if (!(await owned(user.id, id))) throw notFound("Commitment not found");
    const input = commitmentSchema.parse(await req.json());
    const row = await prisma.fixedCommitment.update({
      where: { id },
      data: {
        title: input.title,
        activityType: input.activityType,
        daysOfWeek: input.daysOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        startDate: new Date(`${input.startDate}T00:00:00.000Z`),
        endDate: input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : null,
      },
    });
    return ok(row);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    if (!(await owned(user.id, id))) throw notFound("Commitment not found");
    await prisma.fixedCommitment.delete({ where: { id } });
    return ok({ deleted: true });
  });
}
