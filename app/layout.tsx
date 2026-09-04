import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agendati — Plan the month beautifully",
  description: "Plan events, move approvals forward, and create beautiful calendar visuals for desktop, phone, and presentations.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
