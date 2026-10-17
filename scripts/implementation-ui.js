// Isolated test profile. Valid engine fixtures exercise focused render/effect states.
async function implementationUI(page) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.effectNotes = 0;
    window.AudioContext = class extends Native {
      createOscillator() {
        const o = super.createOscillator(), start = o.start.bind(o);
        o.start = (...args) => { window.effectNotes++; return start(...args); };
        return o;
      }
    };
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("button", { name: "开始学习", exact:true }).click();
  await page.locator("#seed").fill("42");
  await page.getByRole("button", { name:"踏入尖塔", exact:true }).click();
  await page.locator('[data-action="node"][data-id="1-0-0"]').click();
  const initial = await page.evaluate(() => localStorage.getItem("agent-spire.run.v1"));
  if (await page.locator('.hand .game-card:not(:disabled)').count()) throw new Error("Cards bypass mandatory decision");
  if (!(await page.locator('[data-action="end-turn"]').isDisabled())) throw new Error("Turn bypasses gate");
  if (await page.locator('[data-action="potion"]:not(:disabled)').count()) throw new Error("Potion bypasses gate");
  await page.keyboard.press("1"); await page.keyboard.press("e");
  if (initial !== await page.evaluate(() => localStorage.getItem("agent-spire.run.v1"))) throw new Error("Keyboard bypassed gate");
  await page.screenshot({path:"output/mandatory-gate.png"});
  const exercise=await page.evaluate(async()=>{
    const {caseForBattle,transferFor}=await import('/src/learning-cases.ts');
    const c=caseForBattle(JSON.parse(localStorage.getItem('agent-spire.run.v1')));
    return {first:c.correct,second:transferFor(c).correct};
  });
  await page.locator('[data-action="lab-choice"]').nth(exercise.first).click();
  if (await page.locator('.hand .game-card:not(:disabled)').count()) throw new Error("Unlocked after one answer");
  await page.locator('[data-action="lab-choice"]').nth(exercise.second).click();
  if (!(await page.locator('.hand .game-card:not(:disabled)').count())) throw new Error("Cards still locked after both stages");
  await page.locator('[data-action="end-turn"]').click();
  await page.locator(".fx-number.player-warning").waitFor();
  if (!(await page.locator(".fx-number.player-warning").innerText()).includes("3")) throw new Error("Incorrect incoming damage warning");
  if (!(await page.locator(".fx-number.absorb").innerText()).includes("6")) throw new Error("Absorbed block lost");
  if (!(await page.locator(".fx-hurt-vignette").count())) throw new Error("No damage vignette");
  await page.waitForFunction(()=>document.querySelector('.battlefield')?.getAnimations().some(a=>a.playState==='running'));
  if(await page.locator('.end-turn-wrap').evaluate(e=>e.getAnimations().length)) throw new Error('Incoming camera shake moved turn controls');
  await page.screenshot({path:"output/incoming-damage.png"});
  // A fully blocked strike must show actual absorbed damage, not the discarded leftover shield.
  await page.evaluate(async () => {
    const {createRun,availableNodes,enterNode,answerLab} = await import('/src/engine.ts');
    const {caseForBattle,transferFor} = await import('/src/learning-cases.ts');
    let r=createRun('scholar',42); r=enterNode(r,availableNodes(r)[0].id);
    const c=caseForBattle(r); r=answerLab(answerLab(r,c.correct),transferFor(c).correct);
    r.player.block=20;
    localStorage.setItem('agent-spire.run.v1',JSON.stringify(r));
  });
  await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  await page.locator('[data-action="end-turn"]').click();
  await page.locator('.player-guard').waitFor();
  if (!(await page.locator('.fx-number.absorb').innerText()).includes('9')) throw new Error('Wrong shield absorption');
  await page.screenshot({path:'output/full-guard.png'});
  // Beginner chapters remain readable and rewards survive reload until claimed.
  for (const topic of [2,3,4]) {
    await page.evaluate(async chapter => {
      const {createRun,availableNodes,enterNode}=await import('/src/engine.ts');
      const {TRIALS}=await import('/src/trials.ts');
      let r=createRun('scholar',42), n=availableNodes(r)[0]; n.kind='quiz'; r=enterNode(r,n.id);
      const t=TRIALS.find(t=>t.questions[0].chapter===chapter);
      r.act=chapter; r.map.forEach(n=>n.lessonId=t.questions[0].lessonId);
      r.quiz={lessonId:t.questions[0].lessonId,selected:null,correct:null,boss:false,trial:{id:t.id,revision:3,step:0,answers:[],reward:null}};
      r.player.hp=40; localStorage.setItem('agent-spire.run.v1',JSON.stringify(r));
    },topic);
    await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
    if (await page.locator('.trial-code').count()||!await page.locator('.learning-intro').count()) throw new Error('Beginner quiz must have a guide without code');
    await page.screenshot({path:`output/trial-${topic}.png`,fullPage:true});
    for (let i=0;i<3;i++) {
      const answer = await page.evaluate(async()=>{
        const {trialQuestion}=await import('/src/trials.ts');
        return trialQuestion(JSON.parse(localStorage.getItem('agent-spire.run.v1')).quiz).correct;
      });
      await page.locator('[data-action="answer"]').nth(answer).click();
      if (i<2) await page.locator('[data-action="finish-quiz"]').click();
    }
    await page.locator('.trial-celebration.perfect').waitFor();
    await page.waitForFunction(() => document.querySelector('.trial-celebration-banner')?.getAnimations()[0]?.currentTime > 300);
    if (!(await page.locator('.trial-loot').innerText()).includes('140')) throw new Error('High reward missing');
    await page.screenshot({path:`output/trial-${topic}-perfect.png`,fullPage:true});
    await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
    if (await page.locator('.trial-celebration').count()) throw new Error('Reload replayed one-time celebration');
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('agent-spire.run.v1')));
    if (before.player.gold!==99) throw new Error('Pending loot awarded before claim');
    await page.getByRole('button',{name:'领取奖励',exact:true}).click();
    const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('agent-spire.run.v1')));
    if (after.player.gold!==239||after.player.hp!==52||after.player.relics.length!==2) throw new Error('Wrong claimed loot');
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{
    const {createRun,availableNodes,enterNode}=await import('/src/engine.ts');
    let r=createRun('scholar',7),n=availableNodes(r)[0];n.kind='quiz';r=enterNode(r,n.id);
    localStorage.setItem('agent-spire.run.v1',JSON.stringify(r));
  });
  await page.reload(); await page.getByRole('button',{name:'继续学习',exact:true}).click();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Mobile trial overflows');
  await page.screenshot({path:'output/trial-mobile.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  for(let i=0;i<3;i++){
    const answer=await page.evaluate(async()=>{const {trialQuestion}=await import('/src/trials.ts');return trialQuestion(JSON.parse(localStorage.getItem('agent-spire.run.v1')).quiz).correct;});
    await page.locator('[data-action="answer"]').nth(answer).click();
    if(i<2)await page.locator('[data-action="finish-quiz"]').click();
  }
  if(await page.locator('.trial-celebration i').count()) throw new Error('Reduced motion still emits particles');
  if(!(await page.locator('.trial-celebration.reduced').count()))throw new Error('Reduced motion lost reward notice');
  await page.emulateMedia({reducedMotion:'no-preference'});
  if(errors.length)throw new Error(errors.join('\n'));
  return 'PASS: mandatory gate + keyboard, real incoming damage + shield, stronger shake, 3 beginner chapters, perfect reward effects, pending loot reload/claim, mobile + reduced motion.';
}
