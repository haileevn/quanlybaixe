"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext } from "@/lib/session";
import { canDelete, canEditPrice, canEditVehicle } from "@/lib/rbac";
import { vehicleFormSchema } from "@/lib/validators/business";
import {
  createVehicle,
  findVehicleByPlateDetailed,
  getVehicle,
  importVehiclesFromRows,
  listDeletedVehicles,
  listVehicles,
  restoreVehicle,
  softDeleteVehicle,
  updateVehicle,
  type VehicleInput,
} from "@/services/vehicle.service";
import { listVehiclePayments } from "@/services/transaction.service";
import { toNumber } from "@/lib/money";
import { daysUntil, formatVnDate, toVn } from "@/lib/datetime";
import { normalizePlate } from "@/lib/plate";
import {
  checkAndRecordPlateScan,
  getPlateScanQuota,
  type PlateScanQuotaInfo,
} from "@/services/scan-limit.service";

export type { PlateScanQuotaInfo };

export type VehicleContractDetail = {
  id: string;
  monthlyPrice: number;
  startDate: string;
  startDateFormatted: string;
  cycle: string;
  status: string;
  nextDueDate: string | null;
  nextDueDateFormatted: string;
  monthsSent: number;
  daysRemaining: number;
  dueStatus: "VALID" | "DUE_SOON" | "OVERDUE" | "TAM_NGUNG" | "DA_NGHI";
};

export type VehicleLookupResult =
  | {
      found: true;
      quota?: PlateScanQuotaInfo;
      vehicle: {
        id: string;
        plateNumber: string;
        vehicleType: string;
        ownerName: string;
        phone: string;
        roomOrAddress: string;
        note: string;
        imageUrl: string | null;
        contract: VehicleContractDetail | null;
        payments: {
          id: string;
          amount: number;
          dueDate: string;
          paidAt: string;
          paidAtFormatted: string;
          method: "TIEN_MAT" | "CHUYEN_KHOAN";
        }[];
      };
    }
  | {
      found: false;
      plateNumber: string;
      message: string;
      quota?: PlateScanQuotaInfo;
    };

export async function getPlateScanQuotaAction(): Promise<ActionResult<PlateScanQuotaInfo>> {
  try {
    const { user } = await getTenantContext();
    const quota = await getPlateScanQuota(user.tenantId);
    return ok(quota);
  } catch (error) {
    return fail(error);
  }
}

export async function recordPlateScanAction(): Promise<ActionResult<PlateScanQuotaInfo>> {
  try {
    const { user } = await getTenantContext();
    const quota = await checkAndRecordPlateScan(user.tenantId);
    return ok(quota);
  } catch (error) {
    return fail(error);
  }
}

