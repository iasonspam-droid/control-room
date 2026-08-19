import { chromium } from "playwright";

const routes = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});

for (const r of routes) {
  const name = r.replace(/\//g, "") || "landing";
  await page.goto(`http://localhost:3000${r}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `shots/${name}.png`, fullPage: false });
  console.log("shot", name);
}

await browser.close();
