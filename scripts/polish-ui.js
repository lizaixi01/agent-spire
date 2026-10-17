async function polishUI(page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeAudio = window.AudioContext;
    window.audioProbe = { contexts: [], notes: 0 };
    window.AudioContext = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        window.audioProbe.contexts.push(this);
      }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (...args) => {
          window.audioProbe.notes++;
          return start(...args);
        };
        return oscillator;
      }
    };
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 960 });
  if ((await page.locator(".home-heroes .model-sprite").count()) !== 3)
    throw new Error("Home must contain only three heroes");
  if ((await page.evaluate(() => window.audioProbe.contexts.length)) !== 0)
    throw new Error("Audio started before interaction");
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.audioProbe.notes > 0 &&
      window.audioProbe.contexts[0].state === "running",
  );
  if (
    (await page.locator(".character-option").count()) !== 3 ||
    (await page.locator('[data-action="select-model"]').count())
  )
    throw new Error("Additional cosmetic choices remain");
  await page.getByRole("textbox", { name: "远征种子（可选）" }).fill("42");
  await page.getByRole("button", { name: /铸序师/ }).click();
  if ((await page.locator("#seed").inputValue()) !== "42")
    throw new Error("Seed was erased");
  await page.getByRole("button", { name: /观测者/ }).click();
  await page.screenshot({ path: "output/polish-characters.png" });
  await page.getByRole("button", { name: "踏入尖塔", exact: true }).click();
  await page.getByRole("button", { name: "牌组", exact: true }).click();
  await page.locator('.deck-grid [data-concept="defend"]').first().waitFor();
  if (
    !(
      await page
        .locator('.deck-grid [data-concept="defend"]')
        .first()
        .getAttribute("aria-label")
    ).includes("上下文窗口")
  )
    throw new Error("Context picture has wrong meaning");
  const minimal = await page
    .locator(".deck-grid .concept-art")
    .first()
    .evaluate(
      (element) =>
        getComputedStyle(element).backgroundImage === "none" &&
        !!element.querySelector("svg"),
    );
  if (!minimal || (await page.locator(".game-card .model-sprite").count()))
    throw new Error("Cards are not minimal concept glyphs");
  await page.screenshot({ path: "output/polish-card-illustrations.png" });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "第 1 层 未知遭遇，可前往" })
    .first()
    .click();
  // Focused visual fixture: expose the combo cards without altering character rules.
  await page.evaluate(() => {
    const r=JSON.parse(localStorage.getItem('agent-spire.run.v1'));
    if (!r.deck.some(c => c.defId === 'react')) {
      const card = { uid: 'polish-react', defId: 'react', upgraded: false };
      r.deck.push(card); r.battle.hand.push({...card});
    }
    for(const id of ['observe','react','strike','strike']) {
      const index=r.battle.drawPile.findIndex(c=>c.defId===id);
      if(index>=0)r.battle.hand.push(...r.battle.drawPile.splice(index,1));
    }
    localStorage.setItem('agent-spire.run.v1',JSON.stringify(r));
  });
  await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  for (let step = 0; step < 2; step++) {
    const answer = await page.evaluate(async () => {
      const { caseForBattle, transferFor } = await import('/src/learning-cases.ts');
      const run = JSON.parse(localStorage.getItem('agent-spire.run.v1'));
      const c = caseForBattle(run);
      return run.battle.lab.choice === null ? c.correct : transferFor(c).correct;
    });
    await page.locator('[data-action="lab-choice"]').nth(answer).click();
  }
  await page
    .getByRole("button", { name: "环境观测，0能量，抽 1 张牌。", exact: true })
    .click();
  await page.locator(".fx-number.draw").last().waitFor();
  await page.getByRole("button", { name: /思考 · 行动，1能量/ }).click();
  await page.locator(".fx-number.damage").waitFor();
  if (
    !(await page.locator(".fx-number.damage").last().innerText()).includes("14")
  )
    throw new Error("Combo effect does not show actual damage");
  await page.waitForFunction(() => document.querySelector('.enemy-health')?.textContent?.includes('26 / 40'));
  if (!(await page.locator(".enemy-health").innerText()).includes("26 / 40"))
    throw new Error("VFX changed combat rules");
  await page.screenshot({ path: "output/polish-card-impact.png" });
  await page.getByRole("button", { name: "查看原理", exact: true }).click();
  if (!(await page.locator(".modal").innerText()).includes("PDF p.22"))
    throw new Error("PDF source missing");
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.querySelectorAll(".fx-cast").length === 0,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", {
      name: "工具调用，1能量，造成 6 点伤害。",
      exact: true,
    })
    .first()
    .click();
  if (await page.locator(".fx-cast").count())
    throw new Error("Reduced motion still launches card animation");
  await page.locator(".fx-number.damage.reduced").waitFor();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "设置与来源", exact: true }).click();
  if (
    await page.evaluate(() => {
      const layer = document.querySelector('.combat-fx');
      return layer !== null && getComputedStyle(layer).visibility !== 'hidden';
    })
  )
    throw new Error("Combat effects cover settings dialog");
  await page.getByRole("button", { name: "关闭音乐", exact: true }).click();
  await page.getByRole("button", { name: "关闭音效", exact: true }).click();
  await page.waitForFunction(
    () => window.audioProbe.contexts[0].state === "suspended",
  );
  await page.locator("#audio-volume").evaluate((element) => {
    element.value = "45";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  if ((await page.locator('[for="audio-volume"]').innerText()) !== "45%")
    throw new Error("Volume feedback missing");
  await page.screenshot({ path: "output/polish-audio-settings.png" });
  await page.reload();
  await page.getByRole("button", { name: "继续学习", exact: true }).click();
  if ((await page.evaluate(() => window.audioProbe.contexts.length)) !== 0)
    throw new Error("Muted settings were not restored");
  await page.getByRole("button", { name: "设置与来源", exact: true }).click();
  if ((await page.locator("#audio-volume").inputValue()) !== "45")
    throw new Error("Volume did not persist");
  await page.getByRole("button", { name: "开启音乐", exact: true }).click();
  await page.waitForFunction(() => window.audioProbe.notes > 0);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/polish-mobile-battle.png",
    fullPage: true,
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Mobile page overflows");
  await page.getByRole("button", { name: "返回首页", exact: true }).click();
  await page.getByRole("button", { name: "新开一局", exact: true }).click();
  await page.getByRole("button", { name: /织忆者/ }).click();
  await page.getByRole("textbox", { name: "远征种子（可选）" }).fill("42");
  await page.screenshot({ path: "output/polish-mobile-characters.png" });
  await page.getByRole("button", { name: "踏入尖塔", exact: true }).click();
  await page
    .getByRole("button", { name: "第 1 层 未知遭遇，可前往" })
    .first()
    .click();
  await page.locator('.player-fighter [data-model="deepseek"]').waitFor();
  await page.reload();
  await page.getByRole("button", { name: "继续学习", exact: true }).click();
  await page.locator('.player-fighter [data-model="deepseek"]').waitFor();
  if (errors.length) throw new Error(errors.join("\n"));
  return "PASS: three fixed heroes, concept card images, actual damage/draw effects, reduced motion, real browser audio start/mute/persistence, mobile layout and saved character.";
}
