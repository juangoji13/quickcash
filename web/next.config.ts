import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // @ts-ignore - Propiedad requerida por Next.js dev para permitir acceso desde IP local
  allowedDevOrigins: ['192.168.1.176'],
};

export default nextConfig;
