"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTableCard } from "@/components/data-table-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { AuditLog, AuditLogListRow } from "@/types/database";
import { formatTanggalWaktu } from "@/lib/format";
import { AuditLogDetailDialog } from "@/components/audit-log-detail-dialog";
import { EmptyState } from "@/components/empty-state";
import { auditRecordSummary, labelAksiAudit, labelTabelAudit } from "@/lib/audit-format";
import { cn } from "@/lib/utils";
import { ScrollText } from "lucide-react";

export default function AuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_audit_log", {
      p_limit: 200,
    });

    if (error) {
      console.error(error);
      return;
    }

    const logs = (data ?? []) as AuditLogListRow[];
    setRows(
      logs.map((log) => ({
        id: log.id,
        user_id: log.user_id,
        aksi: log.aksi,
        tabel: log.tabel,
        record_id: log.record_id,
        data_sebelum: log.data_sebelum,
        data_sesudah: log.data_sesudah,
        created_at: log.created_at,
        profil: log.nama_lengkap ? { nama_lengkap: log.nama_lengkap } : null,
      }))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openDetail(log: AuditLog) {
    setSelected(log);
    setDialogOpen(true);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Audit</h1>
        <p className="text-muted-foreground text-sm">
          Catatan perubahan data · 200 entri terakhir · ketuk baris untuk detail
        </p>
      </div>

      <DataTableCard>
        {rows.length === 0 ? (
          <EmptyState
            variant="inset"
            icon={ScrollText}
            title="Belum ada catatan"
            description="Perubahan data akan muncul di sini setelah ada aktivitas admin."
          />
        ) : (
          <>
          <div className="space-y-2 p-3 sm:hidden">
            {rows.map((log) => {
              const record = auditRecordSummary(log);
              return (
                <button
                  key={log.id}
                  type="button"
                  className="hover:bg-muted/50 w-full rounded-lg border p-3 text-left transition-colors"
                  onClick={() => openDetail(log)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-muted-foreground text-xs">
                      {formatTanggalWaktu(log.created_at)}
                    </p>
                    <Badge
                      variant={
                        log.aksi === "delete"
                          ? "destructive"
                          : log.aksi === "insert"
                            ? "default"
                            : "secondary"
                      }
                      className="shrink-0 text-[10px]"
                    >
                      {labelAksiAudit(log.aksi)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {log.profil?.nama_lengkap ?? "—"} · {labelTabelAudit(log.tabel)}
                  </p>
                  <p
                    className={cn(
                      "text-muted-foreground mt-0.5 truncate text-xs",
                      record.monospace && "font-mono"
                    )}
                  >
                    {record.monospace
                      ? `${record.value.slice(0, 8)}…`
                      : record.value}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="hidden sm:block">
          <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40 pl-4">Waktu</TableHead>
                  <TableHead className="w-32">Admin</TableHead>
                  <TableHead className="w-24">Aksi</TableHead>
                  <TableHead className="w-28">Tabel</TableHead>
                  <TableHead className="pr-4">Record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log) => {
                  const record = auditRecordSummary(log);
                  return (
                  <TableRow
                    key={log.id}
                    className={cn("cursor-pointer hover:bg-muted/50")}
                    onClick={() => openDetail(log)}
                  >
                    <TableCell className="whitespace-nowrap pl-4 text-sm">
                      {formatTanggalWaktu(log.created_at)}
                    </TableCell>
                    <TableCell className="max-w-0 truncate">
                      {log.profil?.nama_lengkap ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.aksi === "delete"
                            ? "destructive"
                            : log.aksi === "insert"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {labelAksiAudit(log.aksi)}
                      </Badge>
                    </TableCell>
                    <TableCell>{labelTabelAudit(log.tabel)}</TableCell>
                    <TableCell
                      className={cn(
                        "max-w-0 truncate pr-4 text-sm",
                        record.monospace && "font-mono text-xs"
                      )}
                    >
                      {record.monospace
                        ? `${record.value.slice(0, 8)}…`
                        : record.value}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </DataTableCard>

      <AuditLogDetailDialog
        log={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
