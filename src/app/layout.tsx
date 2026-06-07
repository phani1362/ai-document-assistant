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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          // Apply the persisted theme before paint to avoid a flash of the wrong theme.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full font-sans text-foreground">{children}</body>
    </html>
  );
}
