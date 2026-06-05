import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ReadOnlyProvider } from '../contexts/ReadOnlyContext'
import CookieConsent from '../components/CookieConsent'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ReadOnlyProvider>
      <Component {...pageProps} />
      <CookieConsent />
    </ReadOnlyProvider>
  )
}

