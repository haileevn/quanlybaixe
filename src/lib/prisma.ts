import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function isFreshClient(client: PrismaClient | undefined) {
  return Boolean(
    client &&
      "planAddon" in client &&
      (client as { planAddon?: unknown }).planAddon &&
      "collectIntent" in client &&
      (client as { collectIntent?: unknown }).collectIntent,
  );
}

export const prisma = isFreshClient(globalForPrisma.prisma)
  ? (globalForPrisma.prisma as PrismaClient)
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
