import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Machine voice — the model's raw monologue and all telemetry data.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Display voice — the console's chrome and headings.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Project Cassandra — Oracle Console",
  description:
    "Chain-of-Thought Steganography Interceptor. Sees deceptive machine reasoning before it acts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="relative min-h-full">
        {/* Atmospheric backdrop — fixed, non-interactive, sits behind everything. */}
        <div className="atmosphere" aria-hidden="true">
          <div className="atmosphere__grid" />
          <div className="atmosphere__aurora atmosphere__aurora--cyan" />
          <div className="atmosphere__aurora atmosphere__aurora--violet" />
          <div className="atmosphere__aurora atmosphere__aurora--halt" />
          <div className="atmosphere__scan" />
          <div className="atmosphere__vignette" />
          <div className="atmosphere__noise" />
        </div>
        {children}
      </body>
    </html>
  );
}
