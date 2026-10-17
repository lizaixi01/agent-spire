async page => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:960});
  await page.goto('http://127.0.0.1:5173/');
  const fixtures=await page.evaluate(async()=>{
    const e=await import('/src/engine.ts'), c=await import('/src/content.ts');
    const t=await import('/src/trials.ts'), h=await import('/src/learning-hints.ts');
    const trials=[]; let map=e.createRun('scholar',23);
    for(let chapter=1;chapter<=10;chapter++){
      const start=structuredClone(map), node=e.availableNodes(start)[0]; node.kind='quiz';
      const run=e.enterNode(start,node.id);
      trials.push({run,questions:[0,1,2].map(i=>t.trialQuestionAt(run.quiz,i)),hints:[0,1,2].map(i=>h.trialHint(t.trialQuestionAt(run.quiz,i)))});
      map=e.finishQuiz({...map,screen:'quiz',quiz:{lessonId:c.actLessons(chapter)[0].id,selected:0,correct:false,boss:true}});
    }
    const legacy=structuredClone(trials[2].run);
    legacy.quiz={lessonId:'memory',selected:null,correct:null,boss:false,trial:{id:'checkpoint-write',revision:1,step:0,answers:[],reward:null,order:[1,0,2],optionOrders:[[2,0,1],[1,2,0],[0,1,2]]}};
    const single=structuredClone(trials[1].run);
    single.quiz={lessonId:'skills',selected:null,correct:null,boss:false};
    return {trials,old:[legacy,single].map(run=>({run,hint:h.trialHint(t.trialQuestion(run.quiz))})),
      lessons:c.LESSONS.map(l=>({...l,hint:h.practiceHint(l.id)}))};
  });
  await page.goto('http://127.0.0.1:4173/');
  const snapshot=()=>page.evaluate(()=>JSON.stringify([localStorage.getItem('agent-spire.run.v1'),localStorage.getItem('agent-spire.knowledge.v1')]));
  const runSave=()=>page.evaluate(()=>localStorage.getItem('agent-spire.run.v1'));
  const load=async run=>{
    await page.evaluate(r=>localStorage.setItem('agent-spire.run.v1',JSON.stringify(r)),run);
    await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  };
  const checkCollapsed=async scope=>{
    const toggle=page.locator(`[data-action="${scope}-hint"]`);
    if(await toggle.count()!==1||await toggle.getAttribute('aria-expanded')!=='false'||await page.locator(`#${scope}-hint`).isVisible())throw new Error(scope+' hint not initially collapsed');
  };
  const openHint=async(scope,hint,keyboard=false)=>{
    const before=await snapshot(), toggle=page.locator(`[data-action="${scope}-hint"]`);
    if(keyboard){await toggle.focus();await page.keyboard.press('Enter');}else await toggle.click();
    const panel=page.locator(`#${scope}-hint`);
    if(!await panel.isVisible()||await toggle.getAttribute('aria-expanded')!=='true')throw new Error(scope+' hint not expanded');
    const text=await panel.innerText();
    if(!text.includes(hint.focus)||!text.includes(hint.method)||text.includes('undefined'))throw new Error(scope+' hint does not match current question');
    if(await snapshot()!==before)throw new Error(scope+' hint changed save, answer, mastery or resources');
  };
  for(const [index,f] of fixtures.trials.entries()){
    await load(f.run);
    for(let step=0;step<3;step++){
      await checkCollapsed('quiz');
      if(await page.locator('.quiz-explanation, .option-analysis, .quiz-option.correct').count())throw new Error('Quiz answer leaked before selection');
      await openHint('quiz',f.hints[step],step===0);
      await page.locator('[data-action="quiz-hint"]').click();
      await checkCollapsed('quiz');
      await openHint('quiz',f.hints[step]);
      if(index===0&&step===0){
        await page.screenshot({path:'output/knowledge-trial-hint-desktop.png',fullPage:true});
        await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
        await checkCollapsed('quiz');
      }
      await page.locator('[data-action="answer"]').nth(f.questions[step].correct).click();
      if(await page.locator('[data-action="quiz-hint"], #quiz-hint').count())throw new Error('Answered trial should show its explanation');
      if(!await page.locator('.quiz-explanation').isVisible())throw new Error('Trial answer explanation missing');
      await page.locator('[data-action="finish-quiz"]').click();
    }
    const claimed=JSON.parse(await runSave());
    if(claimed.player.gold<=f.run.player.gold)throw new Error('Hint prevented normal trial reward');
  }
  for(const old of fixtures.old){
    await load(old.run); await checkCollapsed('quiz'); await openHint('quiz',old.hint);
  }
  await page.getByRole('button',{name:'图鉴',exact:true}).click();
  await page.locator('[data-action="lesson"][data-id="agent"]').click();
  await page.locator('[data-action="practice"]').click();
  const baselineRun=await runSave();
  for(const [index,l] of fixtures.lessons.entries()){
    if(!(await page.locator('.practice-question').innerText()).includes(l.question))throw new Error('Practice advanced to unexpected question');
    await checkCollapsed('practice');
    if(await page.locator('.modal .quiz-explanation, .modal .quiz-option.correct').count())throw new Error('Practice answer leaked');
    await openHint('practice',l.hint,index===0);
    await page.locator('[data-action="practice-hint"]').click(); await checkCollapsed('practice');
    await openHint('practice',l.hint);
    if(index===0)await page.getByRole('dialog').screenshot({path:'output/codex-practice-hint-desktop.png'});
    await page.locator('[data-action="practice-answer"]').nth(l.correct).click();
    if(await page.locator('[data-action="practice-hint"], #practice-hint').count())throw new Error('Answered practice still has unanswered hint');
    if(!await page.locator('.modal .quiz-explanation').isVisible())throw new Error('Practice lost answer explanation');
    if(await runSave()!==baselineRun)throw new Error('Practice hint changed expedition');
    await page.locator('[data-action="next-practice"]').click();
  }
  // Reopening the same practice starts with a fresh, collapsed UI hint.
  await openHint('practice',fixtures.lessons[0].hint);
  await page.keyboard.press('Escape');
  await page.locator('[data-action="lesson"][data-id="agent"]').click();
  await page.locator('[data-action="practice"]').click(); await checkCollapsed('practice');
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  await load(fixtures.trials[0].run); await openHint('quiz',fixtures.trials[0].hints[0]);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Mobile trial hint overflow');
  await page.screenshot({path:'output/knowledge-trial-hint-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'图鉴',exact:true}).click();
  await page.locator('[data-action="lesson"][data-id="pass"]').click();
  await page.locator('[data-action="practice"]').click();
  const p=fixtures.lessons.find(l=>l.id==='pass');
  await openHint('practice',p.hint);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Mobile practice hint overflow');
  await page.getByRole('dialog').screenshot({path:'output/codex-practice-hint-mobile.png'});
  if(errors.length)throw new Error(errors.join('\n'));
  return 'PASS: all ten three-question trials, all 31 codex exercises, current/legacy/single questions, keyboard, collapse, stage reset, reload/reopen, unchanged saved resources/mastery, normal answers/rewards and mobile.';
}
