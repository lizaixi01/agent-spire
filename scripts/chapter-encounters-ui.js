async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  const fixtures = await page.evaluate(async () => {
    const e = await import('/src/engine.ts'), c = await import('/src/content.ts');
    const learning = await import('/src/learning-cases.ts');
    const events = await import('/src/chapter-events.ts');
    const result = [];
    let map = e.createRun('weaver', 42);
    for (let chapter = 1; chapter <= 10; chapter++) {
      const bossMap = structuredClone(map), bossNode = e.availableNodes(bossMap)[0]; bossNode.kind = 'boss';
      let boss = e.enterNode(bossMap, bossNode.id);
      const lesson = learning.caseForBattle(boss);
      boss = e.answerLab(e.answerLab(boss, lesson.correct), learning.transferFor(lesson).correct);
      boss.battle.hand = [{ uid:'s',defId:'defend',upgraded:false }, {uid:'a',defId:'quick-strike',upgraded:false}];
      boss.player.energy = 10;
      const eventMap = structuredClone(map), eventNode = e.availableNodes(eventMap)[0]; eventNode.kind = 'event';
      if (chapter === 5) eventMap.deck[0].upgraded = true;
      eventMap.player.potions = ['heal','energy'];
      const event = e.enterNode(eventMap,eventNode.id);
      result.push({chapter,boss,event,title:events.eventView(event).title});
      map = e.finishQuiz({...map,screen:'quiz',quiz:{lessonId:c.actLessons(chapter)[0].id,selected:0,correct:false,boss:true}});
    }
    return result;
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.setViewportSize({width:1440,height:960});
  const load = async run => {
    await page.evaluate(r => localStorage.setItem('agent-spire.run.v1',JSON.stringify(r)),run);
    await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  };
  for (const f of fixtures) {
    await load(f.boss);
    const rule = page.getByRole('region',{name:'本章首领机制'});
    if (!(await rule.innerText()).includes(`第 ${f.chapter} 章`)) throw new Error('Boss source leaked chapter');
    if (!(await page.locator('.boss-progress').innerText()).length) throw new Error('No live boss status');
    if (f.chapter === 4) {
      await page.locator('[data-action="play"][data-id="s"]').click();
      await page.locator('[data-action="play"][data-id="a"]').click();
      if (!(await page.locator('.boss-progress').innerText()).includes('验证通过')) throw new Error('Contract rule not live');
      if (!(await page.locator('.enemy-intent').innerText()).includes('防御')) throw new Error('Intent not updated');
    }
    if (f.chapter === 8) {
      await page.locator('[data-action="boss-bait"]').click();
      if (!(await page.locator('[data-action="boss-bait"]').isDisabled())) throw new Error('Bait claimed twice');
      await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
      if (!(await page.locator('.boss-progress').innerText()).includes('永久 +3')) throw new Error('Bait debt lost on reload');
    }
    if ([6,10].includes(f.chapter)) {
      await page.setViewportSize({width:390,height:844});
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`Mobile boss ${f.chapter} overflow`);
      if (f.chapter === 10) {
        const bounds = await page.locator('.enemy-fighter').evaluateAll(nodes => nodes.map(node => ({ left:node.getBoundingClientRect().left, right:node.getBoundingClientRect().right })));
        if (bounds.some(rect => rect.left < 55 || rect.right > 390)) throw new Error('Council target clipped off screen');
        await page.getByRole('button',{name:'选择目标 议会审核者',exact:true}).click();
        if (!(await page.getByRole('button',{name:'选择目标 议会审核者',exact:true}).getAttribute('class')).includes('targeted')) throw new Error('Auditor not selectable on mobile');
      }
      await page.screenshot({path:`output/chapter-${f.chapter}-boss-mobile.png`,fullPage:true});
      await page.setViewportSize({width:1440,height:960});
    }
    await load(f.event);
    if (!(await page.locator('.event-page').innerText()).includes(f.title)) throw new Error('Chapter event title missing');
    if (!(await page.locator('.event-page').innerText()).includes(`第 ${f.chapter} 章`)) throw new Error('Event source leaked chapter');
    const targeted = [2,3,4,5,9].includes(f.chapter);
    const choice = page.locator(targeted ? '.event-targets [data-action="event-risk"]:not(:disabled)' : '[data-action="event-risk"]:not(:disabled)').first();
    if (!await choice.count()) throw new Error(`Chapter ${f.chapter} has no executable event option`);
    if (f.chapter === 9) {
      await page.setViewportSize({width:390,height:844});
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('Event card mobile overflow');
      await page.screenshot({path:'output/chapter-9-event-mobile.png',fullPage:true});
    }
    await choice.click();
    if (!(await page.locator('.map-main').count())) throw new Error('Event did not return to map');
    await page.setViewportSize({width:1440,height:960});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  return 'PASS: ten boss rules and live progress, contract intent, bait/reload, ten distinct event resolutions, mobile council and card targeting.';
}
