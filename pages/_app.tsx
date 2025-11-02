import '../styles/globals.css'
import type { AppProps } from 'next/app'
import FeedbackSystem from '../components/FeedbackSystem'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <FeedbackSystem />
    </>
  )
}

