import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { THEME_SCRIPT } from "@/components/theme-toggle";
import { Splash } from "@/components/splash";
import { RoleProvider } from "@/lib/role-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trust Wheels Operations",
  description: "Add and track used two-wheeler stock across Trust Wheels branches.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply the saved light/dark choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Splash />
        <RoleProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
