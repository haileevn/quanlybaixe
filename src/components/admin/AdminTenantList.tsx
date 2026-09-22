"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, ShieldCheck, Search, Building2, Phone, Mail, Calendar } from "lucide-react";
import { approveTenantAction, rejectTenantAction } from "@/actions/admin";
import { formatVnDate } from "@/lib/datetime";

export interface AdminTenantItem {
  id: string;
  name: string;
  slug: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvedAt: Date | null;
  onboardingCompleted: boolean;
  createdAt: Date;
  planName: string;
  planCode: string;
  endsAt: Date | null;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}

export function AdminTenantList({ rows }: { rows: AdminTenantItem[] }) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = rows.filter((row) => {
    if (filter !== "ALL" && row.approvalStatus !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        row.name.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        row.ownerEmail.toLowerCase().includes(q) ||
        row.ownerName.toLowerCase().includes(q) ||
        row.ownerPhone.includes(q)
      );
    }
    return true;
  });

  const pendingCount = rows.filter((r) => r.approvalStatus === "PENDING").length;

  const handleApprove = (tenantId: string, name: string) => {
    startTransition(async () => {
      const res = await approveTenantAction(tenantId);
      if (res.ok) {
        toast.success(`Đã duyệt & kích hoạt bãi xe "${name}" (14 ngày dùng thử).`);
      } else {
        toast.error(res.message || "Không thể duyệt bãi xe.");
      }
    });
  };

  const handleReject = (tenantId: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn từ chối bãi xe "${name}"?`)) return;
    startTransition(async () => {
      const res = await rejectTenantAction(tenantId);
      if (res.ok) {
        toast.success(`Đã từ chối bãi xe "${name}".`);
      } else {
        toast.error(res.message || "Không thể từ chối bãi xe.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm border border-neutral-200/80">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Tìm theo tên bãi, email, số điện thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm focus:border-[#0F4C5C] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setFilter("ALL")}
            className={`rounded-full px-3 py-1.5 transition ${
              filter === "ALL" ? "bg-[#0F4C5C] text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Tất cả ({rows.length})
          </button>
          <button
            onClick={() => setFilter("PENDING")}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 transition ${
              filter === "PENDING" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            <Clock className="h-3 w-3" />
            Chờ duyệt {pendingCount > 0 ? `(${pendingCount})` : ""}
          </button>
          <button
            onClick={() => setFilter("APPROVED")}
            className={`rounded-full px-3 py-1.5 transition ${
              filter === "APPROVED" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Đã duyệt
          </button>
          <button
            onClick={() => setFilter("REJECTED")}
            className={`rounded-full px-3 py-1.5 transition ${
              filter === "REJECTED" ? "bg-red-600 text-white" : "bg-red-50 text-red-800 hover:bg-red-100"
            }`}
          >
            Từ chối
          </button>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-neutral-500 border border-neutral-200/80">
          Không tìm thấy bãi xe nào.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => {
            const isRowPending = row.approvalStatus === "PENDING";
            const isApproved = row.approvalStatus === "APPROVED";
            const isRejected = row.approvalStatus === "REJECTED";

            return (
              <li
                key={row.id}
                className="space-y-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#0F4C5C]" />
                      <h3 className="text-base font-bold text-neutral-900">{row.name}</h3>
                    </div>
                    <p className="text-xs text-neutral-500">{row.slug}</p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      isRowPending
                        ? "bg-amber-100 text-amber-800 animate-pulse"
                        : isApproved
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {isRowPending ? (
                      <>
                        <Clock className="h-3 w-3" />
                        Chờ duyệt
                      </>
                    ) : isApproved ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Đã duyệt
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Từ chối
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 rounded-xl bg-neutral-50 p-2.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">{row.ownerEmail}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span>{row.ownerPhone || "Chưa có SĐT"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span className="font-semibold text-neutral-800">{row.planName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span>Hạn: {row.endsAt ? formatVnDate(row.endsAt) : "—"}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  {isRowPending && (
                    <>
                      <button
                        disabled={isPending}
                        onClick={() => handleReject(row.id, row.name)}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Từ chối
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => handleApprove(row.id, row.name)}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Duyệt & Kích hoạt (14 ngày)
                      </button>
                    </>
                  )}

                  {isRejected && (
                    <button
                      disabled={isPending}
                      onClick={() => handleApprove(row.id, row.name)}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#0F4C5C] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0c3c49] disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Duyệt lại
                    </button>
                  )}

                  {isApproved && (
                    <button
                      disabled={isPending}
                      onClick={() => handleApprove(row.id, row.name)}
                      className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Gia hạn 14 ngày
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
