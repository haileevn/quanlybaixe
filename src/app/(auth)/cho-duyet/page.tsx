import Link from "next/link";
import { Clock, ShieldAlert, RefreshCw, LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function PendingApprovalPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect("/dang-nhap");
  }

  if (user.isSuperAdmin) {
    redirect("/admin");
  }

  const tenant = user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })
    : null;

  // Nếu đã được duyệt thì tự động chuyển vào trang chủ
  if (tenant?.approvalStatus === "APPROVED") {
    redirect("/");
  }

  const isRejected = tenant?.approvalStatus === "REJECTED";

  return (
    <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-xl shadow-amber-900/5">
      <div className="mb-5 flex justify-center">
        {isRejected ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 animate-pulse">
            <Clock className="h-8 w-8" />
          </div>
        )}
      </div>

      <h1 className="text-center text-2xl font-black text-neutral-900">
        {isRejected ? "Tài khoản bị từ chối" : "Tài khoản đang chờ duyệt"}
      </h1>

      <p className="mt-2 text-center text-sm text-neutral-600">
        {isRejected
          ? "Rất tiếc, tài khoản bãi xe của bạn chưa được Quản trị viên phê duyệt. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết."
          : "Bãi xe của bạn đã đăng ký thành công! Để đảm bảo an toàn hệ thống, Quản trị viên cần duyệt tài khoản trước khi bạn có thể bắt đầu sử dụng."}
      </p>

      <div className="my-6 space-y-2.5 rounded-2xl bg-neutral-50 p-4 text-sm">
        <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2">
          <span className="text-neutral-500">Tên bãi xe:</span>
          <span className="font-semibold text-neutral-800">{tenant?.name ?? "Bãi xe"}</span>
        </div>
        <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2">
          <span className="text-neutral-500">Tài khoản:</span>
          <span className="font-semibold text-neutral-800">{user.email}</span>
        </div>
        <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2">
          <span className="text-neutral-500">Gói đăng ký:</span>
          <span className="font-semibold text-amber-700">
            {tenant?.subscriptions[0]?.plan.name ?? "Dùng thử (14 ngày)"}
          </span>
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-neutral-500">Trạng thái:</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              isRejected
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {isRejected ? "Đã từ chối" : "Chờ quản trị viên duyệt"}
          </span>
        </div>
      </div>

      {!isRejected && (
        <div className="mb-6 rounded-2xl border border-amber-200/60 bg-amber-50/70 p-3.5 text-xs text-amber-800">
          <p className="font-medium">
            💡 <strong>Lưu ý:</strong> Thời hạn dùng thử (14 ngày) sẽ bắt đầu được tính từ thời điểm tài khoản của bạn được Quản trị viên phê duyệt thành công.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Link
          href="/cho-duyet"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#0F4C5C] px-4 py-3 text-base font-bold text-white shadow-md transition hover:bg-[#0c3c49]"
        >
          <RefreshCw className="h-4 w-4" />
          Kiểm tra lại trạng thái
        </Link>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );
}
