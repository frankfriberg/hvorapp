import puppeteer from "puppeteer";
import { gridToPercentage, parseGridCoordinates } from "@/lib/grid";
import { type NextRequest, NextResponse } from "next/server";

// Cache for browser instance (in serverless environments, this helps with cold starts)
let browserInstance: any = null;

async function getBrowser() {
  if (browserInstance) {
    return browserInstance;
  }

  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-features=VizDisplayCompositor",
      "--disable-extensions",
      "--no-first-run",
      "--disable-default-apps",
    ],
  });

  return browserInstance;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const arena = searchParams.get("arena");
  const location = searchParams.get("location");
  const width = Number.parseInt(searchParams.get("width") || "1200");
  const height = Number.parseInt(searchParams.get("height") || "630");

  // Validate parameters
  if (!arena || !location) {
    return new NextResponse(
      "Missing required parameters. Use: ?arena=salen&location=X10Y15",
      {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      },
    );
  }

  // Validate arena
  if (arena !== "salen") {
    return new NextResponse('Currently only "salen" arena is supported', {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Validate dimensions
  if (width < 200 || width > 2000 || height < 200 || height > 2000) {
    return new NextResponse(
      "Width and height must be between 200 and 2000 pixels",
      {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      },
    );
  }

  // Parse the location coordinates
  const coords = parseGridCoordinates(location);
  if (!coords) {
    return new NextResponse("Invalid location format. Use format like X10Y15", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Convert grid coordinates to percentage
  const { percentageX, percentageY } = gridToPercentage(coords.x, coords.y);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    // Determine the base URL for assets
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:9100";

    // Create optimized HTML content
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              width: ${width}px;
              height: ${height}px;
              overflow: hidden;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .map-container {
              position: relative;
              width: 90%;
              height: 90%;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 20px 40px rgba(0,0,0,0.3);
              background: white;
            }
            
            .map-image {
              max-width: 100%;
              max-height: 100%;
              width: auto;
              height: auto;
              object-fit: contain;
            }
            
            .pin-container {
              position: absolute;
              top: ${percentageY}%;
              left: ${percentageX}%;
              transform: translate(-50%, -50%);
              z-index: 10;
              animation: pinDrop 0.6s ease-out;
            }
            
            @keyframes pinDrop {
              0% {
                transform: translate(-50%, -200%);
                opacity: 0;
              }
              60% {
                transform: translate(-50%, -40%);
              }
              100% {
                transform: translate(-50%, -50%);
                opacity: 1;
              }
            }
            
            .pin-icon {
              width: ${Math.max(30, width * 0.04)}px;
              height: ${Math.max(30, width * 0.04)}px;
              transform: translateY(-50%);
              filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
            }
            
            .pin-dot {
              position: absolute;
              top: 35%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: ${Math.max(6, width * 0.008)}px;
              height: ${Math.max(6, width * 0.008)}px;
              background-color: white;
              border-radius: 50%;
              box-shadow: 0 0 0 2px #E45F53;
            }
            
            .arena-label {
              position: absolute;
              bottom: 15px;
              left: 15px;
              background: rgba(0,0,0,0.8);
              backdrop-filter: blur(10px);
              color: white;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: ${Math.max(12, width * 0.012)}px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .coordinates {
              position: absolute;
              top: 15px;
              right: 15px;
              background: rgba(228, 95, 83, 0.9);
              color: white;
              padding: 6px 12px;
              border-radius: 16px;
              font-size: ${Math.max(10, width * 0.01)}px;
              font-weight: 500;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="map-container">
            <img src="${baseUrl}/arena/salen.svg" 
                 alt="Salen Arena Map" 
                 class="map-image" />
            
            <div class="pin-container">
              <svg class="pin-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22S19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9S10.62 6.5 12 6.5S14.5 7.62 14.5 9S13.38 11.5 12 11.5Z" fill="#E45F53"/>
              </svg>
              <div class="pin-dot"></div>
            </div>
            
            <div class="arena-label">
              ${arena.charAt(0).toUpperCase() + arena.slice(1)} Arena
            </div>
            
            <div class="coordinates">
              ${location}
            </div>
          </div>
        </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: "networkidle0" });

    // Take screenshot
    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
      omitBackground: false,
    });

    await page.close();

    // Return the image with caching headers
    return new NextResponse(screenshot, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="map-${arena}-${location}-${width}x${height}.png"`,
        "X-Generated-At": new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating map image:", error);
    return new NextResponse(`Error generating image: ${error.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// Clean up browser on process exit (for local development)
process.on("exit", async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
});

export const runtime = "nodejs";
