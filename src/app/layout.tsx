import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ 
  subsets: ["latin"], 
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Chess960 Explorer | Freestyle Chess Position Database",
    template: "%s | Chess960 Explorer"
  },
  description: "Explore all 960 Fischer Random starting positions with Stockfish 17 analysis, strategic plans, key squares, and GM tournament data from Freestyle Chess events.",
  keywords: ["chess960", "fischer random", "freestyle chess", "chess analysis", "stockfish", "chess positions", "chess openings", "bobby fischer", "chess variants"],
  authors: [{ name: "Chessiro" }],
  creator: "Chessiro",
  publisher: "Chessiro",
  applicationName: "Chess960 Explorer",
  icons: {
    icon: [
      { url: "/chessiro.svg", type: "image/svg+xml" },
    ],
    apple: "/chessiro.svg",
  },
  openGraph: {
    title: "Chess960 Explorer",
    description: "The ultimate Chess960 position explorer with engine analysis and GM game database.",
    type: "website",
    locale: "en_US",
    siteName: "Chess960 Explorer",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chess960 Explorer",
    description: "Explore all 960 Fischer Random starting positions with analysis and GM data.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} antialiased bg-background text-creme`}>
        {children}
      </body>
    </html>
  );
}
