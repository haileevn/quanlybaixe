import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

const publicPaths = ["/dang-nhap", "/dang-ky", "/quen-mat-khau", "/cho-duyet", "/tra-cuu", "/thanh-toan", "/bien-lai"];

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/dang-nhap",
  },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/thanh-toan/webhook") ||
        pathname.startsWith("/api/thanh-toan/chung-tu") ||
        pathname.startsWith("/tra-cuu") ||
        pathname.startsWith("/thanh-toan") ||
        pathname.startsWith("/bien-lai") ||
        pathname.startsWith("/uploads") ||
        pathname.startsWith("/icons") ||
        pathname === "/manifest.webmanifest" ||
        pathname === "/sw.js"
      ) {
        return true;
      }
      const isPublic = publicPaths.some((path) => pathname.startsWith(path));
      if (isPublic) {
        return true;
      }
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.branchId = user.branchId;
        token.isSuperAdmin = user.isSuperAdmin;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.userId ?? "");
      session.user.tenantId = (token.tenantId as string | null) ?? null;
      session.user.role = (token.role as Role | null) ?? null;
      session.user.branchId = (token.branchId as string | null) ?? null;
      session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
      session.user.name = (token.name as string) ?? session.user.name;
      session.user.email = (token.email as string) ?? session.user.email;
      return session;
    },
  },
} satisfies NextAuthConfig;
