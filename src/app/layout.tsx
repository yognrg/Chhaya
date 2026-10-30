import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans, Tiro_Devanagari_Marathi, VT323 } from "next/font/google";
import "./globals.css";

// Stand-ins until the self-hosted Cirka and Gilroy files are added to public/fonts.
// next/font downloads these at build time, so visitors never hit Google.
const display = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-display-fallback" });
const ui = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-ui-fallback" });
const marathi = Tiro_Devanagari_Marathi({ weight: "400", subsets: ["devanagari"], variable: "--font-marathi" });
// ASCII fonts.
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const plex = IBM_Plex_Mono({ weight: ["400", "600"], subsets: ["latin"], variable: "--font-plex" });
const vt323 = VT323({ weight: "400", subsets: ["latin"], variable: "--font-vt323" });

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
    <html lang="en" className={[display, ui, marathi, jetbrains, plex, vt323].map((f) => f.variable).join(" ")}>
      <body>{children}</body>
    </html>
  );
}
