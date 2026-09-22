"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addExpenseCategoryAction } from "@/actions/cash";
import { CashForm } from "@/components/finance/CashForm";
import { Button } from "@/components/ui/button";
import { touchInputClass } from "@/lib/utils";

export function ExpensePageClient({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <CashForm kind="CHI" categories={categories} />
      <div className="rounded-2xl bg-white p-4">
        <p className="mb-2 font-bold">Thêm loại chi</p>
        <input
          className={touchInputClass + " mb-3"}
          placeholder="Ví dụ: Rửa sân"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          variant="outline"
          className="h-12 w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await addExpenseCategoryAction(name);
              if (!result.ok) toast.error(result.message);
              else {
                toast.success("Đã thêm loại chi.");
                setName("");
                router.refresh();
              }
            })
          }
        >
          Thêm loại
        </Button>
      </div>
    </div>
  );
}
