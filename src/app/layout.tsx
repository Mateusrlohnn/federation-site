import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rebug-site.vercel.app"),
  title: "Federação Rebug",
  description: "Federação de futebol do Hubbe — organizada por Levi, LebronGames e Pkzera",
  openGraph: {
    title: "Federação Rebug",
    description: "Federação de futebol do Hubbe — organizada por Levi, LebronGames e Pkzera",
    siteName: "Federação Rebug",
    images: [{ url: "/rebug-dc.webp" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Federação Rebug",
    description: "Federação de futebol do Hubbe — organizada por Levi, LebronGames e Pkzera",
    images: ["/rebug-dc.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script
          id="google-translate-script"
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
        <Script id="google-translate-init" strategy="afterInteractive">
          {`function googleTranslateElementInit() {
            new google.translate.TranslateElement({pageLanguage: 'en'}, 'google_translate_element');
          }`}
        </Script>
        <div id="google_translate_element" className="hidden"></div>

        <Header />
        <div className="mt-26 pb-10 min-h-screen">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
