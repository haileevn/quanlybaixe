import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Sổ bãi xe",
  description: "Quản lý gửi xe tháng, thu tiền, nhắc hạn — trên điện thoại",
  appleWebApp: {
    capable: true,
    title: "Bãi xe",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F4C5C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${beVietnam.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
