import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const siteUrl = configuredSiteUrl
  ? configuredSiteUrl.replace(/\/+$/, "")
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sealed Ledger — private expense audit, proven in a TEE",
  description:
    "Upload receipts or a bank statement. NEAR AI Cloud categorizes spending inside a confidential TEE and returns a cryptographic proof. No files stored, ever.",
  applicationName: "Sealed Ledger",
  keywords: [
    "NEAR AI Cloud",
    "TEE",
    "private AI",
    "expense auditor",
    "confidential compute",
    "NEAR Hackathon",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Sealed Ledger",
    description:
      "Private expense audit inside a hardware enclave, with a verifiable proof. Built for NEAR Hackathon 2026.",
    type: "website",
    siteName: "Sealed Ledger",
    locale: "en_US",
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Sealed Ledger — private expense audit, proven in a TEE",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sealed Ledger",
    description:
      "Private expense audit inside a hardware enclave, with a verifiable proof. Built for NEAR Hackathon 2026.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${instrumentSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
