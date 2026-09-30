import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Redwan's Method 2027 Discussion Hub",
  description:
    "A notes-only hub: upload and browse image and PDF study notes, stored on Telegram.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
                RM
              </span>
              <span>
                Redwan&apos;s Method <span className="text-accent">2027</span>
                <span className="block text-xs font-normal text-foreground/50">
                  Discussion Hub · Notes only
                </span>
              </span>
            </Link>
            <Link
              href="/admin"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground/70 transition hover:border-accent hover:text-foreground"
            >
              Admin
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border py-4 text-center text-xs text-foreground/40">
          Notes are stored on Telegram and appear publicly after admin verification.
        </footer>
      </body>
    </html>
  );
}
