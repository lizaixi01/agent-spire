// Production render regression, using valid engine-built fixtures from the dev server.
async function chapterUI(page) {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  const fixtures=await page.evaluate(async()=>{
    const {createRun,availableNodes,enterNode}=await import('/src/engine.ts');
    const {LESSONS}=await import('/src/content.ts');
    const {trialQuestionAt}=await import('/src/trials.ts');
    return Array.from({length:10},(_,i)=>{
      const chapter=i+1; let r=createRun('scholar',chapter*17);
      const n=availableNodes(r)[0];n.kind='quiz';n.lessonId=LESSONS.find(l=>l.chapter===chapter).id;
      r=enterNode(r,n.id);
      return {run:r,chapter,answers:[0,1,2].map(step=>trialQuestionAt(r.quiz,step).correct)};
    });
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.setViewportSize({width:1440,height:960});
  for(const fixture of fixtures){
    await page.evaluate(r=>localStorage.setItem('agent-spire.run.v1',JSON.stringify(r)),fixture.run);
    await page.reload();await page.getByRole('button',{name:'继续学习',exact:true}).click();
    if(!(await page.locator('.quiz-page').innerText()).includes(`第 ${fixture.chapter} 章`))throw new Error('Incorrect displayed chapter '+fixture.chapter);
    if(fixture.chapter===2)await page.screenshot({path:'output/production-chapter-2.png',fullPage:true});
    if(fixture.chapter===3){
      for(let i=0;i<3;i++){
        await page.locator('[data-action="answer"]').nth(fixture.answers[i]).click();
        if(i<2)await page.locator('[data-action="finish-quiz"]').click();
      }
      await page.locator('.trial-celebration-medallion').waitFor();
      await page.waitForFunction(()=>document.querySelector('.trial-celebration-banner')?.getAnimations()[0]?.currentTime>300);
      await page.screenshot({path:'output/production-trial-reward.png',fullPage:true});
      await page.getByRole('button',{name:'领取奖励',exact:true}).click();
      const r=await page.evaluate(()=>JSON.parse(localStorage.getItem('agent-spire.run.v1')));
      if(r.player.gold!==239)throw new Error('Production reward not claimed');
    }
  }
  await page.setViewportSize({width:390,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Production trial overflow');
  await page.screenshot({path:'output/production-chapter-10-mobile.png',fullPage:true});
  if(errors.length)throw new Error(errors.join('\n'));
  return 'PASS: production build renders all ten matching chapters, random answer order resolves correctly, reward medallion/particles and real gold claim, mobile layout, no page errors.';
}
