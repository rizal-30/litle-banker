"use client";

/**
 * ThemeProvider — membungkus aplikasi agar dark/light mode berfungsi.
 * Pakai next-themes; class "dark" ditoggle di <html>.
 */
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
