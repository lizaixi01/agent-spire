async page => {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:960});
  await page.goto('http://127.0.0.1:5173/');
  const fixtures=await page.evaluate(async()=>{
    const e=await import('/src/engine.ts'), l=await import('/src/learning-cases.ts');
    const map=e.createRun('scholar',42), run=e.enterNode(map,e.availableNodes(map)[0].id), c=l.caseForBattle(run);
    return {run,first:c,second:l.transferFor(c)};
  });
  await page.goto('http://127.0.0.1:4173/');
  const load=async run=>{
    await page.evaluate(r=>localStorage.setItem('agent-spire.run.v1',JSON.stringify(r)),run);
    await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  };
  for(const correct of [false,true]){
    await load(fixtures.run);
    if(await page.locator('.lab-feedback').count())throw new Error('Feedback leaked before answer');
    const c=fixtures.first, picked=correct?c.correct:(c.correct+1)%3;
    await page.locator('[data-action="lab-choice"]').nth(picked).click();
    const feedback=page.getByRole('status',{name:'上一题解析'});
    if(!await feedback.isVisible())throw new Error('Feedback still hidden after answer');
    const text=await feedback.innerText();
    for(const expected of [c.situation,c.options[picked],c.consequences[picked],c.options[c.correct],c.consequences[c.correct]])
      if(!text.includes(expected))throw new Error('Missing choice or reason: '+expected);
    if(!correct&&!text.includes('错在这里'))throw new Error('No explicit wrong-answer explanation');
    await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
    if(!await page.getByRole('status',{name:'上一题解析'}).isVisible())throw new Error('Reload hides first-step analysis');
    await page.locator('[data-action="lab-choice"]').nth(fixtures.second.correct).click();
    if(!await page.getByRole('status',{name:'上一题解析'}).isVisible())throw new Error('Review lost first-step explanation');
  }
  await page.setViewportSize({width:390,height:844});
  await load(fixtures.run); await page.locator('[data-action="focus-lab"]').click();
  await page.locator('[data-action="lab-choice"]').nth((fixtures.first.correct+1)%3).click();
  if(!await page.locator('.lab-feedback').isVisible())throw new Error('Mobile hides feedback');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Feedback overflows mobile');
  await page.screenshot({path:'output/engineering-first-step-feedback-mobile.png',fullPage:true});
  if(errors.length)throw new Error(errors.join('\n'));
  return 'PASS: first-step selected answer, correct answer and both reasons always visible; no pre-answer leak; reload, final review and mobile retain analysis.';
}
