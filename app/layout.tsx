import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ULTRON Orb UI",
  description: "An Iron Man-inspired holographic orb built with Three.js and Next.js",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/ultron_logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
