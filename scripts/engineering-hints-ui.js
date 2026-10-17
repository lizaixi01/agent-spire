async page => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  const fixtures=await page.evaluate(async()=>{
    const e=await import('/src/engine.ts'), l=await import('/src/learning-cases.ts'), c=await import('/src/content.ts');
    const cases=[];
    let map=e.createRun('scholar',21);
    for(let chapter=1;chapter<=10;chapter++){
      const run=e.enterNode(map,e.availableNodes(map)[0].id), first=l.caseForBattle(run);
      cases.push({run,first,second:l.transferFor(first)});
      map=e.finishQuiz({...map,screen:'quiz',quiz:{lessonId:c.actLessons(chapter)[0].id,selected:0,correct:false,boss:true}});
    }
    for(let seed=0;seed<12;seed++){
      const start=e.createRun('scholar',seed), run=e.enterNode(start,e.availableNodes(start)[0].id), first=l.caseForBattle(run);
      if(first.id==='beginner-intro-react-error')return {cases,screenshot:{run,first,second:l.transferFor(first)}};
    }
    throw new Error('Screenshot question fixture not found');
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.setViewportSize({width:1440,height:960});
  const saved=()=>page.evaluate(()=>localStorage.getItem('agent-spire.run.v1'));
  const load=async run=>{
    await page.evaluate(r=>localStorage.setItem('agent-spire.run.v1',JSON.stringify(r)),run);
    await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  };
  for(const f of fixtures.cases){
    await load(f.run);
    const toggle=page.getByRole('button',{name:'提示',exact:true});
    if(await toggle.getAttribute('aria-expanded')!=='false'||await page.locator('#lab-hint').isVisible())throw new Error('Hints must be opt-in');
    const before=await saved();
    await toggle.focus(); await page.keyboard.press('Space');
    if(!await page.locator('#lab-hint').isVisible())throw new Error('Hint keyboard action failed');
    if((await page.locator('#lab-hint').innerText()).length<35)throw new Error('Hint has no useful direction');
    if(before!==await saved())throw new Error('Hint changed run, answer or resources');
    await page.getByRole('button',{name:'收起提示',exact:true}).click();
    if(await page.locator('#lab-hint').isVisible())throw new Error('Hint failed to collapse');
  }
  const f=fixtures.screenshot;
  await load(f.run);
  await page.getByRole('button',{name:'提示',exact:true}).click();
  if(!(await page.locator('#lab-hint').innerText()).includes(f.first.hint))throw new Error('Missing current beginner hint');
  if(await page.locator('.lab-code').count()||!(await page.locator('.learning-intro').innerText()).includes(f.first.intro))throw new Error('Beginner must get a plain-language introduction');
  await page.screenshot({path:'output/engineering-hint-desktop.png',fullPage:true});
  await page.locator('[data-action="lab-choice"]').nth((f.first.correct+1)%3).click();
  if(await page.locator('#lab-hint').isVisible())throw new Error('First hint leaked open into second stage');
  if(!await page.getByRole('status',{name:'上一题解析'}).isVisible())throw new Error('Hint broke first-step feedback');
  const before=await saved();
  await page.getByRole('button',{name:'提示',exact:true}).click();
  if(!(await page.locator('#lab-hint').innerText()).includes(f.second.hint))throw new Error('Missing current follow-up guidance');
  if(before!==await saved())throw new Error('Transfer hint modified saved state');
  await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  if(await page.locator('#lab-hint').isVisible())throw new Error('UI hint should be collapsed after reload');
  await page.locator('[data-action="lab-choice"]').nth(f.second.correct).click();
  if(await page.locator('[data-action="lab-hint"]').count())throw new Error('Completed decision should show explanations, not an unanswered hint');
  await page.setViewportSize({width:390,height:844});
  await load(f.run); await page.locator('[data-action="focus-lab"]').click();
  const toggle=page.getByRole('button',{name:'提示',exact:true});
  await toggle.scrollIntoViewIfNeeded();
  const top=await page.locator('.lab-body').evaluate(node=>node.scrollTop);
  await toggle.click();
  const after=await page.locator('.lab-body').evaluate(node=>node.scrollTop);
  if(Math.abs(after-top)>1)throw new Error('Hint reset question scroll position');
  if(!await page.locator('#lab-hint').isVisible())throw new Error('Mobile hint hidden');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Mobile hint overflows');
  await page.screenshot({path:'output/engineering-hint-mobile.png',fullPage:true});
  if(errors.length)throw new Error(errors.join('\n'));
  return 'PASS: beginner hints across ten chapters, simple reading guide, two stages, keyboard, collapse, unchanged save/resources, feedback, reload and mobile scroll.';
}
