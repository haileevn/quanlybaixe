"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateUserProfileAction, changePasswordAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";
import { User, Lock } from "lucide-react";

export function UserProfileSettings({
  user,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role?: string;
  };
}) {
  const [tab, setTab] = useState<"profile" | "password">("profile");

  // Profile Form State
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [profilePending, startProfile] = useTransition();

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, startPassword] = useTransition();

  const handleUpdateProfile = () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập họ và tên");
      return;
    }
    startProfile(async () => {
      const res = await updateUserProfileAction({ name, phone });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Cập nhật thông tin thành công!");
    });
  };

  const handleChangePassword = () => {
    if (!currentPassword) {
      toast.error("Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có tối thiểu 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    startPassword(async () => {
      const res = await changePasswordAction({ currentPassword, newPassword });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Đổi mật khẩu thành công!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  };

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
      <div className="flex border-b border-neutral-100 pb-3 gap-2">
        <button
          type="button"
          onClick={() => setTab("profile")}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
            tab === "profile"
              ? "bg-[#0F4C5C] text-white shadow-sm"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          <User className="h-4 w-4" />
          Thông tin cá nhân
        </button>
        <button
          type="button"
          onClick={() => setTab("password")}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
            tab === "password"
              ? "bg-[#0F4C5C] text-white shadow-sm"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          <Lock className="h-4 w-4" />
          Đổi mật khẩu
        </button>
      </div>

      <div className="pt-4">
        {tab === "profile" ? (
          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-500">Email đăng nhập</label>
              <input
                type="text"
                disabled
                value={user.email}
                className={touchInputClass + " bg-neutral-50 text-neutral-500 cursor-not-allowed"}
              />
              <p className="mt-1 text-[11px] text-neutral-400">Email đăng nhập không thể thay đổi trực tiếp.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Họ và tên</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập họ và tên"
                className={touchInputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Số điện thoại</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập số điện thoại"
                className={touchInputClass}
              />
            </div>

            <Button
              type="button"
              disabled={profilePending}
              onClick={handleUpdateProfile}
              className={touchBtnClass + " mt-2"}
            >
              {profilePending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Mật khẩu hiện tại</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
                className={touchInputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Mật khẩu mới</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className={touchInputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className={touchInputClass}
              />
            </div>

            <Button
              type="button"
              disabled={passwordPending}
              onClick={handleChangePassword}
              className={touchBtnClass + " mt-2"}
            >
              {passwordPending ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
