import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTenantClient } from "@/lib/prisma-tenant";
import { AppError } from "@/lib/errors";
import { parseEnabledModules, type EnabledModules } from "@/lib/modules";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: Role;
  branchId: string;
  isSuperAdmin: boolean;
};

export async function requireUser() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    redirect("/dang-nhap");
  }
  if (user.isSuperAdmin) {
    redirect("/admin");
  }
  if (!user.tenantId || !user.role) {
    redirect("/dang-nhap");
  }
  const membership = await prisma.userTenant.findFirst({
    where: {
      userId: user.id,
      tenantId: user.tenantId,
      deletedAt: null,
    },
  });
  if (!membership || membership.disabledAt) {
    redirect("/dang-nhap");
  }
  const branchId = membership.branchId ?? user.branchId;
  if (!branchId) {
    throw new AppError("Tài khoản chưa gắn bãi xe.", "VALIDATION");
  }
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name ?? "",
    tenantId: user.tenantId,
    role: membership.role,
    branchId,
    isSuperAdmin: user.isSuperAdmin,
  } satisfies SessionUser;
}

export async function getTenantContext() {
  const user = await requireUser();
  return {
    user,
    db: createTenantClient(user.tenantId),
  };
}

export async function requireEnabledModule(key: keyof EnabledModules) {
  const ctx = await getTenantContext();
  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.user.tenantId, deletedAt: null },
  });
  const modules = parseEnabledModules(tenant?.enabledModules);
  if (!modules[key]) {
    redirect("/");
  }
  return { ...ctx, modules };
}

export async function requireSuperAdmin() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    redirect("/dang-nhap");
  }
  if (!user.isSuperAdmin) {
    redirect("/");
  }
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name ?? "",
    isSuperAdmin: true as const,
  };
}
