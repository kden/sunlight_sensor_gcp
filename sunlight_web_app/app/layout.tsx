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
  title: "Sunlight Sensor Dashboard",
  description: "A dashboard for monitoring sunlight sensors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex">
          <aside className="w-64 bg-gray-800 text-white p-4">
            <h1 className="text-2xl font-bold mb-4">Sunlight Dashboard</h1>
            <nav>
              <ul>
                <li className="mb-2">
                  <Link href="/" className="hover:text-teal-300">
                    Sensor Details
                  </Link>
                </li>
                <li>
                  <Link href="/graph" className="hover:text-teal-300">
                    Sensor Graph
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>
          <main className="flex-1 p-8 bg-gray-900 text-white">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}