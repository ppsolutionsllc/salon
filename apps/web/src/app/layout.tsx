import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from './providers'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
    title: 'Aesthetic Prime',
    description: 'Beauty salon management app',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Aesthetic Prime',
    },
    icons: {
        icon: '/icon-512.png',
        apple: '/icon-512.png',
    },
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: '#0d0d14',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="uk" suppressHydrationWarning>
            <head>
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="apple-touch-icon" href="/icon-512.png" />
            </head>
            <body className={inter.className}>
                <Providers>
                    {children}
                </Providers>
                <script dangerouslySetInnerHTML={{
                    __html: `
                        if ('serviceWorker' in navigator) {
                            window.addEventListener('load', function() {
                                navigator.serviceWorker.register('/sw.js');
                            });
                        }
                    `
                }} />
            </body>
        </html>
    )
}
