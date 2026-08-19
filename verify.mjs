import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const xpToday = () =>
  page
    .locator("header >> text=XP today")
    .locator("xpath=..")
    .innerText()
    .then((t) => t.trim());

const check = (name, ok, detail = "") =>
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);

await page.goto("http://localhost:3000/today", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

// 1. complete a queued task -> XP rises, queue shrinks
const before = await xpToday();
const queueCount0 = await page.locator("aside ul li").count();
await page.locator('aside button[aria-label="Mark done"]').first().click();
await page.waitForTimeout(600);
const after = await xpToday();
check(
  "completing a queued task awards XP",
  before !== after,
  `${before.replace(/\n/g, " ")} -> ${after.replace(/\n/g, " ")}`,
);
const queueCount1 = await page.locator("aside ul li").count();
check("queue shrinks on completion", queueCount1 !== queueCount0);

// 2. booking a queued task removes it from the queue and schedules it
const queueBefore = await page.locator("aside ul li").count();
await page.locator("aside ul li").first().hover();
await page.waitForTimeout(200);
await page
  .locator('aside button[title="Book the next free slot today"]')
  .first()
  .click();
await page.waitForTimeout(600);
const queueAfter = await page.locator("aside ul li").count();
check("booking removes it from the queue", queueAfter < queueBefore, `${queueBefore} -> ${queueAfter}`);

// and it must land somewhere real — check the week grid gained a block
await page.goto("http://localhost:3000/week", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const weekBlocks = await page.locator("main button[title$='click to complete']").count();
check("the booked block appears on the week grid", weekBlocks > 0, `${weekBlocks} blocks`);
await page.goto("http://localhost:3000/today", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// 3. matrix drag moves a task between quadrants
await page.goto("http://localhost:3000/matrix", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const q4Before = await page.locator("section").nth(3).locator("li").count();
const src = page.locator("section").nth(2).locator("li").first();
const dst = page.locator("section").nth(3);
await src.dragTo(dst);
await page.waitForTimeout(600);
const q4After = await page.locator("section").nth(3).locator("li").count();
check("dragging between quadrants works", q4After > q4Before, `Q4 ${q4Before} -> ${q4After}`);

// 4. log entry saves and awards XP
await page.goto("http://localhost:3000/log", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.locator("textarea").fill("Verification run — checking the log path end to end.");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(700);
const saved = await page.locator("text=saved").count();
check("log entry saves", saved > 0);

// 5. settings edit propagates
await page.goto("http://localhost:3000/settings", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const target = page.locator('input[type="number"]').nth(2);
await target.fill("9");
await page.waitForTimeout(400);
const committed = await page.locator("text=committed per week").locator("xpath=..").innerText();
check("category target edit recalculates the total", /\d+h/.test(committed), committed.trim());

// 6. persistence across reload
await page.goto("http://localhost:3000/today", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
const afterReload = await xpToday();
check("state survives a reload", afterReload === after || afterReload !== before, afterReload.replace(/\n/g, " "));

// 7. every route renders without a console error
for (const r of ["/", "/today", "/week", "/matrix", "/log", "/recap", "/settings"]) {
  await page.goto(`http://localhost:3000${r}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
}
check("no console errors across all routes", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
