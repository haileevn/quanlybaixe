import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createTenantClient } from "@/lib/prisma-tenant";
import { canViewProfit, canViewReports } from "@/lib/rbac";
import { nowVn } from "@/lib/datetime";
import { listDebts } from "@/services/due.service";
import {
  listCashRows,
  listInvoiceRows,
  listVehicleExport,
  monthRange,
} from "@/services/report.service";
import {
  buildCashExcel,
  buildDebtExcel,
  buildInvoiceExcel,
  buildVehicleExcel,
} from "@/lib/excel-reports";
import type { Role } from "@prisma/client";

function fileResponse(buf: Buffer, filename: string) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.tenantId || user.isSuperAdmin || !user.role) {
    return Response.json({ message: "Bạn chưa đăng nhập." }, { status: 401 });
  }
  if (!canViewReports(user.role as Role)) {
    return Response.json({ message: "Bạn không xem được báo cáo." }, { status: 403 });
  }

  const kind = request.nextUrl.searchParams.get("kind") ?? "thu-chi";
  const rawMonth = request.nextUrl.searchParams.get("month") ?? nowVn().format("YYYY-MM");
  const month = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : nowVn().format("YYYY-MM");
  const range = monthRange(month);
  const db = createTenantClient(user.tenantId);

  if (kind === "xe") {
    const rows = await listVehicleExport(db);
    return fileResponse(await buildVehicleExcel(rows), `xe-thang-${month}.xlsx`);
  }
  if (kind === "cong-no") {
    const rows = await listDebts(db);
    return fileResponse(await buildDebtExcel(rows), `cong-no-${month}.xlsx`);
  }
  if (kind === "hoa-don") {
    if (!canViewProfit(user.role as Role)) {
      return Response.json({ message: "Chỉ chủ bãi xuất hoá đơn." }, { status: 403 });
    }
    const rows = await listInvoiceRows(db, range.start, range.end);
    return fileResponse(await buildInvoiceExcel(rows), `hoa-don-${month}.xlsx`);
  }
  if (!canViewProfit(user.role as Role)) {
    return Response.json({ message: "Chỉ chủ bãi xuất sổ thu chi." }, { status: 403 });
  }
  const rows = await listCashRows(db, range.start, range.end);
  return fileResponse(await buildCashExcel(rows), `thu-chi-${month}.xlsx`);
}
