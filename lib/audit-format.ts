import {
  JENIS_SAKU_LABEL,
  JENIS_TRANSAKSI_LABEL,
  type JenisSaku,
  type JenisTransaksi,
} from "@/types/database";
import { formatRupiah, formatTanggal, formatTanggalWaktu } from "@/lib/format";

const FIELD_LABEL: Record<string, string> = {
  nama: "Nama",
  telepon: "Telepon",
  alamat: "Alamat",
  keterangan: "Keterangan",
  aktif: "Aktif",
  jenis: "Jenis",
  jumlah: "Jumlah",
  tanggal: "Tanggal",
  nasabah_id: "Nasabah",
  saku_id: "Saku",
  saku_tujuan_id: "Saku tujuan",
  transaksi_asal_id: "ID transaksi asal",
  dibatalkan_pada: "Dibatalkan pada",
  dibatalkan_oleh: "Dibatalkan oleh",
  alasan_pembatalan: "Alasan dibatalkan",
  created_at: "Dibuat",
  updated_at: "Diperbarui",
};

const HIDDEN_FIELDS = new Set(["updated_by", "created_by", "id"]);

const SAKU_REF_KEYS = new Set(["saku_id", "saku_tujuan_id"]);
const NASABAH_REF_KEYS = new Set(["nasabah_id"]);

const TABEL_LABEL: Record<string, string> = {
  nasabah: "Nasabah",
  saku: "Saku",
  transaksi: "Transaksi",
};

export const AKSI_AUDIT_LABEL: Record<string, string> = {
  insert: "Tambah",
  update: "Ubah",
  delete: "Hapus",
};

export function labelAksiAudit(aksi: string): string {
  return AKSI_AUDIT_LABEL[aksi] ?? aksi;
}

/** Lookup id → nama untuk field referensi di audit */
export type AuditRefLookup = {
  saku: Record<string, string>;
  nasabah: Record<string, string>;
};

export const emptyAuditRefLookup: AuditRefLookup = { saku: {}, nasabah: {} };

export function labelTabelAudit(tabel: string): string {
  return TABEL_LABEL[tabel] ?? tabel;
}

export function labelFieldAudit(key: string): string {
  return FIELD_LABEL[key] ?? key.replace(/_/g, " ");
}

/** Label ringkas untuk baris audit — nama untuk nasabah/saku, UUID untuk lainnya */
export function auditRecordSummary(log: {
  tabel: string;
  record_id: string;
  data_sebelum?: Record<string, unknown> | null;
  data_sesudah?: Record<string, unknown> | null;
}): { label: string; value: string; monospace: boolean } {
  const snap = log.data_sesudah ?? log.data_sebelum;
  if (log.tabel === "nasabah" || log.tabel === "saku") {
    const nama = snap?.nama;
    if (typeof nama === "string" && nama.length > 0) {
      return { label: "Nama", value: nama, monospace: false };
    }
  }
  return { label: "ID record", value: log.record_id, monospace: true };
}

export function collectSakuIdsFromAudit(
  ...records: (Record<string, unknown> | null | undefined)[]
): string[] {
  const ids = new Set<string>();
  for (const record of records) {
    if (!record) continue;
    for (const key of SAKU_REF_KEYS) {
      const v = record[key];
      if (typeof v === "string" && v.length > 0) ids.add(v);
    }
  }
  return [...ids];
}

export function collectNasabahIdsFromAudit(
  ...records: (Record<string, unknown> | null | undefined)[]
): string[] {
  const ids = new Set<string>();
  for (const record of records) {
    if (!record) continue;
    for (const key of NASABAH_REF_KEYS) {
      const v = record[key];
      if (typeof v === "string" && v.length > 0) ids.add(v);
    }
  }
  return [...ids];
}

function formatValue(
  key: string,
  value: unknown,
  lookup?: AuditRefLookup
): string {
  if (value === null || value === undefined) return "—";
  if (SAKU_REF_KEYS.has(key) && typeof value === "string") {
    return lookup?.saku[value] ?? "—";
  }
  if (NASABAH_REF_KEYS.has(key) && typeof value === "string") {
    return lookup?.nasabah[value] ?? "—";
  }
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (
    key === "jumlah" &&
    (typeof value === "number" || typeof value === "string")
  ) {
    return formatRupiah(Number(value));
  }
  if (key === "tanggal" && typeof value === "string") {
    return formatTanggal(value);
  }
  if (
    (key === "created_at" ||
      key === "updated_at" ||
      key === "dibatalkan_pada") &&
    typeof value === "string"
  ) {
    return formatTanggalWaktu(value);
  }
  if (key === "jenis" && typeof value === "string") {
    if (value in JENIS_TRANSAKSI_LABEL) {
      return JENIS_TRANSAKSI_LABEL[value as JenisTransaksi];
    }
    if (value in JENIS_SAKU_LABEL) {
      return JENIS_SAKU_LABEL[value as JenisSaku];
    }
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export interface AuditFieldRow {
  key: string;
  label: string;
  value: string;
}

export interface AuditDiffRow {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

function pickFields(
  data: Record<string, unknown> | null,
  lookup?: AuditRefLookup
): AuditFieldRow[] {
  if (!data) return [];
  return Object.entries(data)
    .filter(([key]) => !HIDDEN_FIELDS.has(key))
    .map(([key, value]) => ({
      key,
      label: labelFieldAudit(key),
      value: formatValue(key, value, lookup),
    }));
}

export function auditInsertFields(
  data: Record<string, unknown> | null,
  lookup?: AuditRefLookup
): AuditFieldRow[] {
  return pickFields(data, lookup);
}

export function auditDeleteFields(
  data: Record<string, unknown> | null,
  lookup?: AuditRefLookup
): AuditFieldRow[] {
  return pickFields(data, lookup);
}

export function auditUpdateDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  lookup?: AuditRefLookup
): AuditDiffRow[] {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  return [...keys]
    .filter((key) => !HIDDEN_FIELDS.has(key))
    .map((key) => {
      const b = before?.[key];
      const a = after?.[key];
      const bStr = formatValue(key, b, lookup);
      const aStr = formatValue(key, a, lookup);
      return {
        key,
        label: labelFieldAudit(key),
        before: bStr,
        after: aStr,
        changed: bStr !== aStr,
      };
    })
    .filter((row) => row.changed);
}
