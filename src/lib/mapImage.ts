/**
 * Generates a URL for the dynamic map image API endpoint
 * @param arena The arena name (e.g., 'salen')
 * @param location The location in XnYn format (e.g., 'X10Y15')
 * @param options Optional parameters for image generation
 * @returns The full URL to the generated image
 */
export function getMapImageUrl(
  arena: string,
  location: string,
  options: {
    width?: number;
    height?: number;
    baseUrl?: string;
  } = {},
): string {
  const {
    width = 1200,
    height = 630,
    baseUrl = typeof window !== "undefined"
      ? window.location.origin
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:9100",
  } = options;

  const params = new URLSearchParams({
    arena,
    location,
    width: width.toString(),
    height: height.toString(),
  });

  return `${baseUrl}/api/map-image?${params.toString()}`;
}

/**
 * Generates Open Graph metadata for a map location
 * @param arena The arena name
 * @param location The location in XnYn format
 * @param options Optional parameters
 * @returns Open Graph metadata object
 */
export function generateMapMetadata(
  arena: string,
  location: string,
  options: {
    title?: string;
    description?: string;
    imageWidth?: number;
    imageHeight?: number;
  } = {},
) {
  const {
    title = `${arena.charAt(0).toUpperCase() + arena.slice(1)} Arena - ${location}`,
    description = `Location ${location} in ${arena.charAt(0).toUpperCase() + arena.slice(1)}`,
    imageWidth = 1200,
    imageHeight = 630,
  } = options;

  const imageUrl = getMapImageUrl(arena, location, {
    width: imageWidth,
    height: imageHeight,
  });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: imageWidth,
          height: imageHeight,
          alt: `Map of ${arena} Arena showing location ${location}`,
        },
      ],
      type: "website" as const,
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [imageUrl],
    },
  };
}
