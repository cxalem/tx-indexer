import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/header";
import { NoisyBackground } from "@/components/noisy-bg";
import "./globals.css";
import { Providers } from "@/components/providers";
import { GridBackground } from "@/components/grid-bg";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Dashboard | itx",
  description: "Your Solana transaction command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <Providers>
          <NoisyBackground />
          <GridBackground />
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
