"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import type { AuditLog } from "@/types/database";
import {
  auditDeleteFields,
  auditInsertFields,
  auditUpdateDiff,
  collectNasabahIdsFromAudit,
  collectSakuIdsFromAudit,
  emptyAuditRefLookup,
  auditRecordSummary,
  labelAksiAudit,
  labelTabelAudit,
  type AuditDiffRow,
  type AuditRefLookup,
} from "@/lib/audit-format";
import { formatTanggalWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { ArrowRight } from "lucide-react";

interface AuditLogDetailDialogProps {
  log: AuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function aksiBadgeVariant(aksi: string) {
  if (aksi === "delete") return "destructive" as const;
  if (aksi === "insert") return "default" as const;
  return "secondary" as const;
}

function FieldList({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) {
    return <EmptyState variant="inline" description="Tidak ada detail." />;
  }
  return (
    <dl className="space-y-2 text-sm">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1"
        >
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function UpdateDiffView({ rows }: { rows: AuditDiffRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState variant="inline" description="Tidak ada field yang berubah." />
    );
  }

  return (
    <>
      <div className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <div
            key={row.key}
            className="bg-muted/30 rounded-lg border px-3 py-2.5"
          >
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">
              {row.label}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground line-through decoration-muted-foreground/60">
                {row.before}
              </span>
              <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
              <span className="font-medium">{row.after}</span>
            </div>
          </div>
        ))}
      </div>

      <Table className="hidden sm:table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[8rem]">Field</TableHead>
            <TableHead>Sebelum</TableHead>
            <TableHead className="w-8 px-1" />
            <TableHead>Sesudah</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="text-muted-foreground align-top font-medium">
                {row.label}
              </TableCell>
              <TableCell className="text-muted-foreground align-top line-through decoration-muted-foreground/50">
                {row.before}
              </TableCell>
              <TableCell className="text-muted-foreground px-1 align-top">
                <ArrowRight className="size-3.5" />
              </TableCell>
              <TableCell className="align-top font-medium">{row.after}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

export function AuditLogDetailDialog({
  log,
  open,
  onOpenChange,
}: AuditLogDetailDialogProps) {
  const [refLookup, setRefLookup] = useState<AuditRefLookup>(emptyAuditRefLookup);
  const [loadingRefs, setLoadingRefs] = useState(false);

  useEffect(() => {
    if (!log || !open) {
      setRefLookup(emptyAuditRefLookup);
      return;
    }

    const sakuIds = collectSakuIdsFromAudit(log.data_sebelum, log.data_sesudah);
    const nasabahIds = collectNasabahIdsFromAudit(
      log.data_sebelum,
      log.data_sesudah
    );

    if (sakuIds.length === 0 && nasabahIds.length === 0) {
      setRefLookup(emptyAuditRefLookup);
      return;
    }

    let cancelled = false;
    setLoadingRefs(true);

    (async () => {
      const supabase = createClient();
      const [sakuRes, nasabahRes] = await Promise.all([
        sakuIds.length > 0
          ? supabase.from("saku").select("id, nama").in("id", sakuIds)
          : Promise.resolve({ data: [] }),
        nasabahIds.length > 0
          ? supabase.from("nasabah").select("id, nama").in("id", nasabahIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (cancelled) return;

      const lookup: AuditRefLookup = { saku: {}, nasabah: {} };
      for (const row of sakuRes.data ?? []) {
        lookup.saku[row.id] = row.nama;
      }
      for (const row of nasabahRes.data ?? []) {
        lookup.nasabah[row.id] = row.nama;
      }
      setRefLookup(lookup);
      setLoadingRefs(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [log, open]);

  if (!log) return null;

  const recordSummary = auditRecordSummary(log);
  const lookup = loadingRefs ? undefined : refLookup;
  const isUpdate = log.aksi === "update";

  const insertFields =
    log.aksi === "insert" ? auditInsertFields(log.data_sesudah, lookup) : [];
  const deleteFields =
    log.aksi === "delete" ? auditDeleteFields(log.data_sebelum, lookup) : [];
  const updateDiff =
    log.aksi === "update"
      ? auditUpdateDiff(log.data_sebelum, log.data_sesudah, lookup)
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[85vh] overflow-y-auto",
          isUpdate ? "sm:max-w-xl" : "sm:max-w-lg"
        )}
      >
        <DialogHeader>
          <DialogTitle>Detail aktivitas</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{formatTanggalWaktu(log.created_at)}</span>
            <Badge variant={aksiBadgeVariant(log.aksi)}>
              {labelAksiAudit(log.aksi)}
            </Badge>
            <span>{labelTabelAudit(log.tabel)}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground mb-1">Admin</p>
              <p>{log.profil?.nama_lengkap ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">{recordSummary.label}</p>
              <p
                className={
                  recordSummary.monospace
                    ? "font-mono text-xs break-all"
                    : "break-words"
                }
              >
                {recordSummary.value}
              </p>
            </div>
          </div>

          <Separator />

          {loadingRefs ? (
            <p className="text-muted-foreground text-sm">Memuat detail...</p>
          ) : (
            <>
              {log.aksi === "insert" && (
                <div>
                  <p className="mb-2 font-medium">Data baru</p>
                  <FieldList rows={insertFields} />
                </div>
              )}

              {log.aksi === "delete" && (
                <div>
                  <p className="mb-2 font-medium">Data dihapus</p>
                  <FieldList rows={deleteFields} />
                </div>
              )}

              {log.aksi === "update" && (
                <div>
                  <p className="mb-3 font-medium">
                    Perubahan
                    {updateDiff.length > 0 && (
                      <span className="text-muted-foreground ml-1.5 font-normal">
                        ({updateDiff.length} field)
                      </span>
                    )}
                  </p>
                  <UpdateDiffView rows={updateDiff} />
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
