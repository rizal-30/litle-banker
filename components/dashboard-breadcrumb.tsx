"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useBreadcrumbTitle } from "@/components/breadcrumb-provider";

const STATIC_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/transaksi": "Transaksi",
  "/nasabah": "Nasabah",
  "/saku": "Saku",
  "/laporan": "Laporan",
  "/audit": "Audit",
  "/pengaturan": "Pengaturan",
};

type Crumb = { label: string; href?: string };

function buildCrumbs(pathname: string, pageTitle: string | null): Crumb[] {
  if (pathname === "/") {
    return [{ label: "Dashboard" }];
  }

  const crumbs: Crumb[] = [{ label: "Dashboard", href: "/" }];

  const nasabahDetail = pathname.match(/^\/nasabah\/([^/]+)$/);
  if (nasabahDetail) {
    crumbs.push({ label: "Nasabah", href: "/nasabah" });
    crumbs.push({ label: pageTitle ?? "Buku tabungan" });
    return crumbs;
  }

  const sakuDetail = pathname.match(/^\/saku\/([^/]+)$/);
  if (sakuDetail) {
    crumbs.push({ label: "Saku", href: "/saku" });
    crumbs.push({ label: pageTitle ?? "Buku saku" });
    return crumbs;
  }

  const label = STATIC_LABELS[pathname];
  if (label) {
    crumbs.push({ label });
  }

  return crumbs;
}

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  const pageTitle = useBreadcrumbTitle();
  const crumbs = buildCrumbs(pathname, pageTitle);

  return (
    <Breadcrumb className="min-w-0 flex-1 text-sm sm:text-xs">
      <BreadcrumbList className="flex-nowrap gap-1.5 overflow-hidden sm:gap-2.5">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0 shrink">
                {isLast || !crumb.href ? (
                  <BreadcrumbPage className="max-w-[12rem] truncate py-1 sm:max-w-xs md:max-w-none">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    asChild
                    className="max-w-[8rem] truncate py-1 touch-manipulation sm:max-w-none"
                  >
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
