import type { Plugin } from "vite";

const PRODUCTION_URL = "https://mototrack.thomasvigier.fr";
const APP_TITLE = "MotoTrack GPS";
const APP_DESCRIPTION = "Suivi GPS moto avec autonomie et historique des trajets";
const IMAGE_URL = `${PRODUCTION_URL}/opengraph.png`;

export function metaImagesPlugin(): Plugin {
  return {
    name: "vite-plugin-meta-images",
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/, `<title>${APP_TITLE}</title>`)
        .replace(
          /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/g,
          `<meta name="description" content="${APP_DESCRIPTION}" />`
        )
        .replace(
          /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/g,
          `<meta property="og:title" content="${APP_TITLE}" />`
        )
        .replace(
          /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/g,
          `<meta property="og:description" content="${APP_DESCRIPTION}" />`
        )
        .replace(
          /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/g,
          `<meta property="og:image" content="${IMAGE_URL}" />`
        )
        .replace(
          /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/g,
          `<meta property="og:url" content="${PRODUCTION_URL}" />`
        )
        .replace(
          /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/g,
          `<meta name="twitter:title" content="${APP_TITLE}" />`
        )
        .replace(
          /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/g,
          `<meta name="twitter:description" content="${APP_DESCRIPTION}" />`
        )
        .replace(
          /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/g,
          `<meta name="twitter:image" content="${IMAGE_URL}" />`
        );
    },
  };
}