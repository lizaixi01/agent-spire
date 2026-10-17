async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  const correct = await page.evaluate(async () => {
    const { createRun, enterNode, availableNodes } = await import('/src/engine.ts');
    const { caseForBattle, transferFor } = await import('/src/learning-cases.ts');
    return Object.fromEntries(['scholar', 'engineer', 'weaver'].map(hero => {
      const base = createRun(hero, 42);
      const run = enterNode(base, availableNodes(base)[0].id);
      const c = caseForBattle(run);
      return [hero, [c.correct, transferFor(c).correct]];
    }));
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('button', { name: '开始学习', exact: true }).click();
  await page.locator('[data-action="select-character"][data-id="engineer"]').click();
  await page.getByRole('textbox', { name: '远征种子（可选）' }).fill('42');
  await page.getByRole('button', { name: '踏入尖塔', exact: true }).click();
  await page.locator('[data-action="node"]:not(:disabled)').first().click();
  await page.locator('[data-action="lab-choice"]').nth(correct['engineer'][0]).click();
  await page.locator('[data-action="lab-choice"]').nth(correct['engineer'][1]).click();
  const original = await page.evaluate(() => {
    const key = 'agent-spire.run.v1';
    const run = JSON.parse(localStorage.getItem(key));
    const oldCard = { uid: 'legacy-compress', defId: 'compress', upgraded: true };
    run.deck.push(oldCard);
    run.battle.hand.push(oldCard);
    localStorage.setItem(key, JSON.stringify(run));
    return { hp: run.player.hp, floors: run.floors, rng: run.rng, learned: run.learned };
  });
  await page.reload();
  await page.getByRole('button', { name: '继续学习', exact: true }).click();
  const fixedCard = page.locator('[data-action="play"][data-id="legacy-compress"]');
  if (!(await fixedCard.innerText()).includes('环境观测')) throw new Error('Foreign legacy card not migrated');
  if ((await fixedCard.innerText()).includes('织忆者专属')) throw new Error('Blue exclusive remains in orange hand');
  const beforeEnergy = Number(await page.locator('.energy-orb b').innerText());
  await fixedCard.click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('agent-spire.run.v1')));
  if (saved.player.energy !== beforeEnergy) throw new Error('Old compress still grants energy');
  if (saved.player.hp !== original.hp || saved.floors !== original.floors) throw new Error('Migration lost progress');
  const migrated = saved.deck.find(c => c.uid === 'legacy-compress');
  if (migrated.defId !== 'observe' || !migrated.upgraded) throw new Error('Migration lost identity or upgrade');
  await page.getByRole('button', { name: '牌组', exact: true }).click();
  if ((await page.locator('.deck-grid').innerText()).includes('织忆者专属')) throw new Error('Deck still has blue exclusive card');
  await page.screenshot({ path: 'output/orange-ownership-fixed.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  return 'PASS: orange legacy compress is migrated, upgrades and progress survive, playing the replacement cannot grant compress energy.';
}
