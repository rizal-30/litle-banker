/**
 * Route `/` — Panel admin dashboard (statistik + chart).
 * Memuat Client Component karena chart & filter periode butuh browser.
 */
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export default function HomePage() {
  return <DashboardPage />;
}
