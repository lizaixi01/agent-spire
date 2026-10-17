async function learningUI(page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("http://127.0.0.1:5173/");
  const text = await page.locator("body").innerText();
  for (const fluff of [
    "以知识为刃",
    "迷雾之上",
    "A ROGUELIKE JOURNEY",
    "三幕随机路线",
    "观察与思考",
    "亲手理解一个 Agent",
  ]) {
    if (text.includes(fluff))
      throw new Error("Decorative copy remains: " + fluff);
  }
  await page.getByRole("heading", { name: "深入理解 AI Agent" }).waitFor();
  if ((await page.locator('[data-action="study-chapter"]').count()) !== 10)
    throw new Error("Chapter navigation missing");
  if ((await page.locator(".home-page .model-identity").count()) !== 3)
    throw new Error("Three fixed characters missing");
  await page.locator('[data-action="study-chapter"][data-index="2"]').click();
  if ((await page.locator(".lesson-card").count()) !== 5)
    throw new Error("Chapter shortcut did not select the five context lessons");
  await page.getByRole("button", { name: "返回首页", exact: true }).click();
  await page.locator('[data-action="new"]').first().click();
  await page
    .locator('[data-action="select-character"][data-id="weaver"]')
    .click();
  await page.getByRole("textbox", { name: "远征种子（可选）" }).fill("42");
  await page.getByRole("button", { name: "踏入尖塔", exact: true }).click();
  await page
    .getByRole("button", { name: "第 1 层 未知遭遇，可前往" })
    .first()
    .click();
  await page.locator('.player-fighter [data-model="deepseek"]').waitFor();
  // Focused visual fixture: expose the combo cards without altering character rules.
  await page.evaluate(() => {
    const r=JSON.parse(localStorage.getItem('agent-spire.run.v1'));
    for(const id of ['observe','react','strike','strike']) {
      const index=r.battle.drawPile.findIndex(c=>c.defId===id);
      if(index>=0)r.battle.hand.push(...r.battle.drawPile.splice(index,1));
    }
    localStorage.setItem('agent-spire.run.v1',JSON.stringify(r));
  });
  await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  for(let step=0;step<2;step++) {
    const answer=await page.evaluate(async()=>{
      const {caseForBattle,transferFor}=await import('/src/learning-cases.ts');
      const r=JSON.parse(localStorage.getItem('agent-spire.run.v1')),c=caseForBattle(r);
      return r.battle.lab.choice===null?c.correct:transferFor(c).correct;
    });
    await page.locator('[data-action="lab-choice"]').nth(answer).click();
  }
  await page
    .getByRole("button", { name: "环境观测，0能量，抽 1 张牌。", exact: true })
    .click();
  if (!(await page.locator(".combat-knowledge").innerText()).includes("思考"))
    throw new Error("Played card does not show source knowledge");
  await page.getByRole("button", { name: "查看原理", exact: true }).click();
  if (!(await page.locator(".modal").innerText()).includes("PDF p.22"))
    throw new Error("Source page missing");
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "继续学习", exact: true }).click();
  await page.locator('.player-fighter [data-model="deepseek"]').waitFor();
  return "PASS: concise learning home, ten chapters, three fixed chibi characters, DeepSeek battle appearance and immediate PDF-linked knowledge.";
}
