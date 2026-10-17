async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  const fixtures = await page.evaluate(async () => {
    const { practiceQuestion } = await import('/src/beginner-content.ts');
    const e = await import('/src/engine.ts');
    const { caseForBattle, transferFor } = await import('/src/learning-cases.ts');
    let run = e.createRun('scholar', 42);
    run.screen = 'quiz';
    run.quiz = { lessonId: 'react', selected: 0, correct: false, boss: true };
    run = e.finishQuiz(run);
    run = e.enterNode(run, e.availableNodes(run)[0].id);
    run.battle.lab = { caseId: 'beginner-intro-skills-manual', choice: null, transfer: null,
      order: [2, 0, 1], transferOrder: [1, 2, 0] };
    const c = caseForBattle(run);
    return { questions: ['skills', 'memory', 'aci'].map(practiceQuestion), run,
      first: c.correct, transfer: transferFor(c) };
  });
  await page.goto('http://127.0.0.1:4173/');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const q of fixtures.questions) {
      await page.getByRole('button', { name: '图鉴', exact: true }).click();
      await page.locator(`[data-action="lesson"][data-id="${q.lessonId}"]`).click();
      await page.locator('[data-action="practice"]').click();
      const dialog = page.getByRole('dialog');
      const text = await dialog.innerText();
      if (![q.intro, q.scene, q.question, ...q.options].every(s => text.includes(s)))
        throw new Error(`${q.lessonId}: revised prompt or options missing`);
      const before = await page.evaluate(() => localStorage.getItem('agent-spire.run.v1'));
      await page.locator('[data-action="practice-hint"]').click();
      if (await page.evaluate(() => localStorage.getItem('agent-spire.run.v1')) !== before)
        throw new Error('Hint changed expedition resources');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
        throw new Error(`${q.lessonId}: mobile overflow`);
      await dialog.screenshot({ path: `output/feedback-${q.lessonId}-${width}.png` });
      await page.locator('[data-action="practice-answer"]').nth(q.correct).click();
      const analysis = await page.locator('.option-analysis').innerText();
      if (!q.optionReasons.every(s => analysis.includes(s))) throw new Error('Option explanations missing');
      await page.keyboard.press('Escape');
    }
    await page.evaluate(run => localStorage.setItem('agent-spire.run.v1', JSON.stringify(run)), fixtures.run);
    await page.reload();
    await page.getByRole('button', { name: '继续学习', exact: true }).click();
    if (!await page.locator('.lab-panel').evaluate(el => el.open))
      await page.locator('.lab-panel > summary').click();
    await page.locator('[data-action="lab-choice"]').nth(fixtures.first).click();
    if (!(await page.locator('.lab-panel').innerText()).includes(fixtures.transfer.question))
      throw new Error('Skills consolidation did not use revised question');
    if ((await page.locator('.lab-panel').innerText()).includes('完全隐藏能力目录'))
      throw new Error('Outdated absolute distractor remains');
    await page.screenshot({ path: `output/feedback-skills-transfer-${width}.png`, fullPage: true });
    await page.locator('[data-action="lab-choice"]').nth(fixtures.transfer.correct).click();
  }
  const paper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--spire-paper').trim());
  if (paper !== '#f8eed6') throw new Error('Merged brighter palette missing');
  if (errors.length) throw new Error(errors.join('\n'));
  return 'PASS: revised Skills, memory and tool questions, shuffled consolidation, explanations, hints, unchanged run resources, merged palette and desktop/mobile layout.';
}
