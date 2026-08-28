import { prisma } from "@/lib/prisma";

/**
 * Settings is a singleton row — id is always the literal string "global"
 * (schema.prisma: `id String @id @default("global")`). upsert() with an
 * empty `update` means: create it with schema defaults on first read if
 * it doesn't exist yet, otherwise return it unchanged. This lets Part 7
 * (and anything else that needs a platform-fee/GST rate before Part 10's
 * admin settings UI exists) read sane defaults today, while Part 10 only
 * ever needs to UPDATE this row — never seed or race to create it.
 */
export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
}