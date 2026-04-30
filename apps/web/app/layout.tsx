import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofNote AI",
  description: "Verifiable AI report workflow for the 0G APAC Hackathon"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
