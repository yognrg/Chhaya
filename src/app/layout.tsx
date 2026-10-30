import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans, Tiro_Devanagari_Marathi } from "next/font/google";
import "./globals.css";

// Stand-ins until the self-hosted Cirka and Gilroy files are added to public/fonts.
// next/font downloads these at build time, so visitors never hit Google.
const display = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-display-fallback" });
const ui = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-ui-fallback" });
const marathi = Tiro_Devanagari_Marathi({ weight: "400", subsets: ["devanagari"], variable: "--font-marathi" });

export const metadata: Metadata = {
  title: "Chhaya · a film camera for moments",
  description: "Shoot film-look photos in the browser. Everything happens on your device; nothing is uploaded.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F0F0E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${marathi.variable}`}>
      <body>{children}</body>
    </html>
  );
}
