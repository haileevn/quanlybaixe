import { requireSuperAdmin } from "@/lib/session";
import { listUsersForAdmin } from "@/services/admin.service";
import { AdminUserManager } from "@/components/admin/AdminUserManager";

export const metadata = {
  title: "Quản lý tài khoản & Mật khẩu | Admin Quản Lý Bãi Xe",
};

export default async function AdminAccountsPage() {
  const admin = await requireSuperAdmin();
  const users = await listUsersForAdmin();

  return (
    <div className="space-y-4">
      <AdminUserManager initialUsers={users} currentAdmin={admin} />
    </div>
  );
}
