/**
 * @file app/layout.tsx
 * @description Root layout component for the ULTRON web interface.
 * 
 * Responsibilities:
 * - Configures global HTML structure, dark-theme viewport settings, and branding metadata.
 * - Injects global styling (`globals.css`).
 * - Includes a tamper-resistant fetch hardening script to prevent browser extensions from corrupting AI streaming responses.
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";

// Application metadata displayed in browser tabs and search cards
export const metadata: Metadata = {
  title: "ULTRON Orb UI",
  description: "An Iron Man-inspired holographic orb built with Three.js and Next.js",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/ultron_logo.png",
  },
};

// Viewport configuration ensuring black OLED background and crisp mobile/desktop scaling
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

/**
 * RootLayout
 * The top-level layout wrapper required by Next.js App Router.
 * Wraps all pages in an HTML5 shell and applies hydration-warning suppressions for client-only dynamic elements.
 * 
 * @param {Readonly<{ children: React.ReactNode }>} props - Child elements rendered inside the body.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Fetch Hardening Script:
          Ensures window.fetch remains bound to the native Window context even if third-party
          extensions or devtools attempt to hook or overwrite it, maintaining uninterrupted SSE streaming.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(typeof window!=="undefined"){var _f=window.fetch;var _b=_f?_f.bind(window):null;Object.defineProperty(window,"fetch",{configurable:true,enumerable:true,get:function(){return _b},set:function(v){_b=v}});if(typeof Window!=="undefined"&&Window.prototype){try{Object.defineProperty(Window.prototype,"fetch",{configurable:true,enumerable:true,get:function(){return _b},set:function(v){_b=v}})}catch(e){}}}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
