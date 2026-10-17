async page => {
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  const fixtures = await page.evaluate(async () => {
    const e = await import('/src/engine.ts');
    const c = await import('/src/learning-cases.ts');
    const t = await import('/src/trials.ts');
    const base = e.createRun('weaver', 42, 'hell');
    const fight = e.enterNode(base, e.availableNodes(base)[0].id);
    const first = c.caseForBattle(fight), second = c.transferFor(first);
    e.availableNodes(base)[0].kind = 'quiz';
    const quiz = e.enterNode(base, e.availableNodes(base)[0].id);
    return { fight, first, second, quiz, questions: [0, 1, 2].map(i => t.trialQuestionAt(quiz.quiz, i)) };
  });
  await page.goto('http://127.0.0.1:4173/');
  const saved = () => page.evaluate(() => localStorage.getItem('agent-spire.run.v1'));
  const load = async run => {
    await page.evaluate(r => localStorage.setItem('agent-spire.run.v1', JSON.stringify(r)), run);
    await page.reload();
    await page.getByRole('button', { name: '继续学习', exact: true }).click();
  };
  const expandLab = async () => {
    if (!await page.locator('.lab-panel').evaluate(el => el.open))
      await page.locator('.lab-panel > summary').click();
  };
  const noOverflow = async () => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
      throw new Error('Hell mode overflowed the viewport');
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    await page.evaluate(() => localStorage.removeItem('agent-spire.run.v1'));
    await page.reload();
    await page.getByRole('button', { name: '开始学习', exact: true }).click();
    const hell = page.locator('[data-action="select-learning-mode"][data-id="hell"]');
    await hell.click();
    if (await hell.getAttribute('aria-pressed') !== 'true') throw new Error('Mode selection is not accessible');
    if (!(await page.locator('.learning-mode').innerText()).includes('答错沿用入门模式的惩罚与奖励规则'))
      throw new Error('Existing penalty rule missing before starting');
    await page.getByRole('textbox', { name: '远征种子（可选）' }).fill('42');
    await page.locator('[data-action="select-character"][data-id="weaver"]').click();
    if (await page.getByRole('textbox', { name: '远征种子（可选）' }).inputValue() !== '42')
      throw new Error('Changing selection discarded the seed');
    await page.getByRole('dialog').screenshot({ path: `output/hell-selection-${width}.png` });
    await page.getByRole('button', { name: '踏入尖塔', exact: true }).click();
    await page.locator('[data-action="node"]:not(:disabled)').first().click();
    await expandLab();
    if (!await page.locator('.lab-code').isVisible()) throw new Error('Hell battle is not a code exercise');
    const beforeHint = await saved();
    await page.locator('[data-action="lab-hint"]').click();
    if (await saved() !== beforeHint) throw new Error('Hint altered the expedition');
    await noOverflow();
    await page.screenshot({ path: `output/hell-battle-${width}.png`, fullPage: true });
    await page.locator('[data-action="lab-choice"]').nth(fixtures.first.correct).click();
    await page.reload();
    await page.getByRole('button', { name: '继续学习', exact: true }).click();
    await expandLab();
    if (!(await page.locator('.lab-panel').innerText()).includes(fixtures.second.question))
      throw new Error('Reload changed the hard consolidation question');
    await page.locator('[data-action="lab-choice"]').nth((fixtures.second.correct + 1) % 3).click();
    await expandLab();
    if (!await page.locator('.lab-result.incorrect').isVisible()) throw new Error('Wrong battle answer did not show its explanation');
    if (!(await page.locator('.lab-completion').innerText()).includes(fixtures.second.options[fixtures.second.correct]))
      throw new Error('Review does not contain the actual shuffled correct option');
    if (JSON.parse(await saved()).screen !== 'combat') throw new Error('Wrong battle answer ended the run');
    if (await page.locator('.battle-page').getAttribute('data-locked') !== 'false') throw new Error('Completed exercise did not unlock cards');
    await page.screenshot({ path: `output/hell-wrong-answer-${width}.png`, fullPage: true });
    await page.reload();
    await page.getByRole('button', { name: '继续学习', exact: true }).click();
    await page.locator('[data-action="end-turn"]').click();
    if (JSON.parse(await saved()).battle.turn !== 2) throw new Error('Wrong answer blocked the next turn');

    await load(fixtures.quiz);
    for (let step = 0; step < 3; step++) {
      const q = fixtures.questions[step];
      if (!(await page.locator('.trial-code').innerText()).includes(q.code)) throw new Error('Trial fell back to a beginner question');
      await page.locator('[data-action="answer"]').nth(step === 2 ? (q.correct + 1) % 3 : q.correct).click();
      if (step < 2) await page.locator('[data-action="finish-quiz"]').click();
    }
    if (!await page.locator('.quiz-explanation').isVisible()) throw new Error('Wrong trial answer lost its explanation');
    const answeredQuiz = JSON.parse(await saved());
    if (answeredQuiz.screen !== 'quiz') throw new Error('Wrong trial answer ended the run');
    if (answeredQuiz.player.gold !== fixtures.quiz.player.gold) throw new Error('Trial awarded gold before claiming');
    const rewardGold = answeredQuiz.quiz.trial.reward.gold;
    if (rewardGold !== 80) throw new Error('Two correct answers did not use the existing reward');
    await page.locator('[data-action="finish-quiz"]').click();
    const claimedQuiz = JSON.parse(await saved());
    if (claimedQuiz.screen !== 'map' || claimedQuiz.player.gold !== fixtures.quiz.player.gold + rewardGold)
      throw new Error('Wrong answer blocked normal completion or reward');
    await noOverflow();

    await load(fixtures.fight);
    const beforePractice = await saved();
    await page.getByRole('button', { name: '图鉴', exact: true }).click();
    for (const lesson of ['context', 'cache', 'injection', 'skills', 'rag', 'hybrid']) {
      await page.locator(`[data-action="lesson"][data-id="${lesson}"]`).click();
      await page.locator('[data-action="practice"]').click();
      if (!await page.locator('.trial-code').isVisible()) throw new Error(`${lesson}: missing hard exercise`);
      await page.locator('[data-action="practice-answer"]').first().click();
      if (!await page.locator('.option-analysis').isVisible()) throw new Error('Free practice lost explanations');
      await noOverflow();
      if (lesson === 'rag') await page.getByRole('dialog').screenshot({ path: `output/hell-practice-${width}.png` });
      await page.keyboard.press('Escape');
    }
    if (await saved() !== beforePractice) throw new Error('Free practice changed or ended the active expedition');
    await page.locator('[data-action="select-learning-mode"][data-id="beginner"]').click();
    await page.locator('[data-action="lesson"][data-id="context"]').click();
    await page.locator('[data-action="practice"]').click();
    if (!await page.locator('.learning-intro').isVisible() || await page.locator('.trial-code').count())
      throw new Error('Cannot return to beginner practice');
    if (await saved() !== beforePractice) throw new Error('Practice difficulty changed saved run difficulty');
    await page.keyboard.press('Escape');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return 'PASS: selectable hell mode, existing wrong-answer penalties, seed preservation, code battles, partial reload, explanations and continued combat, three-step trials and normal rewards, six new hard exercises, free practice, normal-mode switch and desktop/mobile layout.';
}
