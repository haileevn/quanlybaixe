import { prisma } from "@/lib/prisma";
import type { TenantClient } from "@/lib/prisma-tenant";
import { vnStartOfDay } from "@/lib/datetime";
import { toNumber } from "@/lib/money";
import { sumTodayIncome } from "@/services/transaction.service";
import { listDueItems } from "@/services/due.service";

export async function getDashboard(db: TenantClient, tenantId: string) {
  const todayIncome = await sumTodayIncome(db);
  const start = vnStartOfDay();
  const in7 = start.add(7, "day").endOf("day").toDate();
  const items = await listDueItems(db, {
    from: start.subtract(3, "year").toDate(),
    to: in7,
  });
  const upcoming = items.filter(
    (item) => item.nextDueDate >= start.toDate() && item.nextDueDate <= in7,
  );
  const overdue = items.filter((item) => item.nextDueDate < start.toDate());
  const activeVehicles = await db.vehicle.count({
    where: {
      contracts: { some: { status: "DANG_GUI", deletedAt: null } },
    },
  });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  return {
    todayIncome: toNumber(todayIncome),
    activeVehicles,
    demoDataEnabled: tenant?.demoDataEnabled ?? false,
    upcoming,
    overdue,
  };
}
