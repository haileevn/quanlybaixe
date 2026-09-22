import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { Role } from "@prisma/client";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { readOtp } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "Mật khẩu",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) {
          return null;
        }
        return loadUserForSession(email, async (hash) =>
          argon2.verify(hash, password),
        );
      },
    }),
    Credentials({
      id: "otp",
      name: "Mã email",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "Mã", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const otp = String(credentials?.otp ?? "").trim();
        if (!email || !otp) {
          return null;
        }
        const stored = await readOtp(email);
        if (!stored || stored !== otp) {
          return null;
        }
        return loadUserForSession(email, async () => true);
      },
    }),
  ],
});

async function loadUserForSession(
  email: string,
  verify: (passwordHash: string) => Promise<boolean>,
) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userTenants: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!user || !user.isActive) {
    return null;
  }
  const valid = await verify(user.passwordHash);
  if (!valid) {
    return null;
  }
  const membership = user.userTenants[0];
  if (!user.isSuperAdmin && (!membership || membership.disabledAt)) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tenantId: membership?.tenantId ?? null,
    role: (membership?.role ?? (user.isSuperAdmin ? "SUPER_ADMIN" : null)) as Role | null,
    branchId: membership?.branchId ?? null,
    isSuperAdmin: user.isSuperAdmin,
  };
}
