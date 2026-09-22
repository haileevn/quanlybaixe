import { getVehicle } from "@/services/vehicle.service";
import type { TenantClient } from "@/lib/prisma-tenant";

export async function getActiveVehicleContract(db: TenantClient, vehicleId: string) {
  const vehicle = await getVehicle(db, vehicleId);
  return vehicle.contracts[0] ?? null;
}
