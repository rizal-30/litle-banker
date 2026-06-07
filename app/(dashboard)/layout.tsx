/**
 * Layout dashboard — Server Component yang membungkus halaman admin.
 * SidebarProvider + AppSidebar: navigasi konsisten di semua halaman dalam grup (dashboard).
 */
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BreadcrumbProvider } from "@/components/breadcrumb-provider";
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb";
import { Separator } from "@/components/ui/separator";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="h-svh max-h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <BreadcrumbProvider>
          <header className="z-20 flex min-h-16 shrink-0 items-center gap-2 border-b bg-background px-3 pt-[env(safe-area-inset-top,0px)] sm:min-h-14 sm:px-4">
            <SidebarTrigger className="-ml-1 size-11 touch-manipulation sm:size-9 [&_svg]:size-5 sm:[&_svg]:size-4" />
            <Separator orientation="vertical" className="mr-1 hidden h-full sm:block" />
            <DashboardBreadcrumb />
          </header>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
            {children}
          </div>
        </BreadcrumbProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
