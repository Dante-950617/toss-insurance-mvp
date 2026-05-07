import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Toss Insurance | 영업 관리',
  description: '영업 퍼포먼스 및 활동 관리 솔루션',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
