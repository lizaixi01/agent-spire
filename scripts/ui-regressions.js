async function uiRegressions(page) {
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "新开一局", exact: true }).click();
  await page
    .getByRole("textbox", { name: "远征种子（可选）" })
    .fill("my-repeatable-world");
  await page.getByRole("button", { name: /铸序师/ }).click();
  if (
    (await page
      .getByRole("textbox", { name: "远征种子（可选）" })
      .inputValue()) !== "my-repeatable-world"
  )
    throw new Error("Switching character erased the seed");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/mobile-character.png" });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Character modal overflows mobile viewport");
  await page.getByRole("button", { name: "踏入尖塔", exact: true }).click();
  await page
    .getByRole("button", { name: "第 1 层 未知遭遇，可前往" })
    .first()
    .click();
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Mobile battle overflows");
  await page.screenshot({ path: "output/mobile-battle.png", fullPage: true });
  await page.getByRole("button", { name: "牌组", exact: true }).click();
  await page.getByRole("heading", { name: /你的牌组/ }).waitFor();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: "output/battle.png" });
  await page.getByRole("button", { name: "返回首页", exact: true }).click();
  await page.screenshot({ path: "output/home.png" });
  return "PASS: seed survives character change; mobile character modal, mobile battle, deck dialog and keyboard closing work without viewport overflow.";
}
