"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext, requireEnabledModule } from "@/lib/session";
import { canCollect, canDelete, canEditVehicle } from "@/lib/rbac";
import {
  collectTargetSchema,
  kioskFormSchema,
  rentFormSchema,
  roomFormSchema,
  utilitySchema,
} from "@/lib/validators/business";
import { formatVnd } from "@/lib/money";
import { formatVnDate } from "@/lib/datetime";
import {
  createRoom,
  deleteRoom,
  endRoomContract,
  rentRoom,
  saveUtilityAndCollect,
  updateRoom,
} from "@/services/room.service";
import { createKiosk, deleteKiosk, endKioskContract, rentKiosk, updateKiosk } from "@/services/kiosk.service";
import { collectKioskPayment, collectRoomPayment } from "@/services/transaction.service";
import { notifyReceiptByToken } from "@/services/collect.service";

export async function createRoomAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireEnabledModule("phongTro");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không thêm được phòng.", "FORBIDDEN");
    const data = roomFormSchema.parse(input);
    const row = await createRoom(db, { tenantId: user.tenantId, branchId: user.branchId, userId: user.id }, data);
    return ok({ id: row.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateRoomAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireEnabledModule("phongTro");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không sửa được phòng.", "FORBIDDEN");
    const data = roomFormSchema.parse(input);
    await updateRoom(db, { tenantId: user.tenantId, userId: user.id }, id, data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRoomAction(id: string): Promise<ActionResult> {
  try {
    await requireEnabledModule("phongTro");
    const { db, user } = await getTenantContext();
    if (!canDelete(user.role)) throw new AppError("Bạn không xoá được phòng.", "FORBIDDEN");
    await deleteRoom(db, { tenantId: user.tenantId, userId: user.id }, id);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function rentRoomAction(roomId: string, input: unknown): Promise<ActionResult> {
  try {
    await requireEnabledModule("phongTro");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không cho thuê được.", "FORBIDDEN");
    const data = rentFormSchema.parse(input);
    await rentRoom(db, { tenantId: user.tenantId, branchId: user.branchId, userId: user.id }, { ...data, roomId });
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function endRoomAction(roomId: string): Promise<ActionResult> {
  try {
    await requireEnabledModule("phongTro");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không kết thúc thuê được.", "FORBIDDEN");
    await endRoomContract(db, { tenantId: user.tenantId, userId: user.id }, roomId);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function collectRoomAction(
  input: unknown,
): Promise<ActionResult<{ amountLabel: string; nextDueLabel: string; receiptUrl?: string }>> {
  try {
    await requireEnabledModule("phongTro");
    const { db, user } = await getTenantContext();
    if (!canCollect(user.role)) throw new AppError("Bạn không được thu tiền.", "FORBIDDEN");
    const data = collectTargetSchema.parse(input);
    if (!data.roomId) throw new AppError("Thiếu phòng.", "VALIDATION");
    const result = await collectRoomPayment(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      { roomId: data.roomId, method: data.method, note: data.note, months: data.months, imageUrl: data.imageUrl },
    );
    await notifyReceiptByToken(user.tenantId, result.receiptToken, result.amount, result.nextDueDate);
    return ok({
      amountLabel: formatVnd(result.amount),
      nextDueLabel: formatVnDate(result.nextDueDate),
      receiptUrl: result.receiptToken ? `/bien-lai/${result.receiptToken}` : undefined,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function collectUtilityAction(input: unknown): Promise<ActionResult<{ amountLabel: string }>> {
  try {
    await requireEnabledModule("phongTro");
    const { db, user } = await getTenantContext();
    if (!canCollect(user.role)) throw new AppError("Bạn không được thu tiền.", "FORBIDDEN");
    const data = utilitySchema.parse(input);
    const result = await saveUtilityAndCollect(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      data,
    );
    return ok({ amountLabel: formatVnd(result.amount) });
  } catch (error) {
    return fail(error);
  }
}

export async function createKioskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireEnabledModule("matBang");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không thêm được mặt bằng.", "FORBIDDEN");
    const data = kioskFormSchema.parse(input);
    const row = await createKiosk(db, { tenantId: user.tenantId, branchId: user.branchId, userId: user.id }, data);
    return ok({ id: row.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateKioskAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireEnabledModule("matBang");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không sửa được mặt bằng.", "FORBIDDEN");
    const data = kioskFormSchema.parse(input);
    await updateKiosk(db, id, data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteKioskAction(id: string): Promise<ActionResult> {
  try {
    await requireEnabledModule("matBang");
    const { db, user } = await getTenantContext();
    if (!canDelete(user.role)) throw new AppError("Bạn không xoá được mặt bằng.", "FORBIDDEN");
    await deleteKiosk(db, { tenantId: user.tenantId, userId: user.id }, id);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function rentKioskAction(kioskId: string, input: unknown): Promise<ActionResult> {
  try {
    await requireEnabledModule("matBang");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không cho thuê được.", "FORBIDDEN");
    const data = rentFormSchema.parse(input);
    await rentKiosk(db, { tenantId: user.tenantId, branchId: user.branchId, userId: user.id }, { ...data, kioskId });
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function endKioskAction(kioskId: string): Promise<ActionResult> {
  try {
    await requireEnabledModule("matBang");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không kết thúc thuê được.", "FORBIDDEN");
    await endKioskContract(db, kioskId);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function collectKioskAction(
  input: unknown,
): Promise<ActionResult<{ amountLabel: string; nextDueLabel: string; receiptUrl?: string }>> {
  try {
    await requireEnabledModule("matBang");
    const { db, user } = await getTenantContext();
    if (!canCollect(user.role)) throw new AppError("Bạn không được thu tiền.", "FORBIDDEN");
    const data = collectTargetSchema.parse(input);
    if (!data.kioskId) throw new AppError("Thiếu mặt bằng.", "VALIDATION");
    const result = await collectKioskPayment(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      { kioskId: data.kioskId, method: data.method, note: data.note, months: data.months, imageUrl: data.imageUrl },
    );
    await notifyReceiptByToken(user.tenantId, result.receiptToken, result.amount, result.nextDueDate);
    return ok({
      amountLabel: formatVnd(result.amount),
      nextDueLabel: formatVnDate(result.nextDueDate),
      receiptUrl: result.receiptToken ? `/bien-lai/${result.receiptToken}` : undefined,
    });
  } catch (error) {
    return fail(error);
  }
}
