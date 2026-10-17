async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: '开始学习', exact: true }).click();
  await page.locator('[data-action="select-character"][data-id="engineer"]').click();
  await page.getByRole('button', { name: '踏入尖塔', exact: true }).click();
  // Reproduce the exact old perfect-trial payout from the user's screenshot.
  await page.evaluate(() => {
    const key = 'agent-spire.run.v1';
    const run = JSON.parse(localStorage.getItem(key));
    delete run.curriculumVersion;
    run.player.relics = ['anvil', 'prism', 'battery', 'seal', 'heart'];
    run.screen = 'quiz';
    run.quiz = { lessonId: 'memory', selected: 0, correct: true, boss: false,
      trial: { id: 'checkpoint-write', step: 2, answers: [1, 2, 0], reward: { gold: 140, heal: 12, relic: 'thread', potion: null } } };
    localStorage.setItem(key, JSON.stringify(run));
  });
  await page.reload();
  await page.getByRole('button', { name: '继续学习', exact: true }).click();
  const loot = page.locator('.trial-loot');
  if (!(await loot.innerText()).includes('200 金币') || (await loot.innerText()).includes('记忆丝线')) throw new Error('Foreign perfect reward not migrated');
  await page.screenshot({ path: 'output/orange-trial-relic-fixed.png' });
  await page.locator('[data-action="finish-quiz"]').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('agent-spire.run.v1')));
  if (saved.player.relics.includes('thread') || saved.player.gold !== 299) throw new Error('Claim still grants foreign relic or wrong compensation');
  await page.reload();
  await page.getByRole('button', { name: '继续学习', exact: true }).click();
  if (await page.locator('.trial-loot').count()) throw new Error('Reward became claimable again');
  if (errors.length) throw new Error(errors.join('\n'));
  return 'PASS: legacy orange perfect payout changes from blue thread to 200 gold; one-time claim and reload preserve progress.';
}
