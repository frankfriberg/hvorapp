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
  } = {},
) {
  const {
    title = `${arena.charAt(0).toUpperCase() + arena.slice(1)} Arena - ${location}`,
    description = `Location ${location} in ${arena.charAt(0).toUpperCase() + arena.slice(1)} Arena`,
  } = options;

  // Next.js will automatically use the opengraph-image.tsx file
  // No need to manually specify the image URL
  return {
    title,
    description,
  };
}
