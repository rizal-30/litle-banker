import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Transaksi } from "@/types/database";

export function SakuLink({
  id,
  nama,
  className,
}: {
  id: string | null;
  nama?: string | null;
  className?: string;
}) {
  if (!id || !nama) {
    return <span className={className}>—</span>;
  }

  return (
    <Link
      href={`/saku/${id}`}
      className={cn(
        "text-primary hover:underline touch-manipulation truncate",
        className
      )}
      title={nama}
    >
      {nama}
    </Link>
  );
}

export function SakuTransferLabel({
  t,
  className,
}: {
  t: Transaksi;
  className?: string;
}) {
  if (!t.saku?.nama && !t.saku_tujuan?.nama) {
    return <span className={className}>—</span>;
  }

  if (t.saku?.nama && t.saku_tujuan?.nama) {
    return (
      <span className={cn("truncate", className)} title={`${t.saku.nama} → ${t.saku_tujuan.nama}`}>
        <SakuLink id={t.saku_id} nama={t.saku.nama} className="inline" />
        <span className="text-muted-foreground"> → </span>
        <SakuLink
          id={t.saku_tujuan_id}
          nama={t.saku_tujuan.nama}
          className="inline"
        />
      </span>
    );
  }

  return (
    <SakuLink
      id={t.saku_id}
      nama={t.saku?.nama}
      className={cn("block max-w-full", className)}
    />
  );
}