export async function lookupVehicleByPlateAction(
  plateInput: string,
  recordScan = true,
): Promise<ActionResult<VehicleLookupResult>> {
  try {
    const cleanPlate = normalizePlate(plateInput);
    if (!cleanPlate) {
      return ok({
        found: false,
        plateNumber: plateInput,
        message: "Chưa nhận diện được biển số xe.",
      });
    }

    const { db, user } = await getTenantContext();

    let quota: PlateScanQuotaInfo | undefined;
    if (recordScan) {
      quota = await checkAndRecordPlateScan(user.tenantId);
    }

    const row = await findVehicleByPlateDetailed(db, cleanPlate);

    if (!row) {
      return ok({
        found: false,
        plateNumber: cleanPlate,
        message: "Xe không đăng ký trong bãi.",
        quota,
      });
    }

    const contract = row.contracts[0] ?? null;
    const payments = await listVehiclePayments(db, row.id);

    let contractDetail: VehicleContractDetail | null = null;
    if (contract) {
      const days = daysUntil(contract.nextDueDate);
      const monthsDiff = Math.max(
        1,
        Math.floor(toVn(new Date()).diff(toVn(contract.startDate), "month", true)) + 1,
      );

      let dueStatus: "VALID" | "DUE_SOON" | "OVERDUE" | "TAM_NGUNG" | "DA_NGHI" = "VALID";
      if (contract.status === "TAM_NGUNG" || contract.status === "DA_NGHI") {
        dueStatus = contract.status;
      } else if (days < 0) {
        dueStatus = "OVERDUE";
      } else if (days <= 3) {
        dueStatus = "DUE_SOON";
      }

      contractDetail = {
        id: contract.id,
        monthlyPrice: toNumber(contract.monthlyPrice),
        startDate: contract.startDate.toISOString(),
        startDateFormatted: formatVnDate(contract.startDate),
        cycle: contract.cycle,
        status: contract.status,
        nextDueDate: contract.nextDueDate ? contract.nextDueDate.toISOString() : null,
        nextDueDateFormatted: contract.nextDueDate ? formatVnDate(contract.nextDueDate) : "Chưa có",
        monthsSent: monthsDiff,
        daysRemaining: days,
        dueStatus,
      };
    }

    return ok({
      found: true,
      quota,
      vehicle: {
        id: row.id,
        plateNumber: row.plateNumber,
        vehicleType: row.vehicleType,
        ownerName: row.customer.name,
        phone: row.customer.phone,
        roomOrAddress: row.roomOrAddress ?? "",
        note: row.note ?? "",
        imageUrl: row.imageUrl ?? null,
        contract: contractDetail,
        payments: payments.map((inv) => ({
          id: inv.id,
          amount: toNumber(inv.totalAmount),
          dueDate: inv.dueDate.toISOString(),
          paidAt: (inv.transactions[0]?.occurredAt ?? inv.createdAt).toISOString(),
          paidAtFormatted: formatVnDate(inv.transactions[0]?.occurredAt ?? inv.createdAt),
          method: inv.transactions[0]?.method === "CHUYEN_KHOAN" ? "CHUYEN_KHOAN" : "TIEN_MAT",
        })),
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function searchVehiclesAction(search: string) {
  try {
    const { db } = await getTenantContext();
    const rows = await listVehicles(db, { search, take: 40 });
    return ok(
      rows.map((row) => ({
        id: row.id,
        plateNumber: row.plateNumber,
        vehicleType: row.vehicleType,
        ownerName: row.customer.name,
        phone: row.customer.phone,
        roomOrAddress: row.roomOrAddress,
        imageUrl: row.imageUrl,
        monthlyPrice: row.contracts[0] ? toNumber(row.contracts[0].monthlyPrice) : 0,
        nextDueDate: row.contracts[0]?.nextDueDate ?? null,
        status: row.contracts[0]?.status ?? "DANG_GUI",
      })),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function getVehicleAction(id: string) {
  try {
    const { db } = await getTenantContext();
    const row = await getVehicle(db, id);
    const contract = row.contracts[0];
    const payments = await listVehiclePayments(db, id);
    return ok({
      id: row.id,
      plateNumber: row.plateNumber,
      vehicleType: row.vehicleType,
      ownerName: row.customer.name,
      phone: row.customer.phone,
      roomOrAddress: row.roomOrAddress ?? "",
      note: row.note ?? "",
      imageUrl: row.imageUrl ?? "",
      monthlyPrice: contract ? toNumber(contract.monthlyPrice) : 0,
      startDate: contract?.startDate.toISOString() ?? "",
      cycle: contract?.cycle ?? "THANG",
      status: contract?.status ?? "DANG_GUI",
      nextDueDate: contract?.nextDueDate ?? null,
      payments: payments.map((inv) => ({
        id: inv.id,
        amount: toNumber(inv.totalAmount),
        dueDate: inv.dueDate,
        paidAt: inv.transactions[0]?.occurredAt ?? inv.createdAt,
        method: inv.transactions[0]?.method ?? "TIEN_MAT",
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

function parseVehicle(input: unknown): VehicleInput {
  return vehicleFormSchema.parse(input);
}

export async function createVehicleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) {
      throw new AppError("Bạn không được thêm xe.", "FORBIDDEN");
    }
    const data = parseVehicle(input);
    const vehicle = await createVehicle(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      data,
    );
    return ok({ id: vehicle.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateVehicleAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) {
      throw new AppError("Bạn không được sửa xe.", "FORBIDDEN");
    }
    const data = parseVehicle(input);
    await updateVehicle(
      db,
      {
        tenantId: user.tenantId,
        branchId: user.branchId,
        userId: user.id,
        canEditPrice: canEditPrice(user.role),
      },
      id,
      data,
    );
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteVehicleAction(id: string): Promise<ActionResult> {
  try {
    const { db, user } = await getTenantContext();
    if (!canDelete(user.role)) {
      throw new AppError("Bạn không được xoá xe.", "FORBIDDEN");
    }
    await softDeleteVehicle(db, { tenantId: user.tenantId, userId: user.id }, id);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function restoreVehicleAction(id: string): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canDelete(user.role)) {
      throw new AppError("Bạn không được khôi phục xe.", "FORBIDDEN");
    }
    await restoreVehicle(user.tenantId, user.id, id);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function listTrashAction() {
  try {
    const { user } = await getTenantContext();
    const rows = await listDeletedVehicles(user.tenantId);
    return ok(
      rows.map((row) => ({
        id: row.id,
        plateNumber: row.plateNumber,
        ownerName: row.customer.name,
        deletedAt: row.deletedAt,
      })),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function importVehiclesFileAction(
  formData: FormData,
): Promise<ActionResult<{ created: number; errors: string[] }>> {
  try {
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) {
      throw new AppError("Bạn không được nhập danh sách xe.", "FORBIDDEN");
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("Chưa chọn file.", "VALIDATION");
    }
    const { parseVehicleWorkbook } = await import("@/lib/excel-vehicles");
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseVehicleWorkbook(buffer, file.name);
    const result = await importVehiclesFromRows(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      rows,
    );
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
