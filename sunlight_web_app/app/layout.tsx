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
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <div className="flex flex-col md:flex-row min-h-screen w-full">
          <aside className="w-full md:w-64 bg-gray-800 text-white p-4 flex-shrink-0">
            <h1 className="text-2xl font-bold mb-4 text-amber-300">Sunlight Dashboard</h1>
            <nav>
              <ul>
                <li className="mb-2">
                  <Link href="/" className="hover:text-amber-300 block py-2">
                    Sensor Details
                  </Link>
                </li>
                <li className="mb-2">
                  <Link href="/graph" className="hover:text-amber-300 block py-2">
                    Sensor Levels
                  </Link>
                </li>
                {/* New Link for the Sensor Heatmap */}
                <li>
                  <Link href="/heatmap" className="hover:text-amber-300 block py-2">
                    Sensor Heatmap
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>
          <main className="flex-1 bg-gray-900 text-white p-4 md:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
