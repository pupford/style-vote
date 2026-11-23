import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"

const dmSans = localFont({
  src: [
    { path: "./fonts/dm-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/dm-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  fallback: ["sans-serif"],
})

export const metadata: Metadata = {
  title: "Pupford Illustration Style Vote, Round 1",
  description:
    "Help us find the illustration style that feels most like Pupford. Pick the take closest to our brand.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: "#FCF9E9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={dmSans.className}>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
