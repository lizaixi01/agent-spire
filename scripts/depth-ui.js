async function depthUI(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const base = page.url().includes(":4173")
    ? "http://127.0.0.1:4173/"
    : "http://127.0.0.1:5173/";
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await page.getByRole("textbox", { name: "远征种子（可选）" }).fill("42");
  await page.getByRole("button", { name: "踏入尖塔", exact: true }).click();
  await page
    .getByRole("button", { name: "第 1 层 未知遭遇，可前往" })
    .first()
    .click();
  // Focused visual fixture: expose the combo cards without altering character rules.
  await page.evaluate(() => {
    const r=JSON.parse(localStorage.getItem('agent-spire.run.v1'));
    if(!r.deck.some(c=>c.defId==='react')) {
      const card={uid:'depth-react',defId:'react',upgraded:false};
      r.deck.push(card); r.battle.hand.push({...card});
    }
    for(const id of ['observe','react','strike','strike']) {
      const index=r.battle.drawPile.findIndex(c=>c.defId===id);
      if(index>=0)r.battle.hand.push(...r.battle.drawPile.splice(index,1));
    }
    localStorage.setItem('agent-spire.run.v1',JSON.stringify(r));
  });
  await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  await page.locator(".lab-evidence").waitFor();
  const exercise=await page.evaluate(async()=>{
    const {caseForBattle,transferFor}=await import('/src/learning-cases.ts');
    const c=caseForBattle(JSON.parse(localStorage.getItem('agent-spire.run.v1')));
    return {first:c,second:transferFor(c)};
  });
  if (!(await page.locator(".lab-evidence").innerText()).includes(exercise.first.evidence)||
      !(await page.locator(".learning-intro").innerText()).includes(exercise.first.intro))
    throw new Error("First battle lacks beginner scene and explanation");
  if (!(await page.locator(".enemy-health").innerText()).includes("/ 40"))
    throw new Error("Combat still has old low HP");
  if (
    (await page.locator(".hand .concept-art svg").count()) !==
    (await page.locator(".hand .game-card").count())
  )
    throw new Error("Minimal card symbols missing");
  const background = await page
    .locator(".hand .concept-art")
    .first()
    .evaluate((e) => getComputedStyle(e).backgroundImage);
  if (background !== "none") throw new Error("Busy bitmap card art remains");
  await page.screenshot({ path: "output/depth-decision.png" });
  const energy = Number(await page.locator(".energy-orb b").innerText());
  await page.locator('[data-action="lab-choice"]').nth(exercise.first.correct).click();
  if (Number(await page.locator(".energy-orb b").innerText()) !== energy + 1)
    throw new Error("Correct engineering decision gives no immediate benefit");
  if (await page.locator(".lab-completion").count())
    throw new Error("One click falsely marked concept mastered");
  if(await page.locator('.lab-situation').innerText()!==exercise.second.question)
    throw new Error('Second stage did not show its own beginner scenario');
  await page.locator('[data-action="lab-choice"]').nth(exercise.second.correct).click();
  if (
    !(await page.locator(".lab-completion").innerText()).includes("掌握度 +1")
  )
    throw new Error("Transfer did not validate mastery");
  if (await page.locator('[data-action="lab-choice"]').count())
    throw new Error("Completed scenario can be farmed");
  await page.screenshot({ path: "output/depth-verified.png" });
  for (const selector of [".energy-orb", '[data-action="end-turn"]']) {
    const clear = await page.locator(selector).evaluate((e) => {
      const r = e.getBoundingClientRect();
      const hit = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      );
      return !!hit && (hit === e || e.contains(hit));
    });
    if (!clear) throw new Error("Hand obscures combat control: " + selector);
  }
  await page
    .getByRole("button", { name: "环境观测，0能量，抽 1 张牌。", exact: true })
    .click();
  if (
    !(await page.locator(".card-synergy").first().innerText()).includes(
      "伤害 +6",
    )
  )
    throw new Error("Card synergy has no preview");
  await page.getByRole("button", { name: /思考 · 行动，1能量/ }).click();
  await page.locator(".fx-number.chain").waitFor();
  if (
    (await page.locator(".battlefield").getAttribute("data-reaction")) !==
    "combo"
  )
    throw new Error("Combo impact missing");
  await page.waitForFunction(()=>document.querySelector('.enemy-health')?.textContent?.includes('26 / 40'));
  if (!(await page.locator(".enemy-health").innerText()).includes("26 / 40"))
    throw new Error("ReAct combo has incorrect actual damage");
  await page.screenshot({ path: "output/depth-combo.png" });
  await page.getByRole("button", { name: "查看原理", exact: true }).click();
  if (!(await page.locator(".modal").innerText()).includes("PDF p.22"))
    throw new Error("Original PDF reference lost");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", {
      name: "工具调用，1能量，造成 6 点伤害。",
      exact: true,
    })
    .first()
    .dragTo(page.locator(".enemy-fighter").first());
  await page.waitForFunction(()=>document.querySelector('.enemy-health')?.textContent?.includes('20 / 40'));
  if (!(await page.locator(".enemy-health").innerText()).includes("20 / 40"))
    throw new Error("Aimed card play failed or played twice");
  await page.reload();
  await page.getByRole("button", { name: "继续学习", exact: true }).click();
  if (
    !(await page.locator(".lab-completion").innerText()).includes("掌握度 +1")
  )
    throw new Error("Learning decision did not survive reload");
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Mobile battle overflows");
  await page.screenshot({ path: "output/depth-mobile.png", fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", {
      name: "工具调用，1能量，造成 6 点伤害。",
      exact: true,
    })
    .first()
    .click();
  if (await page.locator(".fx-cast").count())
    throw new Error("Reduced motion still flies cards");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 960 });
  for (let step = 0; step < 35; step++) {
    if (await page.locator('.battle-page[data-resolving="victory"]').count()) {
      await page
        .getByRole("heading", { name: "选择一张卡牌", exact: true })
        .waitFor();
      break;
    }
    if (await page.locator(".reward-page").count()) break;
    const playable = page.locator(".hand .game-card:not(:disabled)");
    if (await playable.count()) await playable.first().click();
    else await page.locator('[data-action="end-turn"]').click();
  }
  await page
    .getByRole("heading", { name: "选择一张卡牌", exact: true })
    .waitFor();
  await page.screenshot({ path: "output/depth-rewards.png" });
  if (errors.length) throw new Error(errors.join("\n"));
  return "PASS: evidence → decision → transfer → mastery, minimal symbols, new combat HP, synergy preview + actual result + impact, saved lab, mobile, reduced motion and full victory reward flow.";
}
