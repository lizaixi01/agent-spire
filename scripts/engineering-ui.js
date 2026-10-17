// Isolated browser only. Fixtures are created through the public state machine.
async function engineeringUI(page) {
  const base=page.url().includes(':4173')?'http://127.0.0.1:4173/':'http://127.0.0.1:5173/';
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  const fixtures=await page.evaluate(async()=>{
    const e=await import('/src/engine.ts'), c=await import('/src/learning-cases.ts'), t=await import('/src/trials.ts');
    const {actLessons}=await import('/src/content.ts');
    function chapterRun(chapter) {
      let r=e.createRun('scholar',71);
      while(r.act<chapter)r=e.finishQuiz({...r,screen:'quiz',quiz:{lessonId:actLessons(r.act)[0].id,selected:0,correct:false,boss:true}});
      return r;
    }
    let r=chapterRun(10);const battles=[];
    for(let i=0;i<6;i++){
      const ready={...r,screen:'map',battle:null,position:null,visited:[]};
      r=e.enterNode(ready,e.availableNodes(ready)[0].id);
      const q=c.caseForBattle(r),second=c.transferFor(q);
      battles.push({run:r,prompt:q.situation,code:q.evidence,first:q.correct,second:second.correct});
    }
    const quizzes=[['checkpoint-write','checkpoint-boundary',3],['memory-write','memory-late-arrival',3],['compaction-trigger','compaction-reserve',2]].map(([id,key,chapter])=>{
      const source=t.TRIAL_BY_ID[id],index=source.questions.findIndex(q=>q.id===key);
      const start=chapterRun(chapter),node=e.availableNodes(start)[0];node.kind='quiz';
      const run=e.enterNode(start,node.id);
      const order=[index,...source.questions.map((_,i)=>i).filter(i=>i!==index).slice(0,2)];
      run.quiz={lessonId:source.questions[index].lessonId,selected:null,correct:null,boss:false,trial:{id,revision:2,step:0,answers:[],reward:null,order,optionOrders:[[2,0,1],[1,2,0],[0,1,2]]}};
      run.player.hp=40;run.player.potions=[];
      return {run,key,questions:[0,1,2].map(i=>t.trialQuestionAt(run.quiz,i))};
    });
    return {battles,quizzes};
  });
  await page.goto(base);await page.setViewportSize({width:1440,height:960});
  async function load(run) {
    await page.evaluate(r=>localStorage.setItem('agent-spire.run.v1',JSON.stringify(r)),run);
    await page.reload();await page.getByRole('button',{name:'继续学习',exact:true}).click();
  }
  const seen=new Set();
  for(const [i,f] of fixtures.battles.entries()){
    await load(f.run);
    const prompt=await page.locator('.lab-situation').innerText();
    if(seen.has(prompt))throw new Error('Repeated chapter-10 engineering decision');seen.add(prompt);
    if((await page.locator('.lab-code').innerText())!==f.code)throw new Error('Code damaged by HTML rendering');
    if(await page.locator('.hand .game-card:not(:disabled)').count())throw new Error('Mandatory gate bypassed');
    if(i===0)await page.screenshot({path:'output/engineering-chapter10-a.png',fullPage:true});
    await page.locator('[data-action="lab-choice"]').nth(f.first).click();
    if((await page.locator('.lab-situation').innerText())===prompt)throw new Error('Second stage still shows old prompt');
    if(!(await page.locator('.lab-panel > summary').innerText()).includes('错因辨析'))throw new Error('Diagnostic stage unclear');
    await page.locator('[data-action="lab-choice"]').nth(f.second).click();
    if(!(await page.locator('.lab-completion').innerText()).includes('掌握度 +1'))throw new Error('Shuffled answers lost correctness');
    if(i===1)await page.screenshot({path:'output/engineering-chapter10-b.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});await load(fixtures.battles[0].run);
  await page.locator('[data-action="focus-lab"]').click();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Mobile code causes page overflow');
  await page.screenshot({path:'output/engineering-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:960});
  for(const f of fixtures.quizzes){
    await load(f.run);
    if(await page.locator('.option-analysis').count())throw new Error('Rationales leaked before answer');
    if(await page.locator('.quiz-option.correct').count())throw new Error('Correct option leaked before answer');
    if((await page.locator('.trial-code').innerText())!==f.questions[0].code)throw new Error('Trial code changed');
    const wrong=(f.questions[0].correct+1)%3;
    await page.locator('[data-action="answer"]').nth(wrong).click();
    if(await page.locator('.option-analysis > div').count()!==3)throw new Error('Missing per-option diagnosis');
    const reason=await page.locator('.option-analysis > div').nth(wrong).innerText();
    if(!reason.includes('你的选择')||!reason.includes(f.questions[0].optionReasons[wrong]))throw new Error('Reason order differs from choice order');
    await page.screenshot({path:`output/engineering-${f.key}.png`,fullPage:true});
    await page.reload();await page.getByRole('button',{name:'继续学习',exact:true}).click();
    if(await page.locator('.option-analysis > div').count()!==3)throw new Error('Reload lost analysis');
    for(let i=1;i<3;i++){
      await page.locator('[data-action="finish-quiz"]').click();
      await page.locator('[data-action="answer"]').nth(f.questions[i].correct).click();
    }
    if(!(await page.locator('.trial-loot').innerText()).includes('80'))throw new Error('Passing reward changed');
    await page.locator('[data-action="finish-quiz"]').click();
    const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('agent-spire.run.v1')));
    if(after.player.gold!==179||after.player.hp!==48||after.player.potions[0]!=='energy')throw new Error('Incorrect claimed resources');
  }
  if(errors.length)throw new Error(errors.join('\n'));
  return 'PASS: six distinct chapter-10 code decisions, shuffled two-stage gate, mobile code scrolling, three practical topics, hidden explanations before answer, per-option rationale after answer, reload and real pass rewards.';
}
