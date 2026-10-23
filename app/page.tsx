/**
 * @file app/page.tsx
 * @description Main entry page for ULTRON.
 * 
 * Responsibilities:
 * - Mounts the 3D Holographic HUD (`UltronOrb`) dynamically on the client side.
 * - Disables Server-Side Rendering (SSR) (`ssr: false`) because Three.js, WebGL,
 *   Web Audio API, and MediaPipe require the browser's `window` and `document` objects.
 */

"use client";

import dynamic from "next/dynamic";

// Dynamically import UltronOrb without SSR since WebGL and Three.js require browser APIs
const UltronOrb = dynamic(() => import("@/components/UltronOrb"), {
  ssr: false,
});

/**
 * Home component
 * Renders the primary fullscreen ULTRON interface.
 */
export default function Home() {
  return <UltronOrb />;
}
