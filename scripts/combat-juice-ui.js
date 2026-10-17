// Isolated browser. Run against 5173 or 4173; fixture imports use the dev server.
async function combatJuiceUI(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const base = page.url().includes(':4173') ? 'http://127.0.0.1:4173/' : 'http://127.0.0.1:5173/';
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  const fixtures = await page.evaluate(async () => {
    const e = await import('/src/engine.ts'), s = await import('/src/save.ts'), l = await import('/src/learning-cases.ts');
    function fight(character, ids, hp = 100, block = 0) {
      const start = e.createRun(character, 42), r = e.enterNode(start, e.availableNodes(start)[0].id);
      r.battle.lab.choice = 0; r.battle.lab.transfer = 0;
      r.deck = ids.map((defId, i) => ({ uid: `fx-${i}`, defId, upgraded: false }));
      r.battle.hand = structuredClone(r.deck); r.battle.drawPile = []; r.battle.discard = [];
      r.player.potions = ['fire', 'heal']; r.player.energy = 8;
      Object.assign(r.battle.enemies[0], { hp, maxHp: 100, block, damage: 9, pattern: ['attack'] });
      if (!s.decodeRun(s.encodeRun(r))) throw Error('Invalid fixture');
      return r;
    }
    const locked = fight('weaver', ['strike']);
    locked.battle.lab.choice = null; locked.battle.lab.transfer = null;
    locked.battle.drawPile = [{ uid: 'learning-bonus', defId: 'defend', upgraded: false }];
    const scenario = l.caseForBattle(locked);
    return { locked, first: scenario.correct, second: l.transferFor(scenario).correct,
      multi: fight('weaver', ['flurry', 'strike', 'strike'], 100, 4),
      heavy: fight('engineer', ['heavy-strike', 'strike']),
      kill: fight('weaver', ['flurry'], 4), fire: fight('weaver', ['strike'], 8, 5) };
  });
  await page.goto(base);
  await page.setViewportSize({ width: 1440, height: 960 });
  async function load(r) {
    await page.evaluate(run => localStorage.setItem('agent-spire.run.v1', JSON.stringify(run)), r);
    await page.reload(); await page.getByRole('button', { name: '继续学习', exact: true }).click();
  }
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('agent-spire.run.v1')));
  await load(fixtures.locked);
  await page.locator(`[data-action="lab-choice"][data-index="${fixtures.first}"]`).click();
  for (const selector of ['.fx-number.energy', '.fx-number.draw']) if (!await page.locator(selector).count()) throw Error('Learning resource reward invisible: ' + selector);
  await page.locator(`[data-action="lab-choice"][data-index="${fixtures.second}"]`).click();
  for (const selector of ['.fx-number.gold', '.fx-number.mastery']) if (!await page.locator(selector).count()) throw Error('Learning completion reward invisible: ' + selector);
  await load(fixtures.multi);
  const controls = await page.locator('[data-action="end-turn"]').boundingBox();
  await page.locator('[data-action="play"][data-id="fx-0"]').click();
  if ((await saved()).battle.enemies[0].hp !== 95) throw Error('Real multi-hit damage changed');
  if ((await page.locator('.hit-number').allTextContents()).join('|') !== '格挡 3|−2|−3') throw Error('Missing individual hit numbers');
  await page.waitForTimeout(200);
  const motion = await page.evaluate(() => ({ camera: document.querySelector('.battlefield').getAnimations().length,
    effects: document.querySelector('.combat-fx').children.length,
    hp: document.querySelector('.enemy-health > span').textContent }));
  if (!motion.camera || !motion.effects) throw Error('No synchronized camera impact');
  const afterControls = await page.locator('[data-action="end-turn"]').boundingBox();
  if (Math.abs(controls.x - afterControls.x) > 1 || Math.abs(controls.y - afterControls.y) > 1) throw Error('Camera shakes the controls');
  await page.screenshot({ path: 'output/combat-multihit-impact.png' });
  // Play twice rapidly: inputs settle immediately, no animation lock or stale HP overwrite.
  await page.locator('[data-action="play"][data-id="fx-1"]').click();
  await page.locator('[data-action="play"][data-id="fx-2"]').click();
  if ((await saved()).battle.cardsPlayed !== 3) throw Error('Effects block rapid actions');
  await page.waitForTimeout(600);
  if (!(await page.locator('.enemy-health > span').innerText()).startsWith('83 /')) throw Error('Old animation overwrote the final HP');
  if (!(await page.locator('.fx-combo-meter').innerText()).includes('3 连奏')) throw Error('No real streak feedback');
  await page.waitForTimeout(1900);
  if (await page.locator('.combat-fx > span').count()) throw Error('Effect nodes leak');

  await load(fixtures.heavy);
  await page.locator('[data-action="play"][data-id="fx-0"]').click();
  if ((await saved()).battle.enemies[0].hp !== 60) throw Error('Heavy attack changed balance');
  if (!await page.locator('.hit-number.heavy').count()) throw Error('No weighted heavy hit');
  await page.waitForTimeout(190);
  await page.screenshot({ path: 'output/combat-heavy-impact.png' });

  for (const block of [0, 20]) {
    const r = structuredClone(fixtures.multi); r.player.block = block;
    await load(r); await page.locator('[data-action="end-turn"]').click();
    const next = await saved();
    if (next.player.hp !== r.player.hp - (block ? 0 : 9)) throw Error('Incoming arithmetic changed');
    if (!(await page.locator(block ? '.player-guard' : '.player-warning').innerText()).includes(block ? '完全格挡' : '受到 9 点伤害')) throw Error('Missing incoming warning');
    if (!block) { await page.waitForTimeout(260); await page.screenshot({ path: 'output/combat-player-hurt.png' }); }
  }

  for (const [key, selector] of [['kill', '[data-action="play"][data-id="fx-0"]'], ['fire', '[data-action="potion"][data-index="0"]']]) {
    await load(fixtures[key]); await page.locator(selector).click();
    if ((await saved()).screen !== 'reward') throw Error('Victory not saved immediately');
    if (!await page.locator('.battlefield').count()) throw Error('Victory skips the finishing strike');
    if (!await page.locator('.finisher').count()) throw Error('No finisher feedback');
    await page.waitForTimeout(1300);
    if (await page.locator('.battlefield').count()) throw Error('Victory transition stuck');
    if (await page.locator('.combat-fx').count()) throw Error('Battle effects spill onto rewards');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await load(fixtures.multi); await page.locator('[data-action="play"][data-id="fx-0"]').click();
  if (await page.locator('.fx-spark,.fx-impact-ring,.fx-impact-core').count()) throw Error('Reduced motion still has flashing particles');
  if (await page.evaluate(() => document.querySelector('.battlefield').getAnimations().length)) throw Error('Reduced motion still shakes');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Mobile overflow');
  await page.screenshot({ path: 'output/combat-reduced-mobile.png' });
  await page.getByRole('button', { name: '设置与来源', exact: true }).click();
  if (await page.locator('.combat-fx').count()) throw Error('Effects continue behind modal');
  await page.waitForTimeout(1000);
  if (await page.locator('.combat-fx').count()) throw Error('Cancelled effects return later');
  if (errors.length) throw Error(errors.join('\n'));
  return `PASS: ${base} multi-hit, break, heavy, rapid input, actual HP, incoming hurt/guard, finisher, fire potion, cleanup, reduced motion and mobile. Camera animations=${motion.camera}, bounded particles=${motion.effects}.`;
}
