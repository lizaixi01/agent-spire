// Run in an isolated playwright-cli session; resets only that test browser's local game storage.
async function browserSmoke(page) {
  await page.setViewportSize({ width:1440, height:960 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await page.getByRole("textbox", { name: "远征种子（可选）" }).fill("42");
  await page.getByRole("button", { name: "踏入尖塔", exact: true }).click();
  if (
    (await page
      .getByRole("button", { name: "第 1 层 未知遭遇，可前往" })
      .count()) !== 3
  )
    throw new Error("Initial routes missing");
  await page
    .getByRole("button", { name: "第 1 层 未知遭遇，可前往" })
    .first()
    .click();
  async function finishBattle() {
    while (await page.locator('[data-action="lab-choice"]').count()) {
      const index = await page.evaluate(async () => {
        const { caseForBattle, transferFor } = await import('/src/learning-cases.ts');
        const r = JSON.parse(localStorage.getItem('agent-spire.run.v1'));
        const c = caseForBattle(r);
        return r.battle.lab.choice === null ? c.correct : transferFor(c).correct;
      });
      await page.locator('[data-action="lab-choice"]').nth(index).click();
    }
    for (let step = 0; step < 65; step++) {
      if (await page.locator(".reward-page").count()) return;
      if (
        await page.locator('.battle-page[data-resolving="victory"]').count()
      ) {
        await page
          .getByRole("heading", { name: "选择一张卡牌", exact: true })
          .waitFor();
        return;
      }
      const hp = Number(
        (await page.locator(".player-fighter .health-bar").innerText()).match(
          /\d+/,
        )[0],
      );
      if (
        hp < 40 &&
        (await page
          .locator('[data-action="potion"][data-index="0"].heal')
          .count())
      ) {
        await page
          .locator('[data-action="potion"][data-index="0"].heal')
          .click();
        continue;
      }
      const cards = page.locator(".hand .game-card:not(:disabled)");
      if (await cards.count()) await cards.first().click();
      else await page.locator('[data-action="end-turn"]').click();
    }
    throw new Error("Battle failed to terminate");
  }
  await finishBattle();
  await page.locator('[data-action="reward"]').first().click();
  const before = await page.evaluate(() =>
    localStorage.getItem("agent-spire.run.v1"),
  );
  await page.reload();
  await page.getByRole("button", { name: "继续学习", exact: true }).click();
  const after = await page.evaluate(() =>
    localStorage.getItem("agent-spire.run.v1"),
  );
  if (before !== after) throw new Error("Refresh changed run");
  await page.locator('[data-action="node"][data-id="1-1-1"]').click();
  await finishBattle();
  await page.locator('[data-action="skip-reward"]').click();
  await page.locator('[data-action="node"][data-id="1-2-1"]').click();
  for (let i = 0; i < 3; i++) {
    const index = await page.evaluate(async () => {
      const { trialQuestion } = await import('/src/trials.ts');
      return trialQuestion(JSON.parse(localStorage.getItem('agent-spire.run.v1')).quiz).correct;
    });
    await page.locator('[data-action="answer"]').nth(index).click();
    await page.locator('[data-action="finish-quiz"]').click();
  }
  await page.locator('[data-action="node"][data-id="1-3-1"]').click();
  await finishBattle();
  await page.locator('[data-action="skip-reward"]').click();
  await page.locator('[data-action="node"][data-id="1-4-1"]').click();
  await page.locator('[data-action="buy-card"]:not(:disabled)').first().click();
  await page.getByRole("button", { name: "继续前进", exact: true }).click();
  await page.getByRole("button", { name: "图鉴", exact: true }).click();
  await page.getByRole("searchbox", { name: "搜索知识与概念" }).fill("ReAct");
  if ((await page.locator(".lesson-card").count()) !== 1)
    throw new Error("Search results mismatch");
  await page.locator(".lesson-card").click();
  await page.getByRole("button", { name: "检验我的理解", exact: true }).click();
  const practiceCorrect=await page.evaluate(async()=>{
    const {practiceQuestion}=await import('/src/beginner-content.ts'); return practiceQuestion('react').correct;
  });
  await page.locator('[data-action="practice-answer"]').nth(practiceCorrect).click();
  await page.getByRole("heading", { name: "理解正确", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw new Error("Mobile codex overflow");
  await page.getByRole("button", { name: "远征", exact: true }).click();
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw new Error("Mobile map overflow");
  await page.screenshot({ path: "output/mobile-map.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: "output/map.png" });
  if (errors.length) throw new Error(errors.join("\n"));
  return "PASS: character → map → mandatory decisions → battles → rewards → refresh/resume → shop → quiz → codex → practice → mobile; no page errors.";
}
