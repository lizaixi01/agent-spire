async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:960});
  await page.goto('http://127.0.0.1:5173/');
  const fixtures=await page.evaluate(async()=>{
    const e=await import('/src/engine.ts'), l=await import('/src/learning-cases.ts'), t=await import('/src/trials.ts');
    const c=await import('/src/content.ts'), s=await import('/src/save.ts');
    function start(chapter){let r=e.createRun('scholar',42);while(r.act<chapter)r=e.finishQuiz({...r,screen:'quiz',quiz:{lessonId:c.actLessons(r.act)[0].id,selected:0,correct:false,boss:true}});return r;}
    const first=start(1);let fight=e.enterNode(first,e.availableNodes(first)[0].id);
    fight.battle.lab={caseId:'code-v2-agent-capability',choice:null,transfer:null,order:[0,1,2],transferOrder:[0,1,2]};
    const pending=structuredClone(fight), source=l.caseForBattle(fight);
    fight=e.answerLab(fight,source.correct);
    const partial=fight;
    let quiz=start(3);quiz.screen='quiz';
    quiz.quiz={lessonId:'memory',selected:null,correct:null,boss:false,trial:{id:'checkpoint-write',revision:2,step:0,answers:[],reward:null,order:[0,1,2],optionOrders:[[0,1,2],[0,1,2],[0,1,2]]}};
    quiz=e.finishQuiz(e.answerQuiz(quiz,t.trialQuestion(quiz.quiz).correct));
    const partialQuiz=quiz;
    const restoredQuiz=s.decodeRun(JSON.stringify(quiz));
    return {pending,partial,partialQuiz,source,
      pendingCase:l.caseForBattle(s.decodeRun(JSON.stringify(pending))),
      second:l.transferFor(l.caseForBattle(s.decodeRun(JSON.stringify(partial)))),
      remaining:[1,2].map(i=>t.trialQuestionAt(restoredQuiz.quiz,i))};
  });
  await page.goto('http://127.0.0.1:4173/');
  const load=async run=>{await page.evaluate(r=>localStorage.setItem('agent-spire.run.v1',JSON.stringify(r)),run);await page.reload();await page.getByRole('button',{name:'继续学习',exact:true}).click();};
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('agent-spire.run.v1')));
  await load(fixtures.pending);
  if(await page.locator('.lab-code').count()||!(await page.locator('.learning-intro').innerText()).includes(fixtures.pendingCase.intro))throw new Error('Pending advanced battle not upgraded');
  await page.locator('[data-action="lab-choice"]').nth(fixtures.pendingCase.correct).click();
  let after=await saved();
  if(after.rng!==fixtures.pending.rng||after.position!==fixtures.pending.position||after.player.gold!==fixtures.pending.player.gold)throw new Error('Pending migration reset progress or resources');
  await page.screenshot({path:'output/beginner-first-decision.png',fullPage:true});
  await load(fixtures.partial);
  const feedback=await page.getByRole('status',{name:'上一题解析'}).innerText();
  if(!feedback.includes(fixtures.source.options[fixtures.source.correct]))throw new Error('First old answer lost');
  if(await page.locator('.lab-code').count()||!(await page.locator('.lab-situation').innerText()).includes(fixtures.second.question))throw new Error('Second stage still requires code');
  await page.locator('[data-action="lab-choice"]').nth(fixtures.second.correct).click();
  after=await saved();
  if(after.battle.lab.choice!==fixtures.partial.battle.lab.choice||after.player.energy!==fixtures.partial.player.energy||after.player.gold!==fixtures.partial.player.gold+10)throw new Error('Old first decision was regraded or paid twice');
  await load(fixtures.partialQuiz);
  if(await page.locator('.trial-code').count()||await page.locator('.trial-progress .passed').count()!==1)throw new Error('Quiz history or beginner migration incorrect');
  for(const q of fixtures.remaining){
    if(!(await page.locator('.learning-intro').innerText()).includes(q.intro))throw new Error('Missing simple explanation');
    await page.locator('[data-action="answer"]').nth(q.correct).click();
    after=await saved();
    if(after.quiz.trial.answers[0]!==fixtures.partialQuiz.quiz.trial.answers[0])throw new Error('Historical answer changed');
    if(q===fixtures.remaining[1]&&!(await page.locator('.trial-loot').innerText()).includes('完美通关'))throw new Error('Mixed old/new scoring failed');
    await page.locator('[data-action="finish-quiz"]').click();
  }
  after=await saved();
  if(after.player.gold!==fixtures.partialQuiz.player.gold+140)throw new Error('Migration changed trial payout');
  if(errors.length)throw new Error(errors.join('\n'));
  return 'PASS: old pending battle and partial quiz become beginner without restarting; past answers, initial progress, RNG and first-step resources preserved; scoring and one-time payout remain valid.';
}
