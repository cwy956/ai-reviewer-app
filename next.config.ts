import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  // Dev server blocks requests from other devices' IPs by default (security feature) — allow
  // any device on the local network to actually use the app (not just view the page), e.g. a
  // laptop on the same wifi hitting this PC's LAN address during a demo. Wildcarded because
  // this PC's DHCP-assigned LAN IP changes on reconnect/restart (seen: .12, .3, ...).
  allowedDevOrigins: ["172.30.1.*"],
};

export default nextConfig;
