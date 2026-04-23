import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "API Deprecation Scanner",
    template: "%s | API Deprecation Scanner"
  },
  description:
    "Monitor third-party APIs for deprecations, breaking changes, and version drift before they cause production outages.",
  openGraph: {
    title: "API Deprecation Scanner",
    description:
      "Get early warnings from API docs, changelogs, and response headers before breaking changes hit production.",
    url: siteUrl,
    siteName: "API Deprecation Scanner",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "API Deprecation Scanner",
    description:
      "Continuously scan API docs and headers for deprecations, version changes, and breaking updates."
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
