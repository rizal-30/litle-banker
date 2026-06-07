import { Badge } from "@/components/ui/badge";
import { jenisTransaksiBadgeClassName } from "@/lib/jenis-transaksi-style";
import { cn } from "@/lib/utils";
import { JENIS_TRANSAKSI_LABEL, type JenisTransaksi } from "@/types/database";

interface JenisTransaksiBadgeProps {
  jenis: JenisTransaksi;
  className?: string;
}

export function JenisTransaksiBadge({ jenis, className }: JenisTransaksiBadgeProps) {
  const label = JENIS_TRANSAKSI_LABEL[jenis];

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        jenisTransaksiBadgeClassName(jenis),
        className
      )}
      title={label}
    >
      {label}
    </Badge>
  );
}
