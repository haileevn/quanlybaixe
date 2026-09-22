import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function writeAudit(input: {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.before ?? Prisma.JsonNull,
      afterJson: input.after ?? Prisma.JsonNull,
    },
  });
}
