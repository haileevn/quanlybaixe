import { prisma } from "@/lib/prisma";

const TENANT_MODELS = new Set([
  "Subscription",
  "Payment",
  "UserTenant",
  "AuditLog",
  "Branch",
  "Customer",
  "Vehicle",
  "VehicleContract",
  "Room",
  "RoomContract",
  "UtilityReading",
  "Kiosk",
  "KioskContract",
  "ServiceType",
  "ServiceSubscription",
  "Charger",
  "ChargingPlan",
  "ChargingSession",
  "Invoice",
  "InvoiceItem",
  "Transaction",
  "ExpenseCategory",
  "CashbookClosing",
  "Reminder",
  "NotificationLog",
  "CollectIntent",
]);

const SOFT_DELETE_MODELS = new Set([...TENANT_MODELS, "Tenant"]);

const FILTER_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "updateMany",
  "count",
  "aggregate",
  "groupBy",
]);

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
};

function asQueryArgs(args: unknown): QueryArgs {
  return args as QueryArgs;
}

function modelDelegate(model: string) {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  return prisma[key as keyof typeof prisma] as {
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
  };
}

/**
 * Mọi truy vấn danh sách/đếm nghiệp vụ bắt buộc lọc tenantId + bản ghi chưa xoá.
 * update/delete theo id không nhét tenantId vào unique where (Prisma không cho).
 */
export function createTenantClient(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scoped = TENANT_MODELS.has(model);
          const soft = SOFT_DELETE_MODELS.has(model);
          const parsed = asQueryArgs(args);

          if (operation === "delete" && soft) {
            return modelDelegate(model).update({
              where: parsed.where,
              data: { deletedAt: new Date() },
            });
          }

          if (operation === "deleteMany" && soft) {
            const where = scoped
              ? { ...parsed.where, tenantId, deletedAt: null }
              : { ...parsed.where, deletedAt: null };
            return modelDelegate(model).updateMany({
              where,
              data: { deletedAt: new Date() },
            });
          }

          if (operation === "create" && scoped && parsed.data && !Array.isArray(parsed.data)) {
            parsed.data = { ...parsed.data, tenantId };
          }

          if (operation === "createMany" && scoped && Array.isArray(parsed.data)) {
            parsed.data = parsed.data.map((row) => ({ ...row, tenantId }));
          }

          if (scoped && parsed.where && FILTER_OPS.has(operation)) {
            parsed.where = {
              ...parsed.where,
              tenantId,
              ...(soft ? { deletedAt: parsed.where.deletedAt ?? null } : {}),
            };
          }

          if (operation === "findUnique" && scoped) {
            return modelDelegate(model).findFirst({
              where: {
                ...parsed.where,
                tenantId,
                deletedAt: null,
              },
            });
          }

          if (operation === "findUniqueOrThrow" && scoped) {
            const found = await modelDelegate(model).findFirst({
              where: {
                ...parsed.where,
                tenantId,
                deletedAt: null,
              },
            });
            if (!found) {
              throw new Error("Không tìm thấy dữ liệu.");
            }
            return found;
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof createTenantClient>;
