import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HYS Services",
  description: "Book verified local service professionals — HYS Services.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
