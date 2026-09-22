import { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string | null;
      role: Role | null;
      branchId: string | null;
      isSuperAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    tenantId: string | null;
    role: Role | null;
    branchId: string | null;
    isSuperAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    tenantId?: string | null;
    role?: Role | null;
    branchId?: string | null;
    isSuperAdmin?: boolean;
  }
}
