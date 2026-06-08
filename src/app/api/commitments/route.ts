// src/app/api/commitments/route.ts
// GET  /api/commitments  -> list the user's fixed commitments
// POST /api/commitments  -> create one
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok } from "@/lib/api-response";
import { commitmentSchema } from "@/types";

function serialize(c: {
  id: string; title: string; activityType: string; daysOfWeek: number[];
  startTime: string; endTime: string; startDate: Date; endDate: Date | null;
}) {
  return {
    id: c.id,
    title: c.title,
    activityType: c.activityType,
    daysOfWeek: c.daysOfWeek,
    startTime: c.startTime,
    endTime: c.endTime,
    startDate: c.startDate.toISOString().slice(0, 10),
    endDate: c.endDate ? c.endDate.toISOString().slice(0, 10) : "",
  };
}

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rows = await prisma.fixedCommitment.findMany({
      where: { userId: user.id },
      orderBy: { startDate: "asc" },
    });
    return ok({ commitments: rows.map(serialize) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const input = commitmentSchema.parse(await req.json());
    const row = await prisma.fixedCommitment.create({
      data: {
        userId: user.id,
        title: input.title,
        activityType: input.activityType,
        daysOfWeek: input.daysOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        startDate: new Date(`${input.startDate}T00:00:00.000Z`),
        endDate: input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : null,
      },
    });
    return ok(serialize(row));
  });
}
