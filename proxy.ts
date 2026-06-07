/**
 * Proxy Next.js — dijalankan SEBELUM halaman dirender (network boundary).
 * Tugas: refresh session Supabase + lindungi route dashboard.
 */
import { type NextRequest, NextResponse } from "next/server";
import { hasAuthCookie, updateSession } from "@/lib/supabase/middleware";

const publicRoutes = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));

  // /login tanpa cookie auth: jangan panggil getUser() — cegah loop Set-Cookie
  if (pathname === "/login" && !hasAuthCookie(request)) {
    return NextResponse.next({ request });
  }

  const { supabaseResponse, user } = await updateSession(request);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
