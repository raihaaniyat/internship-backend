import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/toast";
import { Header } from "@/components/header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BuyAnyAutoPart · Internship Backend Demo",
  description:
    "Live demo of a Bun + Hono + Better Auth + Drizzle backend with a polished Next.js UI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full overflow-x-hidden font-sans antialiased">
        <AuthProvider>
          <ToastProvider>
            <Header />
            <main className="container min-w-0 px-4 py-8 sm:px-6">{children}</main>
            <footer className="border-t border-primary/15 bg-gradient-to-b from-card/90 to-primary/[0.06] backdrop-blur-sm">
              <div className="container flex flex-col gap-3 px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground sm:text-left">
                <p className="max-w-prose break-words">
                  Built with Bun, Hono, Better Auth, Drizzle, PostgreSQL, Next.js &amp; shadcn-style UI.
                </p>
                <p className="font-mono text-[11px] tabular-nums text-foreground/80">
                  Auth :3001 · API :3000 · Web :3002
                </p>
                <p className="text-[11px]">
                  As built by{" "}
                  <a
                    href="https://raihaaan.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
                  >
                    Muhammad Raihaan Musharraf
                  </a>
                  .
                </p>
              </div>
            </footer>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
