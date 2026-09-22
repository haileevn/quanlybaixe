"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { touchBtnClass } from "@/lib/utils";

export function ConfirmDelete({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className={touchBtnClass}
        onClick={() => setOpen(true)}
      >
        Xoá
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-md p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Không, giữ lại</AlertDialogCancel>
            <AlertDialogAction
              className="h-12 bg-destructive text-white"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
            >
              {pending ? "Đang xoá..." : "Xoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
