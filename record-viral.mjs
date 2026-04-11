import puppeteer from "puppeteer";
import { execSync } from "child_process";
import { mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";

const URL = "http://localhost:3000/viral";
const FRAME_DIR = join(process.cwd(), "frames");
const OUTPUT = join(process.cwd(), "coinvoyage-deposit-viral.mp4");
const FPS = 30;
const WIDTH = 600;
const HEIGHT = 600;

// All 9 scenes: 3200+3200+3500+3800+3200+3500+3200+3500+3500 = 30600ms
// Add 1s buffer
const TOTAL_MS = 31600;
const TOTAL_FRAMES = Math.ceil((TOTAL_MS / 1000) * FPS);

async function main() {
  // Clean up old frames
  if (existsSync(FRAME_DIR)) rmSync(FRAME_DIR, { recursive: true });
  mkdirSync(FRAME_DIR, { recursive: true });

  console.log(`Recording ${TOTAL_FRAMES} frames at ${FPS}fps (${TOTAL_MS}ms)...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

  // Navigate and wait for page load
  await page.goto(URL, { waitUntil: "networkidle0" });

  // Wait a moment for initial render
  await new Promise((r) => setTimeout(r, 500));

  // Capture frames
  const frameInterval = 1000 / FPS;
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const padded = String(i).padStart(5, "0");
    await page.screenshot({
      path: join(FRAME_DIR, `frame_${padded}.png`),
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });

    if (i % 30 === 0) {
      console.log(`  Frame ${i}/${TOTAL_FRAMES} (${Math.round((i / TOTAL_FRAMES) * 100)}%)`);
    }

    // Wait for next frame
    await new Promise((r) => setTimeout(r, frameInterval));
  }

  console.log("All frames captured. Closing browser...");
  await browser.close();

  // Encode to MP4 with ffmpeg
  console.log("Encoding MP4 with ffmpeg...");
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${FRAME_DIR}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -vf "scale=${WIDTH * 2}:${HEIGHT * 2}" "${OUTPUT}"`,
    { stdio: "inherit" }
  );

  // Clean up frames
  rmSync(FRAME_DIR, { recursive: true });

  console.log(`\n✅ Video saved to: ${OUTPUT}`);
  console.log(`   Resolution: ${WIDTH * 2}x${HEIGHT * 2} (Retina)`);
  console.log(`   Duration: ~${TOTAL_MS / 1000}s`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
