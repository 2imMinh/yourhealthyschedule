// src/app/api/account/route.ts
// GET /api/account  -> { name, avatarUrl, birthDate, email }
// PUT /api/account  -> update display name, avatar URL, and date of birth.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok } from "@/lib/api-response";
import { accountSchema } from "@/types";

function ymd(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok({
      name: user.name ?? "",
      avatarUrl: user.avatarUrl ?? "",
      birthDate: ymd(user.birthDate ?? null) ?? "",
      email: user.email,
    });
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const input = accountSchema.parse(await req.json());

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.name?.trim() || null,
        avatarUrl: input.avatarUrl?.trim() || null,
        birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : null,
      },
    });

    return ok({
      name: updated.name ?? "",
      avatarUrl: updated.avatarUrl ?? "",
      birthDate: ymd(updated.birthDate ?? null) ?? "",
      email: updated.email,
    });
  });
}
