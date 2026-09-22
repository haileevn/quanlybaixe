import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sổ bãi xe",
    short_name: "Bãi xe",
    description: "Quản lý gửi xe tháng trên điện thoại",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF6EE",
    theme_color: "#0F4C5C",
    lang: "vi",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
