import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["wiqjiwueociarhfj.public.blob.vercel-storage.com"],
  },
  output: "standalone",
  async headers() {
    return [
      {
        source: "/api/map-image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
