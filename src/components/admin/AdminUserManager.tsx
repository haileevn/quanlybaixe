"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  adminUpdateUserAction,
  adminResetUserPasswordAction,
  adminUpdateSelfAction,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { touchInputClass } from "@/lib/utils";
import {
  Search,
  KeyRound,
  Edit2,
  Shield,
  Building2,
  X,
} from "lucide-react";

type UserItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  tenants: {
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    approvalStatus: string;
    role: string;
    branchName: string;
    disabledAt: Date | null;
  }[];
};

type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isSuperAdmin: true;
};

export function AdminUserManager({
  initialUsers,
  currentAdmin,
}: {
  initialUsers: UserItem[];
  currentAdmin: CurrentAdmin;
}) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"ALL" | "ADMIN" | "OWNER" | "STAFF">("ALL");

  // Admin Self Profile State
  const [adminName, setAdminName] = useState(currentAdmin.name);
  const [adminEmail, setAdminEmail] = useState(currentAdmin.email);
  const [adminPhone, setAdminPhone] = useState(currentAdmin.phone ?? "");
  const [adminCurrentPass, setAdminCurrentPass] = useState("");
  const [adminNewPass, setAdminNewPass] = useState("");
  const [selfPending, startSelf] = useTransition();

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editIsSuperAdmin, setEditIsSuperAdmin] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editPending, startEdit] = useTransition();

  // Quick Reset Password Modal State
  const [resettingUser, setResettingUser] = useState<UserItem | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetPending, startReset] = useTransition();

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      u.tenants.some((t) => t.tenantName.toLowerCase().includes(q));

    if (!matchSearch) return false;

    if (filterRole === "ADMIN") return u.isSuperAdmin;
    if (filterRole === "OWNER") return u.tenants.some((t) => t.role === "OWNER");
    if (filterRole === "STAFF") return u.tenants.some((t) => t.role === "STAFF" || t.role === "MANAGER");

    return true;
  });

  const handleUpdateSelf = () => {
    if (!adminName.trim()) {
      toast.error("Vui lòng nhập họ và tên");
      return;
    }
    if (!adminEmail.trim()) {
      toast.error("Vui lòng nhập email");
      return;
    }
    if (adminNewPass && adminNewPass.length < 6) {
      toast.error("Mật khẩu mới tối thiểu 6 ký tự");
      return;
    }
    if (adminNewPass && !adminCurrentPass) {
      toast.error("Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu");
      return;
    }

    startSelf(async () => {
      const res = await adminUpdateSelfAction({
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
        currentPassword: adminCurrentPass || undefined,
        newPassword: adminNewPass || undefined,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Cập nhật thông tin Admin thành công!");
      setAdminCurrentPass("");
      setAdminNewPass("");
    });
  };

  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone ?? "");
    setEditIsSuperAdmin(user.isSuperAdmin);
    setEditIsActive(user.isActive);
    setEditNewPassword("");
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    if (!editName.trim()) {
      toast.error("Vui lòng nhập họ tên");
      return;
    }
    if (!editEmail.trim()) {
      toast.error("Vui lòng nhập email");
      return;
    }
    if (editNewPassword && editNewPassword.length < 6) {
      toast.error("Mật khẩu mới tối thiểu 6 ký tự");
      return;
    }

    startEdit(async () => {
      const res = await adminUpdateUserAction({
        userId: editingUser.id,
        name: editName,
        email: editEmail,
        phone: editPhone,
        isSuperAdmin: editIsSuperAdmin,
        isActive: editIsActive,
        newPassword: editNewPassword || undefined,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success("Cập nhật người dùng thành công!");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                name: editName,
                email: editEmail,
                phone: editPhone || null,
                isSuperAdmin: editIsSuperAdmin,
                isActive: editIsActive,
              }
            : u
        )
      );
      setEditingUser(null);
    });
  };

  const handleResetPassword = () => {
    if (!resettingUser) return;
    if (resetNewPassword.length < 6) {
      toast.error("Mật khẩu mới tối thiểu 6 ký tự");
      return;
    }

    startReset(async () => {
      const res = await adminResetUserPasswordAction({
        userId: resettingUser.id,
        newPassword: resetNewPassword,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(`Đã đổi mật khẩu cho ${resettingUser.name} thành công!`);
      setResettingUser(null);
      setResetNewPassword("");
    });
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Quick Settings Card */}
      <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-orange-50/30 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-amber-900 font-bold mb-3">
          <Shield className="h-5 w-5 text-amber-600" />
          <h2>Tài khoản Quản trị viên (Super Admin)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700">Tên hiển thị</label>
            <input
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className={touchInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700">Email quản trị</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className={touchInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700">Số điện thoại</label>
            <input
              type="text"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="Số điện thoại liên hệ"
              className={touchInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700">Mật khẩu hiện tại</label>
            <input
              type="password"
              value={adminCurrentPass}
              onChange={(e) => setAdminCurrentPass(e.target.value)}
              placeholder="Chỉ điền khi muốn đổi mật khẩu"
              className={touchInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700">Mật khẩu mới</label>
            <input
              type="password"
              value={adminNewPass}
              onChange={(e) => setAdminNewPass(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className={touchInputClass}
            />
          </div>
        </div>

        <Button
          type="button"
          disabled={selfPending}
          onClick={handleUpdateSelf}
          className="rounded-xl bg-[#0F4C5C] text-white px-5 py-2.5 font-semibold text-sm hover:bg-[#0c3c49]"
        >
          {selfPending ? "Đang lưu..." : "Lưu thông tin Admin"}
        </Button>
      </section>

      {/* User Management Section */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Quản lý người dùng & phân quyền</h2>
            <p className="text-xs text-neutral-500">
              Tổng cộng {users.length} tài khoản trong hệ thống
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            <button
              onClick={() => setFilterRole("ALL")}
              className={`rounded-lg px-3 py-1.5 transition ${
                filterRole === "ALL" ? "bg-[#0F4C5C] text-white" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
              }`}
            >
              Tất cả ({users.length})
            </button>
            <button
              onClick={() => setFilterRole("ADMIN")}
              className={`rounded-lg px-3 py-1.5 transition ${
                filterRole === "ADMIN" ? "bg-amber-600 text-white" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
              }`}
            >
              Admin ({users.filter((u) => u.isSuperAdmin).length})
            </button>
            <button
              onClick={() => setFilterRole("OWNER")}
              className={`rounded-lg px-3 py-1.5 transition ${
                filterRole === "OWNER" ? "bg-[#0F4C5C] text-white" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
              }`}
            >
              Chủ bãi ({users.filter((u) => u.tenants.some((t) => t.role === "OWNER")).length})
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, số điện thoại, tên bãi xe..."
            className={touchInputClass + " pl-10"}
          />
        </div>

        {/* Users List */}
        <div className="space-y-2.5">
          {filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
              Không tìm thấy người dùng nào phù hợp.
            </div>
          ) : (
            filteredUsers.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-sm transition hover:border-neutral-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 font-bold text-[#0F4C5C]">
                      {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-neutral-900">{u.name}</span>
                        {u.isSuperAdmin && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            Super Admin
                          </span>
                        )}
                        {!u.isActive && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                            Đã khóa
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-600 truncate">{u.email}</p>
                      {u.phone && <p className="text-xs text-neutral-500">{u.phone}</p>}

                      {u.tenants.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {u.tenants.map((t) => (
                            <span
                              key={t.tenantId}
                              className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-700"
                            >
                              <Building2 className="h-3 w-3 text-neutral-400" />
                              {t.tenantName} ({t.role})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      title="Sửa thông tin & Mật khẩu"
                      className="rounded-lg border border-neutral-200 p-2 text-neutral-700 hover:bg-neutral-100 transition"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResettingUser(u);
                        setResetNewPassword("");
                      }}
                      title="Đặt lại mật khẩu nhanh"
                      className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-700 hover:bg-amber-100 transition"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Modal Sửa Thông Tin User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-neutral-900 text-base">
                Sửa thông tin: {editingUser.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Họ và tên</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={touchInputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className={touchInputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Số điện thoại</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Để trống nếu không có"
                  className={touchInputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  Đặt lại mật khẩu mới (Tùy chọn)
                </label>
                <input
                  type="password"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Để trống nếu không muốn đổi mật khẩu"
                  className={touchInputClass}
                />
              </div>

              <div className="pt-2 border-t border-neutral-100 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsSuperAdmin}
                    onChange={(e) => setEditIsSuperAdmin(e.target.checked)}
                    className="h-4 w-4 rounded text-[#0F4C5C] focus:ring-[#0F4C5C]"
                  />
                  Quyền Quản trị viên cao cấp (Super Admin)
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="h-4 w-4 rounded text-[#0F4C5C] focus:ring-[#0F4C5C]"
                  />
                  Tài khoản đang hoạt động (Bỏ tick để khóa)
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
                className="w-1/2 rounded-xl"
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={editPending}
                onClick={handleSaveUser}
                className="w-1/2 rounded-xl bg-[#0F4C5C] text-white hover:bg-[#0c3c49]"
              >
                {editPending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset Password Nhanh */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2 text-amber-700 font-bold">
                <KeyRound className="h-5 w-5" />
                <h3>Đặt lại mật khẩu</h3>
              </div>
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Đang đặt mật khẩu mới cho tài khoản: <strong>{resettingUser.email}</strong> ({resettingUser.name})
            </p>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Mật khẩu mới</label>
              <input
                type="text"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                className={touchInputClass}
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResettingUser(null)}
                className="w-1/2 rounded-xl"
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={resetPending}
                onClick={handleResetPassword}
                className="w-1/2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 font-semibold"
              >
                {resetPending ? "Đang lưu..." : "Đổi mật khẩu"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
