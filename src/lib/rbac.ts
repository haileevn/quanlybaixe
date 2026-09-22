import { Role } from "@prisma/client";

export function canCollect(role: Role) {
  return role === "OWNER" || role === "MANAGER" || role === "STAFF";
}

export function canSendSms(role: Role) {
  return canCollect(role);
}

export function canEditVehicle(role: Role) {
  return role === "OWNER" || role === "MANAGER";
}

export function canEditPrice(role: Role) {
  return role === "OWNER" || role === "MANAGER";
}

export function canDelete(role: Role) {
  return role === "OWNER" || role === "MANAGER";
}

export function canManageStaff(role: Role) {
  return role === "OWNER";
}

export function canViewReports(role: Role) {
  return role === "OWNER" || role === "MANAGER";
}

export function canViewProfit(role: Role) {
  return role === "OWNER";
}

export function canRecordExpense(role: Role) {
  return role === "OWNER" || role === "MANAGER";
}

export function canManageSettings(role: Role) {
  return role === "OWNER";
}

export function isReadOnly(role: Role) {
  return role === "VIEWER";
}
