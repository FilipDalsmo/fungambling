import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "Fun Gambling · All play. No stakes.",
  description:
    "A play-money casino for the joy of the game. Play cards, meet friends and start fresh every day. Fictional chips only.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
