"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { touchBtnClass } from "@/lib/utils";

export function PlanLimitDialog({
  open,
  message,
  onOpenChange,
}: {
  open: boolean;
  message: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">Gói đã đủ chỗ</DialogTitle>
          <DialogDescription className="text-base text-foreground">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Link
            href="/goi-dich-vu"
            className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground"
          >
            Xem gói dịch vụ
          </Link>
          <Button variant="outline" className={touchBtnClass} onClick={() => onOpenChange(false)}>
            Để sau
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
