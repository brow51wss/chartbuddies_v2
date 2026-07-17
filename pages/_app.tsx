import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import { ReadOnlyProvider } from '../contexts/ReadOnlyContext'
import CookieConsent from '../components/CookieConsent'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ReadOnlyProvider>
      <div className={inter.variable}>
        <Component {...pageProps} />
        <CookieConsent />
      </div>
    </ReadOnlyProvider>
  )
}

