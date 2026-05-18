import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  // Inter ships as a single variable font; keeping the `opsz` axis means
  // every weight is served from one ~38 kB woff2 file (vs. four ~14 kB
  // static files), and the browser can interpolate between them with no
  // extra request. Cheaper on the wire and on parse.
  axes: ["opsz"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  // Mono is only used in keyboard hints / progress numerals. Skip the
  // preload tag on the critical path — the variable font fetches lazily
  // in idle time after the first paint.
  preload: false,
});

const TITLE = "Pickframe — design selection workbench";
const DESCRIPTION =
  "Lay out, compare, annotate, pick, and export many versions of mini-app design mocks — in one place.";

// Resolve absolute URLs for OG/Twitter previews from one of:
// 1) `NEXT_PUBLIC_SITE_URL` (set in Vercel project settings)
// 2) Vercel's runtime-injected `VERCEL_URL` (preview + production builds)
// 3) a sensible localhost fallback for `next dev`.
function resolveSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Pickframe",
  authors: [{ name: "Pickframe" }],
  keywords: [
    "Pickframe",
    "design selection",
    "design review",
    "annotation",
    "mockup",
    "compare designs",
    "miniapp",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Pickframe",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

// Move theme-color + viewport into the dedicated viewport export so they
// stream into <head> via Next's metadata pipeline (and so a colour-scheme
// flash doesn't ship before paint).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0e" },
  ],
  colorScheme: "light dark",
};

// Inline boot script: read the persisted theme synchronously and apply
// `.dark` + matching color-scheme + body bg BEFORE React hydrates. Without
// this, the document paints with default light tokens for one frame and the
// page flashes white when the user has dark mode saved.
const themeBootScript = `(function() {
  try {
    var saved = localStorage.getItem('pickframe-theme');
    var prefersDark =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = saved === 'dark' || saved === 'light'
      ? saved
      : (prefersDark ? 'dark' : 'light');
    var root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    root.style.colorScheme = theme;
    root.style.background = theme === 'dark' ? '#0e0e0e' : '#fafaf7';
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
