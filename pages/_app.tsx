import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ReadOnlyProvider } from '../contexts/ReadOnlyContext'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ReadOnlyProvider>
      <Component {...pageProps} />
    </ReadOnlyProvider>
  )
}

