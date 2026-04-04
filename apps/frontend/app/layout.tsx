import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BanHang Next.js',
  description: 'Frontend Next.js ket noi NestJS backend',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
