'use client'
import { useRouter } from 'next/navigation'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const router = useRouter()

  return (
    <html lang="en">

    <body>
    <button type="button" onClick={() => router.push('page1')}>
      Go To Page 1
    </button>

    {children}

    </body>
    </html>
  );
}
