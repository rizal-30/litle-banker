"use client";

/**
 * Sidebar navigasi dashboard — komposisi komponen shadcn Sidebar.
 * Client Component karena butuh pathname aktif & logout.
 */
import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  Wallet,
  FileSpreadsheet,
  History,
  Settings,
  LogOut,
  Landmark,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const navItemClassMobile =
  "min-h-14 gap-3 rounded-lg px-3 text-base touch-manipulation [&_svg]:size-5";

const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transaksi", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/nasabah", label: "Nasabah", icon: Users },
  { href: "/saku", label: "Saku", icon: Wallet },
  { href: "/laporan", label: "Laporan", icon: FileSpreadsheet },
  { href: "/audit", label: "Audit", icon: History },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, isMobile } = useSidebar();

  function closeNav() {
    if (!isMobile) return;
    setOpenMobile(false);
  }

  useEffect(() => {
    if (!isMobile) return;
    setOpenMobile(false);
  }, [pathname, isMobile]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Berhasil keluar");
    router.push("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border p-4",
          isMobile && "px-5 py-5"
        )}
      >
        <Link
          href="/"
          onClick={closeNav}
          className={cn(
            "flex items-center gap-2.5 font-heading font-semibold touch-manipulation",
            isMobile && "gap-3 text-lg"
          )}
        >
          <Landmark className={cn("size-5", isMobile && "size-6")} />
          <span>Bank Hemat</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className={cn(isMobile && "px-1")}>
        <SidebarGroup className={cn(isMobile && "p-3")}>
          <SidebarGroupContent>
            <SidebarMenu className={cn(isMobile && "gap-1.5")}>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} onClick={closeNav} />}
                    size={isMobile ? "lg" : "default"}
                    className={cn(isMobile && navItemClassMobile)}
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    }
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter
        className={cn(
          "border-t border-sidebar-border p-2",
          isMobile && "p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        )}
      >
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size={isMobile ? "lg" : "default"}
              className={cn(isMobile && navItemClassMobile)}
              onClick={handleLogout}
            >
              <LogOut />
              <span>Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
