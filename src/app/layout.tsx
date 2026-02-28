import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/providers/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meeting Copilot - AI-Powered Meeting Assistant",
  description: "Transform your meetings with AI-powered assistance. Get real-time insights, transcripts, and intelligent suggestions.",
  keywords: ["Meeting", "AI", "Copilot", "Assistant", "Transcription", "Real-time"],
  authors: [{ name: "Meeting Copilot Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Meeting Copilot",
    description: "AI-powered meeting assistant for smarter conversations",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meeting Copilot",
    description: "AI-powered meeting assistant for smarter conversations",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
