import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/webp" href="/images/icon.webp" />
        <link rel="shortcut icon" type="image/webp" href="/images/icon.webp" />
        <link rel="apple-touch-icon" href="/images/icon.webp" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

