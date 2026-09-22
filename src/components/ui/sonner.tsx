"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      toastOptions={{
        className: "text-base",
      }}
      {...props}
    />
  );
}
