"use client";

import type { ComponentProps } from "react";
import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Dialog transaksi — layar penuh di mobile, modal biasa di desktop.
 * Mobile: shell fixed inset-0 + overflow-hidden (bukan scroll di shell) agar
 * popup Select tidak memicu lonjakan tinggi dvh / scroll ganda.
 */
export const transaksiDialogContentClass = cn(
  // Timpa centering + max-h default DialogContent agar benar-benar fullscreen di mobile
  "max-sm:!fixed max-sm:!inset-0 max-sm:!top-0 max-sm:!left-0 max-sm:!h-[100dvh] max-sm:!max-h-none max-sm:!w-full max-sm:!max-w-none",
  "max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:flex max-sm:flex-col max-sm:gap-0 max-sm:overflow-hidden max-sm:rounded-none max-sm:p-0 max-sm:ring-0",
  "max-sm:pt-[max(1rem,env(safe-area-inset-top))]",
  "sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[min(90dvh,calc(100%-2rem))] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:gap-4 sm:overflow-y-auto sm:rounded-xl sm:p-4 sm:pt-4"
);

export const transaksiDialogBodyClass = cn(
  "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
  "sm:contents sm:overflow-visible sm:px-0 sm:pb-0"
);

export const transaksiDialogHeaderClass = "shrink-0";

export const transaksiDialogTitleClass = "text-lg sm:text-base";

export const transaksiDialogDescriptionClass = "text-base sm:text-sm";

export function TransaksiDialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      showCloseButton={false}
      className={cn(transaksiDialogContentClass, className)}
      {...props}
    >
      <div className={transaksiDialogBodyClass}>{children}</div>
    </DialogContent>
  );
}
