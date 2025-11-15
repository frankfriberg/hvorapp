import { NextRequest, NextResponse } from 'next/server';
import { getMapImageUrl } from '@/lib/mapImage';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const arena = searchParams.get('arena') || 'salen';
  const location = searchParams.get('location') || 'X16Y30';
  
  const imageUrl = getMapImageUrl(arena, location);
  
  return NextResponse.json({
    success: true,
    arena,
    location,
    imageUrl,
    testUrls: {
      small: getMapImageUrl(arena, location, { width: 600, height: 315 }),
      medium: getMapImageUrl(arena, location, { width: 1200, height: 630 }),
      large: getMapImageUrl(arena, location, { width: 1600, height: 840 }),
    }
  });
}

export const runtime = 'edge';