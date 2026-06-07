/** Format angka ke Rupiah Indonesia */
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Prefix tetap pada input rupiah — tidak boleh dihapus */
export const RUPIAH_INPUT_PREFIX = "Rp ";

/** Format angka ke teks input: "Rp 12.000" */
export function formatRupiahInput(value: number): string {
  if (!value) return RUPIAH_INPUT_PREFIX;
  return RUPIAH_INPUT_PREFIX + value.toLocaleString("id-ID");
}

/** Hitung jumlah digit sebelum posisi kursor */
export function countDigitsBefore(text: string, pos: number): number {
  let count = 0;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (/\d/.test(text[i]!)) count++;
  }
  return count;
}

/** Posisi kursor dari jumlah digit (setelah diformat) */
export function cursorFromDigitCount(
  formatted: string,
  digitCount: number
): number {
  if (digitCount <= 0) return RUPIAH_INPUT_PREFIX.length;
  let count = 0;
  for (let i = RUPIAH_INPUT_PREFIX.length; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      count++;
      if (count >= digitCount) return i + 1;
    }
  }
  return formatted.length;
}

export function formatTanggal(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Rentang tanggal Masehi untuk filter transaksi / laporan */
export function formatRentangTanggal(dari: string, sampai: string): string {
  return `${formatTanggal(dari)} – ${formatTanggal(sampai)}`;
}

export function formatBulan(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatTanggalWaktu(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Normalisasi nomor Indonesia → URL WhatsApp (wa.me) */
export function whatsappUrl(telepon: string | null | undefined): string | null {
  if (!telepon?.trim()) return null;

  let digits = telepon.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (!digits.startsWith("62")) {
    digits = `62${digits}`;
  }

  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}`;
}
