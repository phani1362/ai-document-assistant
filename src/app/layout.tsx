import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG-Powered Document Q&A",
  description:
    "Upload a document, ask questions, and get accurate answers grounded in the uploaded content with visible source references.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans text-foreground">{children}</body>
    </html>
  );
}
