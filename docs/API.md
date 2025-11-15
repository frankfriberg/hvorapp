# Map Image API

## Overview

This API generates dynamic map images with location pins for sharing on social media and messaging platforms. Images are generated on-demand and cached indefinitely by CDN.

## Endpoint

```
GET /api/map-image
```

## Query Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `arena` | string | Yes | Arena name (currently only `salen` supported) | - |
| `location` | string | Yes | Location in format `XnYn` (e.g., `X10Y15`) | - |
| `width` | number | No | Image width in pixels (200-2000) | 1200 |
| `height` | number | No | Image height in pixels (200-2000) | 630 |

## Examples

### Basic Usage

```
GET /api/map-image?arena=salen&location=X16Y30
```

Returns a 1200x630px PNG image of Salen arena with a pin at grid position X16, Y30.

### Custom Dimensions

```
GET /api/map-image?arena=salen&location=X16Y30&width=1600&height=840
```

Returns a 1600x840px image.

### Social Media Sizes

**Facebook/LinkedIn (1200x630):**
```
/api/map-image?arena=salen&location=X16Y30&width=1200&height=630
```

**Twitter Summary Large Image (1200x600):**
```
/api/map-image?arena=salen&location=X16Y30&width=1200&height=600
```

**Instagram (1080x1080):**
```
/api/map-image?arena=salen&location=X16Y30&width=1080&height=1080
```

## Response

- **Content-Type:** `image/png`
- **Cache-Control:** `public, max-age=31536000, immutable`
- **Status Codes:**
  - `200` - Success
  - `400` - Invalid parameters
  - `500` - Server error

## Caching

Images are cached with a 1-year TTL (`max-age=31536000`). Once an image is generated, it will be served from CDN cache for all subsequent requests.

## Error Handling

### Missing Parameters
```
GET /api/map-image?arena=salen
=> 400 Bad Request: Missing required parameters
```

### Invalid Arena
```
GET /api/map-image?arena=invalid&location=X10Y15
=> 400 Bad Request: Currently only "salen" arena is supported
```

### Invalid Location Format
```
GET /api/map-image?arena=salen&location=invalid
=> 400 Bad Request: Invalid location format. Use format like X10Y15
```

### Invalid Dimensions
```
GET /api/map-image?arena=salen&location=X10Y15&width=5000
=> 400 Bad Request: Width and height must be between 200 and 2000 pixels
```

## Integration with Pages

The API is automatically integrated with location pages through Open Graph metadata:

```tsx
// src/app/(default)/salen/[location]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location } = await params;
  return generateMapMetadata('salen', location);
}
```

This ensures that when a location page is shared, the correct map image is displayed in social media previews.

## Testing

Test the API endpoint directly:
```
GET /api/test-image?arena=salen&location=X16Y30
```

Returns JSON with generated image URLs at different sizes.

## Technical Details

- **Runtime:** Node.js (uses Puppeteer for image generation)
- **Image Format:** PNG
- **Generation:** Server-side rendering with Puppeteer
- **Caching:** CDN-level with immutable cache headers
- **Performance:** ~500-1000ms cold start, <50ms from cache
