import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Service Tracker",
  description:
    "Live availability for bike docks, gyms, libraries, parking and clinics — pulled from open data, refreshed on a schedule.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link href="/" className="group inline-flex items-center gap-2">
                <span className="text-2xl">📡</span>
                <h1 className="text-xl font-semibold tracking-tight text-zinc-50 group-hover:text-white">
                  Local Service Tracker
                </h1>
              </Link>
              <p className="mt-1 text-sm text-zinc-400">
                Live availability across your city — refreshed from open data.
              </p>
            </div>
            <nav className="flex items-center gap-4 text-sm text-zinc-400">
              <Link href="/" className="hover:text-zinc-100">
                Map of status
              </Link>
              <a
                href="/api/health"
                className="hover:text-zinc-100"
                target="_blank"
                rel="noreferrer"
              >
                Health JSON
              </a>
            </nav>
          </header>
          {children}
          <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
            Bike-dock data via public{" "}
            <a className="underline hover:text-zinc-300" href="https://gbfs.org" target="_blank" rel="noreferrer">
              GBFS
            </a>{" "}
            feeds; gym / library / parking / clinic figures are synthetic for demo.
          </footer>
        </div>
      </body>
    </html>
  );
}
