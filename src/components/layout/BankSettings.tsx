"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBankAction } from "@/actions/extras";
import { saveBranchBankAction } from "@/actions/collect";
import { Button } from "@/components/ui/button";
import { VN_BANKS } from "@/lib/banks";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

type BranchBank = {
  id: string;
  name: string;
  bankBin: string;
  bankAccountNo: string;
  bankAccountName: string;
};

function BankFields({
  bin,
  accountNo,
  accountName,
  onBin,
  onAccountNo,
  onAccountName,
}: {
  bin: string;
  accountNo: string;
  accountName: string;
  onBin: (v: string) => void;
  onAccountNo: (v: string) => void;
  onAccountName: (v: string) => void;
}) {
  return (
    <>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Ngân hàng</span>
        <select className={touchInputClass} value={bin} onChange={(e) => onBin(e.target.value)}>
          {VN_BANKS.map((row) => (
            <option key={row.bin} value={row.bin}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Số tài khoản</span>
        <input
          className={touchInputClass}
          inputMode="numeric"
          value={accountNo}
          onChange={(e) => onAccountNo(e.target.value)}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Tên chủ tài khoản</span>
        <input className={touchInputClass} value={accountName} onChange={(e) => onAccountName(e.target.value)} />
      </label>
    </>
  );
}

export function BankSettings({
  bankBin,
  bankAccountNo,
  bankAccountName,
  branches = [],
}: {
  bankBin: string;
  bankAccountNo: string;
  bankAccountName: string;
  branches?: BranchBank[];
}) {
  const router = useRouter();
  const [bin, setBin] = useState(bankBin || VN_BANKS[0].bin);
  const [accountNo, setAccountNo] = useState(bankAccountNo);
  const [accountName, setAccountName] = useState(bankAccountName);
  const [branchForms, setBranchForms] = useState<Record<string, BranchBank>>(() =>
    Object.fromEntries(branches.map((row) => [row.id, { ...row, bankBin: row.bankBin || VN_BANKS[0].bin }])),
  );
  const [pending, start] = useTransition();
  const bank = VN_BANKS.find((row) => row.bin === bin) ?? VN_BANKS[0];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="font-bold">Tài khoản mặc định</p>
        <p className="text-sm text-neutral-600">Dùng khi bãi chưa khai STK riêng.</p>
        <BankFields
          bin={bin}
          accountNo={accountNo}
          accountName={accountName}
          onBin={setBin}
          onAccountNo={setAccountNo}
          onAccountName={setAccountName}
        />
        <Button
          className={touchBtnClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await saveBankAction({
                bankBin: bin,
                bankName: bank.name,
                bankAccountNo: accountNo,
                bankAccountName: accountName,
              });
              if (!result.ok) toast.error(result.message);
              else {
                toast.success("Đã lưu số tài khoản mặc định.");
                router.refresh();
              }
            })
          }
        >
          Lưu tài khoản chung
        </Button>
      </div>

      {branches.map((branch) => {
        const form = branchForms[branch.id] ?? branch;
        const branchBank = VN_BANKS.find((row) => row.bin === form.bankBin) ?? VN_BANKS[0];
        return (
          <details key={branch.id} className="rounded-xl bg-neutral-50 p-3">
            <summary className="cursor-pointer list-none font-bold">
              STK bãi {branch.name}
              <span className="ml-2 text-sm font-normal text-neutral-500">
                {form.bankAccountNo || "dùng STK mặc định"}
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-sm text-neutral-600">Để trống thì dùng tài khoản mặc định.</p>
              <BankFields
                bin={form.bankBin || VN_BANKS[0].bin}
                accountNo={form.bankAccountNo}
                accountName={form.bankAccountName}
                onBin={(v) => setBranchForms((prev) => ({ ...prev, [branch.id]: { ...form, bankBin: v } }))}
                onAccountNo={(v) => setBranchForms((prev) => ({ ...prev, [branch.id]: { ...form, bankAccountNo: v } }))}
                onAccountName={(v) =>
                  setBranchForms((prev) => ({ ...prev, [branch.id]: { ...form, bankAccountName: v } }))
                }
              />
              <Button
                className={touchBtnClass}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await saveBranchBankAction({
                      branchId: branch.id,
                      bankBin: form.bankBin || VN_BANKS[0].bin,
                      bankName: branchBank.name,
                      bankAccountNo: form.bankAccountNo,
                      bankAccountName: form.bankAccountName,
                    });
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(`Đã lưu STK ${branch.name}.`);
                      router.refresh();
                    }
                  })
                }
              >
                Lưu STK {branch.name}
              </Button>
            </div>
          </details>
        );
      })}
    </div>
  );
}
