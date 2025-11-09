import { mkdirSync, rmSync } from "node:fs";
import puppeteer from "puppeteer";

import {
  columns,
  rows,
  getCellSize,
  formatGridCoordinates,
} from "../src/lib/grid";

const destination = "./salen";

const drawProgressBar = (current: number, goal: number): string => {
  const percentage = Math.floor((current / goal) * 100);
  const barWidth = 30;
  const filledWidth = Math.floor((percentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  const progressBar = "█".repeat(filledWidth) + "▒".repeat(emptyWidth);
  return `[${progressBar}] ${current}/${goal} ${percentage}%`;
};

async function generateImages() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("http://localhost:9100/salen");
    await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 1.5 });
    await page.waitForSelector("img");

    const map = await page.$("#touchzone");
    if (!map) {
      throw new Error("Could not find touchzone element");
    }

    const boundingBox = await map.boundingBox();
    if (!boundingBox) {
      throw new Error("Could not get bounding box for touchzone");
    }

    const { x, y, width, height } = boundingBox;

    const cellSize = getCellSize(width, height);

    const total = (columns + 1) * (rows + 1);

    let generated = 0;

    rmSync(destination, { recursive: true, force: true });
    mkdirSync(destination);

    console.log("🚀 Starting image generation...");

    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= columns; col++) {
        const xPos = x + col * cellSize.width + cellSize.width / 2;
        const yPos = y + row * cellSize.height + cellSize.height / 2;

        const path = `${destination}/${formatGridCoordinates(col, row)}.png`;

        await page.touchscreen.tap(xPos, yPos);
        await page.screenshot({ path });

        // Uncomment the lines below when you want to enable Cloudinary uploads
        // Make sure to set up environment variables first
        //
        // import { v2 as cloudinary } from "cloudinary";
        //
        // if (
        //   !process.env.CLOUDINARY_CLOUD_NAME ||
        //   !process.env.CLOUDINARY_API_KEY ||
        //   !process.env.CLOUDINARY_API_SECRET
        // ) {
        //   console.error(
        //     "❌ Missing Cloudinary environment variables. Please check your .env.local file.",
        //   );
        //   process.exit(1);
        // }
        //
        // cloudinary.config({
        //   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        //   api_key: process.env.CLOUDINARY_API_KEY,
        //   api_secret: process.env.CLOUDINARY_API_SECRET,
        // });
        //
        // await cloudinary.uploader
        //   .upload(path, {
        //     unique_filename: false,
        //     use_filename: true,
        //     folder: "hvorapp/salen",
        //   })
        //   .catch((error) => {
        //     console.log("Cloudinary upload error:", error);
        //   });

        generated++;

        if (process.stdout.clearLine) {
          process.stdout.clearLine(0);
        }
        if (process.stdout.cursorTo) {
          process.stdout.cursorTo(0);
        }
        process.stdout.write(`Generated: ${drawProgressBar(generated, total)}`);
      }
    }

    console.log("\n✅ Generation completed successfully!");
  } catch (error) {
    console.error("\n❌ Generation failed:", error);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

// Run the generation
generateImages().catch((error) => {
  console.error("Failed to generate images:", error);
  process.exit(1);
});
