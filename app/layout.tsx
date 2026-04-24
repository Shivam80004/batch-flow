import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "BatchFlow Logistics",
  description: "Next-generation logistics platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} h-full antialiased light`}
    >
      <body className="min-h-full flex flex-col font-popins bg-zinc-100 text-zinc-900 selection:bg-[#cfff04]/30 selection:text-zinc-900">{children}</body>
    </html>
  );
}
