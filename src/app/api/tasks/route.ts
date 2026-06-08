// src/app/api/tasks/route.ts
// GET  /api/tasks       -> list current user's tasks (cursor paginated)
// POST /api/tasks       -> create a task
//
// Handlers stay thin: authenticate -> validate -> Prisma -> ok(). All error
// handling is delegated to handle(); all DB access is scoped to the user.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok } from "@/lib/api-response";
import { createTaskSchema, listTasksQuerySchema } from "@/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();

    const { status, cursor, limit } = listTasksQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const tasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      take: limit + 1, // fetch one extra to detect the next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = tasks.length > limit;
    const page = hasMore ? tasks.slice(0, limit) : tasks;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    return ok({ tasks: page, nextCursor });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();

    const input = createTaskSchema.parse(await req.json());

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: input.title,
        description: input.description,
        estimatedMinutes: input.estimatedMinutes,
        remainingMinutes: input.estimatedMinutes, // starts equal to estimate
        deadline: input.deadline,
        priority: input.priority,
        isSplittable: input.isSplittable,
      },
    });

    return ok(task, { status: 201 });
  });
}
