"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createStaffAction,
  resetStaffPasswordAction,
  toggleStaffAction,
} from "@/actions/staff";
import { PlanLimitDialog } from "@/components/layout/PlanLimitDialog";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  disabled: boolean;
  isOwner: boolean;
};

export function StaffManager({ rows }: { rows: StaffRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"MANAGER" | "STAFF" | "VIEWER">("STAFF");
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl bg-white p-4">
        <h2 className="text-lg font-bold">Thêm người</h2>
        <input className={touchInputClass} placeholder="Họ tên" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={touchInputClass} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={touchInputClass} type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
        <select className={touchInputClass} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="STAFF">Nhân viên — chỉ thu tiền</option>
          <option value="MANAGER">Quản lý — thêm/sửa xe, thu tiền</option>
          <option value="VIEWER">Người xem — chỉ xem</option>
        </select>
        <Button
          className={touchBtnClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await createStaffAction({ name, email, password, role });
              if (!result.ok) {
                if (result.code === "PLAN_LIMIT") {
                  setLimitMessage(result.message);
                  setLimitOpen(true);
                  return;
                }
                toast.error(result.message);
                return;
              }
              toast.success("Đã tạo tài khoản.");
              setName("");
              setEmail("");
              setPassword("");
              router.refresh();
            })
          }
        >
          Tạo tài khoản
        </Button>
      </div>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-white p-4">
            <p className="text-lg font-bold">{row.name}</p>
            <p className="text-sm text-neutral-600">{row.email}</p>
            <p className="text-sm font-semibold">{row.roleLabel}</p>
            {row.isOwner ? null : (
              <div className="mt-3 space-y-2">
                <Button
                  variant="outline"
                  className="h-12 w-full"
                  onClick={() =>
                    start(async () => {
                      const next = window.prompt("Mật khẩu mới (tối thiểu 8 ký tự)");
                      if (!next) return;
                      const result = await resetStaffPasswordAction(row.id, next);
                      if (!result.ok) toast.error(result.message);
                      else toast.success("Đã đặt lại mật khẩu.");
                    })
                  }
                >
                  Đặt lại mật khẩu
                </Button>
                <Button
                  variant={row.disabled ? "default" : "destructive"}
                  className="h-12 w-full"
                  onClick={() =>
                    start(async () => {
                      const result = await toggleStaffAction(row.id, !row.disabled);
                      if (!result.ok) toast.error(result.message);
                      else {
                        toast.success(row.disabled ? "Đã mở lại." : "Đã khoá.");
                        router.refresh();
                      }
                    })
                  }
                >
                  {row.disabled ? "Mở khoá" : "Khoá tài khoản"}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <PlanLimitDialog open={limitOpen} message={limitMessage} onOpenChange={setLimitOpen} />
    </div>
  );
}
