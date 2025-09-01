import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Dev-only CDN to confirm Tailwind classes render */}
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>
      <body className="bg-slate-50">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
