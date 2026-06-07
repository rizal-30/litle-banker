import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Card tanpa header — untuk tabel data di halaman dashboard. */
export function DataTableCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 overflow-hidden py-0", className)}>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}
