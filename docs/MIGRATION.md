# Migration Summary: Pre-generated to Dynamic Images

## What Changed

✅ **Removed:**
- `src/app/(static)/[arena]/page.tsx` - Static generation page
- `lib/generate.ts` - Pre-generation script
- `npm run generate` - Script to pre-generate all images
- Cloudinary, imagemin dependencies - No longer needed

✅ **Added:**
- `src/app/api/map-image/route.ts` - Dynamic image generation API
- `src/app/api/test-image/route.ts` - Testing endpoint
- `src/lib/mapImage.ts` - Utility functions for generating image URLs
- `docs/API.md` - API documentation

✅ **Updated:**
- `src/app/(default)/salen/[location]/page.tsx` - Now uses dynamic API for OG images
- `next.config.ts` - Added caching headers for the API endpoint
- `package.json` - Removed unused dependencies and scripts

## How It Works Now

### Before (Pre-generation)
1. Run `npm run generate`
2. Puppeteer visits every grid position (32 × 60 = 1,920 positions)
3. Takes screenshot of each position
4. Uploads ~1,920 images to Cloudinary
5. Pages reference Cloudinary URLs
6. **Problem:** Takes hours to generate, uses lots of storage, hard to update

### After (Dynamic Generation)
1. User visits `/salen/X16Y30`
2. Page metadata includes `<meta og:image="/api/map-image?arena=salen&location=X16Y30">`
3. When shared, crawler requests the image URL
4. API generates image on-demand (first time: ~500ms)
5. Image cached with 1-year TTL by CDN
6. **Benefits:** Zero pre-generation, instant updates, no storage costs

## Testing

### Local Testing
```bash
# Start dev server
npm run dev

# Visit a location page
open http://localhost:9100/salen/X16Y30

# Test the API directly
open http://localhost:9100/api/map-image?arena=salen&location=X16Y30

# Test the test endpoint
open http://localhost:9100/api/test-image?arena=salen&location=X16Y30
```

### Production Testing
After deployment to Vercel:

1. **Test image generation:**
   ```
   https://yourdomain.com/api/map-image?arena=salen&location=X16Y30
   ```

2. **Test Open Graph preview:**
   - Share a location URL on Facebook, Twitter, LinkedIn, or Slack
   - Check that the map image appears correctly

3. **Verify caching:**
   - Check response headers - should include `Cache-Control: public, max-age=31536000, immutable`

## Benefits

1. **No Pre-generation Needed** - Saves hours of build time
2. **Storage Savings** - No need to store 1,920+ images
3. **Instant Updates** - Change design? Just update the API code
4. **Scalable** - Works with any number of positions
5. **Cost Effective** - No Cloudinary costs, Vercel caching handles everything
6. **Flexible** - Easy to add new arenas or customize image sizes

## Migration Checklist

- [x] Create dynamic image API endpoint
- [x] Create utility functions for image URLs
- [x] Update location pages to use dynamic API
- [x] Update Next.js config for caching
- [x] Remove static generation page
- [x] Remove generation script
- [x] Remove unused dependencies
- [x] Create API documentation
- [ ] Deploy to Vercel
- [ ] Test OG image previews on social media
- [ ] Monitor API performance

## Next Steps

1. **Deploy to Vercel** - Push to your main branch
2. **Test sharing** - Share a location link and verify the image appears
3. **Monitor performance** - Check Vercel logs for image generation times
4. **Optional:** Set up monitoring for the API endpoint

## Rollback Plan (if needed)

If you need to rollback:
1. The old Cloudinary images are still available at their URLs
2. Revert the changes to `src/app/(default)/salen/[location]/page.tsx`
3. Point `openGraph.images` back to Cloudinary URLs

However, the dynamic approach should work better in every way! 🚀
