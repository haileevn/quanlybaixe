"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/actions/auth";
import { toggleDemoAction } from "@/actions/demo";
import { restoreVehicleAction } from "@/actions/vehicles";
import { Button } from "@/components/ui/button";
import { SettingsGroup } from "@/components/layout/SettingsGroup";
import { formatVnDateTime } from "@/lib/datetime";
import { touchBtnClass } from "@/lib/utils";

function MenuRow({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint?: string;
}) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{label}</p>
        {hint ? <p className="text-sm text-neutral-500">{hint}</p> : null}
      </div>
      <ChevronRight className="size-5 shrink-0 text-neutral-400" />
    </Link>
  );
}

export function SettingsPanel({
  demoEnabled,
  isOwner,
  trash,
}: {
  demoEnabled: boolean;
  isOwner: boolean;
  showReports?: boolean;
  trash: { id: string; plateNumber: string; ownerName: string; deletedAt: Date | null }[];
  modules?: unknown;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const menu: ReactNode = (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#0F4C5C]/8">
      {isOwner ? (
        <>
          <MenuRow href="/nhan-vien" label="Nhân viên" hint="Thêm người trực, phân quyền" />
          <div className="mx-4 h-px bg-[#0F4C5C]/8" />
        </>
      ) : null}
      <MenuRow href="/goi-dich-vu" label="Gói đang dùng" hint="Gia hạn, thêm dịch vụ, quét QR" />
      <div className="mx-4 h-px bg-[#0F4C5C]/8" />
      <MenuRow href="/tra-cuu" label="Khách tra hạn" hint="Link 3 số cuối biển + SĐT" />
    </div>
  );

  return (
    <div className="space-y-3">
      {menu}

      {isOwner ? (
        <SettingsGroup
          title="Dữ liệu"
          hint={demoEnabled ? "Đang bật dữ liệu mẫu" : trash.length ? `${trash.length} xe đang chờ khôi phục` : "Mẫu thử và xe đã xoá"}
        >
          <p className="mb-3 text-sm text-neutral-600">
            Bật dữ liệu mẫu để bấm thử. Tắt thì xoá hết dữ liệu mẫu, xe thật không bị đụng.
          </p>
          <Button
            className={touchBtnClass}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await toggleDemoAction(!demoEnabled);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                toast.success(demoEnabled ? "Đã tắt dữ liệu mẫu." : "Đã bật dữ liệu mẫu.");
                router.refresh();
              })
            }
          >
            {demoEnabled ? "Tắt dữ liệu mẫu" : "Bật dữ liệu mẫu"}
          </Button>

          <p className="mb-2 mt-5 text-base font-bold">Xe đã xoá (30 ngày)</p>
          {trash.length === 0 ? (
            <p className="text-sm text-neutral-600">Không có xe nào đang chờ khôi phục.</p>
          ) : (
            <ul className="space-y-3">
              {trash.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 p-3">
                  <div>
                    <p className="font-bold">{row.plateNumber}</p>
                    <p className="text-sm">{row.ownerName}</p>
                    <p className="text-xs text-neutral-500">
                      {row.deletedAt ? formatVnDateTime(row.deletedAt) : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      start(async () => {
                        const result = await restoreVehicleAction(row.id);
                        if (!result.ok) toast.error(result.message);
                        else {
                          toast.success("Đã khôi phục.");
                          router.refresh();
                        }
                      })
                    }
                  >
                    Khôi phục
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SettingsGroup>
      ) : null}

      <form action={logoutAction}>
        <Button variant="destructive" className={touchBtnClass} type="submit">
          Đăng xuất
        </Button>
      </form>
    </div>
  );
}
