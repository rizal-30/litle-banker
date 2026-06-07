import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  description: string;
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  /** page = di luar card; inset = di dalam card/tabel; inline = teks saja (dialog) */
  variant?: "page" | "inset" | "inline";
};

export function EmptyState({
  description,
  title,
  icon: Icon = Inbox,
  action,
  className,
  variant = "inset",
}: EmptyStateProps) {
  if (variant === "inline") {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        {description}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "page" ? "py-12" : "px-4 py-10",
        className
      )}
    >
      <div className="bg-muted text-muted-foreground mb-3 flex size-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </div>
      {title ? (
        <p className="text-sm font-medium">{title}</p>
      ) : null}
      <p className={cn("text-muted-foreground max-w-sm text-sm", title && "mt-1")}>
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
