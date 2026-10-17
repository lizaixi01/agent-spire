async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  const fixtures = await page.evaluate(async () => {
    const engine = await import('/src/engine.ts');
    const { actLessons } = await import('/src/content.ts');
    const result = [];
    let map = engine.createRun('weaver', 42);
    for (let chapter = 1; chapter <= 10; chapter++) {
      const shopMap = structuredClone(map);
      engine.availableNodes(shopMap)[0].kind = 'shop';
      const shop = engine.enterNode(shopMap, engine.availableNodes(shopMap)[0].id);
      const quizMap = structuredClone(map);
      engine.availableNodes(quizMap)[0].kind = 'quiz';
      const quiz = engine.enterNode(quizMap, engine.availableNodes(quizMap)[0].id);
      const battle = engine.enterNode(map, engine.availableNodes(map)[0].id);
      result.push({ chapter, map, shop, quiz, battle });
      map = engine.finishQuiz({ ...map, screen: 'quiz', quiz: { lessonId: actLessons(chapter)[0].id, selected: 0, correct: false, boss: true } });
    }
    return result;
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.setViewportSize({ width: 1440, height: 960 });
  const restore = async run => {
    await page.evaluate(r => localStorage.setItem('agent-spire.run.v1', JSON.stringify(r)), run);
    await page.reload();
    await page.getByRole('button', { name: '继续学习', exact: true }).click();
  };
  for (const fixture of fixtures) {
    await restore(fixture.map);
    if (!(await page.locator('.map-main').innerText()).includes(`第 ${fixture.chapter} 幕`)) throw new Error('Act label mismatch');
    const labels = await page.locator('.node-chapter').allTextContents();
    if (!labels.every(label => Number(label) === fixture.chapter)) throw new Error('Mixed chapter nodes');
    if (fixture.chapter === 5) {
      await page.setViewportSize({ width: 390, height: 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('Long chapter name overflows mobile map');
      await page.screenshot({ path: 'output/curriculum-chapter-5-map-mobile.png', fullPage: true });
      await page.setViewportSize({ width: 1440, height: 960 });
    }
    await restore(fixture.shop);
    const sources = await page.locator('.shop-cards .game-card').evaluateAll(cards => cards.map(card => card.title));
    if (sources.length !== 3 || !sources.every(title => title.includes(`第 ${fixture.chapter} 章`))) throw new Error('Mixed chapter shop rewards');
    await restore(fixture.quiz);
    if (!(await page.locator('.quiz-page').innerText()).includes(`第 ${fixture.chapter} 章`)) throw new Error('Mixed chapter quiz');
    await restore(fixture.battle);
    if (!(await page.locator('.battle-top h2').innerText()).includes(`第 ${fixture.chapter} 章`)) throw new Error('Mixed chapter battle');
    if (!(await page.locator('.combat-knowledge small').innerText()).includes(`§${fixture.chapter}.`)) throw new Error('Mixed chapter teaching ribbon');
    if (fixture.chapter === 3 || fixture.chapter === 10) await page.screenshot({ path: `output/curriculum-chapter-${fixture.chapter}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('Chapter ten mobile overflow');
  await page.screenshot({ path: 'output/curriculum-chapter-10-mobile.png', fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  return 'PASS: all ten chapter maps, chapter-only shop/quiz/battle/teaching, production renders and mobile chapter ten.';
}
