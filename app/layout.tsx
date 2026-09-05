import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://aisubtitlegenerator.krishaiworks.com"
  ),

  title: "AI Subtitle Generator | Generate Subtitles with AI",

  description:
    "Generate accurate subtitles for your videos with AI. Create subtitles quickly and easily with the KrishAIWorks AI Subtitle Generator.",

  keywords: [
    "AI Subtitle Generator",
    "Subtitle Generator",
    "AI Subtitles",
    "Video Subtitle Generator",
    "Automatic Subtitle Generator",
    "AI Video Subtitle Generator",
    "Subtitle Maker",
    "Generate Subtitles with AI",
  ],

  authors: [
    {
      name: "KrishAIWorks",
      url: "https://krishaiworks.vercel.app",
    },
  ],

  creator: "KrishAIWorks",
  publisher: "KrishAIWorks",

  alternates: {
    canonical:
      "https://aisubtitlegenerator.krishaiworks.com/",
  },

  openGraph: {
    title: "AI Subtitle Generator | KrishAIWorks",
    description:
      "Generate accurate subtitles for your videos with AI quickly and easily.",
    url: "https://aisubtitlegenerator.krishaiworks.com/",
    siteName: "KrishAIWorks",
    type: "website",
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: "AI Subtitle Generator | KrishAIWorks",
    description:
      "Generate accurate video subtitles with AI quickly and easily.",
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-BS6TSMM1ZR"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-BS6TSMM1ZR');
          `}
        </Script>
      </body>
    </html>
  );
}