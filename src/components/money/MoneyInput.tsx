"use client";

import { useState } from "react";
import { formatVndInput, parseVndInput } from "@/lib/money";
import { cn, touchInputClass } from "@/lib/utils";

export function MoneyInput({
  name,
  value,
  onValueChange,
  disabled,
}: {
  name: string;
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value ? formatVndInput(String(value)) : "");

  return (
    <>
      <input type="hidden" name={name} value={value || ""} />
      <input
        inputMode="numeric"
        disabled={disabled}
        value={text}
        placeholder="0"
        className={cn(touchInputClass, disabled && "bg-muted")}
        onChange={(event) => {
          const next = event.target.value;
          const parsed = parseVndInput(next);
          setText(formatVndInput(next));
          onValueChange(parsed);
        }}
      />
    </>
  );
}
