import { requireSuperAdmin } from "@/lib/session";
import { listTenantsForAdmin } from "@/services/admin.service";
import { AdminTenantList } from "@/components/admin/AdminTenantList";

export default async function AdminTenantsPage() {
  await requireSuperAdmin();
  const rows = await listTenantsForAdmin();

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-black text-neutral-900">Quản lý bãi xe</h2>
        <p className="text-xs text-neutral-600">
          Duyệt tài khoản bãi xe đăng ký mới & theo dõi thời hạn sử dụng.
        </p>
      </div>

      <AdminTenantList rows={rows} />
    </div>
  );
}
