import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './engine.js';
const c = (rank, suit = 0, id = `${rank}-${suit}`) => ({ rank, suit, id });
const resolveJokers = state => state.hand.filter(card => card.joker && !card.transformed).reduce((s, card) => E.transformJoker(s, card.id, 14, 3), state);
const arrange = state => E.autoArrange(resolveJokers(state));
const shopState = seed => E.enterShop(E.resolveHand(arrange(E.startHand(E.newGame(seed)))));
function assertConservation(state) {
  const ids = [...state.hand, ...state.enemy, ...state.stock, ...state.discarded].map(card => card.id);
  assert.equal(ids.length, 54); assert.equal(new Set(ids).size, 54);
}
test('三条 > 同花顺 > 同花 > 顺子 > 对子 > 散牌', () => {
  const hands = [[c(8,0),c(8,1),c(8,2)], [c(2,1),c(3,1),c(4,1)], [c(2,2),c(5,2),c(7,2)], [c(5,0),c(6,1),c(7,2)], [c(4,0),c(4,1),c(8,2)], [c(5,0),c(7,1),c(13,2)]];
  assert.deepEqual(hands.map(h => E.rankHand(h).tier), [5,4,3,2,1,0]);
  for (let i=0;i<hands.length-1;i++) assert.equal(E.compareHands(hands[i],hands[i+1]),1);
});
test('A23最低，234高于A23，QKA最高，KA2不是顺子', () => {
  assert.equal(E.compareHands([c(2),c(3,1),c(4,2)],[c(14),c(2,1),c(3,2)]),1);
  assert.equal(E.compareHands([c(12),c(13,1),c(14,2)],[c(11),c(12,1),c(13,2)]),1);
  assert.equal(E.rankHand([c(13),c(14,1),c(2,2)]).name,'散牌');
});
test('对子先比对子大小，同点数花色破平；完全相同才平局', () => {
  assert.equal(E.compareHands([c(5),c(5,1),c(2,2)],[c(4),c(4,1),c(14,2)]),1);
  assert.equal(E.compareHands([c(8,3),c(5,0),c(2,0)],[c(8,2),c(5,0),c(2,0)]),1);
  assert.equal(E.compareHands([c(8,3),c(5,0),c(2,0)],[c(8,3),c(5,0),c(2,0)]),0);
});
test('发牌唯一、同seed可复现、操作不修改旧状态', () => {
  const initial = E.newGame('audit'); const before = structuredClone(initial);
  const state = E.startHand(initial);
  assert.deepEqual(initial,before); assert.deepEqual(state,E.startHand(E.newGame('audit')));
  assertConservation(state); assert.equal(state.hand.length,9); assert.equal(state.enemy.length,9);
  assert.throws(()=>E.startHand(state),/当前阶段/);
});
test('280种合法分组，自动理牌合法且不偷看敌方', () => {
  const initial = resolveJokers(E.startHand(E.newGame(123)));
  const arrangements = E.findArrangements(initial.hand); assert.equal(arrangements.length,280);
  const arranged = E.autoArrange(initial); assert.equal(E.validateRows(arranged).ok,true); assert.equal(arranged.soul,99);
  const changedEnemy = structuredClone(initial); changedEnemy.enemy.reverse();
  assert.deepEqual(E.autoArrange(changedEnemy).rows,arranged.rows);
  const inverted = structuredClone(arranged); inverted.rows.reverse(); assert.equal(E.validateRows(inverted).ok,false);
});
test('手动摆牌、换位、收回不丢牌且允许交换满墩', () => {
  let state = arrange(E.startHand(E.newGame(321)));
  const a=state.rows[0][0],b=state.rows[2][2];
  state=E.placeCard(state,a,2,2); assert.equal(state.rows[2][2],a); assert.equal(state.rows[0][0],b);
  state=E.returnToHand(state,a); assert.equal(state.rows.flat().length,8);
  state=E.placeCard(state,a,2); assert.equal(state.rows.flat().length,9); assert.equal(new Set(state.rows.flat()).size,9);
  assertConservation(state);
});
test('王必须选面，不能重复变更，允许与实体牌同面但id唯一', () => {
  let state; for(let i=1;i<100;i++){state=E.startHand(E.newGame(i));if(state.hand.some(card=>card.joker))break;}
  const joker=state.hand.find(card=>card.joker); assert.ok(joker);
  assert.throws(()=>E.autoArrange(state),/大小王/);
  state=E.transformJoker(state,joker.id,14,3);
  assert.throws(()=>E.transformJoker(state,joker.id,13,2),/已选定/); assertConservation(state);
});
test('换牌洗牌保持54实体守恒，不改敌方布局或重复发牌奖励', () => {
  let state=arrange(E.startHand(E.newGame(744))); const enemy=structuredClone(state.enemyRows);
  state=E.replaceCard(state,state.hand[0].id); assertConservation(state); assert.deepEqual(state.enemyRows,enemy);
  const before=state.soul; state=E.reshuffleHand(state); assert.equal(state.soul,before-12); assert.equal(state.rows.flat().length,0); assertConservation(state);
});
test('消费不得耗尽魂值；失败操作原状态不变', () => {
  const state=resolveJokers(E.startHand(E.newGame(55)));state.soul=1;
  const old=structuredClone(state);assert.throws(()=>E.autoArrange(state),/至少保留1/);assert.deepEqual(state,old);
});
test('商店、容量与售罄防重；每局结算一次', () => {
  let state=shopState('merchant'); assert.equal(state.phase,'shop'); assert.equal(state.shop.length,6);
  const index=state.shop.findIndex(offer=>offer.itemId==='mirror'); assert.ok(index>=0);
  const before=state.soul;state=E.buyItem(state,index);assert.equal(state.soul,before-2);assert.ok(state.inventory.includes('mirror'));
  assert.throws(()=>E.buyItem(state,index),/售出/);
  assert.throws(()=>E.resolveHand(state),/阶段/);
  state=E.continueRun(state);assert.equal(state.round,2);assert.equal(state.completed,1);
  assert.throws(()=>E.continueRun(state),/阶段/);
});
test('照影镜每次新增3张且不重复，消耗符令，不能重复使用', () => {
  let state=E.startHand(E.newGame(123));state.inventory=['mirror','mirror','mirror','mirror'];
  for(let i=0;i<3;i++){state=E.useItem(state,'mirror');assert.equal(state.revealedEnemy.length,(i+1)*3);}
  assert.equal(new Set(state.revealedEnemy).size,9);assert.throws(()=>E.useItem(state,'mirror'),/所有手牌/);assert.equal(state.inventory.length,1);
  const next=E.startHand(E.newGame(345));assert.throws(()=>E.useItem(next,'mirror'),/没有/);
});
test('符令验证目标在扣除前，变牌只影响本局', () => {
  let state=E.startHand(E.newGame(777));state.inventory=['rank','flush','wild'];
  const card=state.hand.find(c=>!c.joker);const original=structuredClone(state.deck.find(c=>c.id===card.id));
  assert.throws(()=>E.useItem(state,'rank',{cardId:card.id,rank:99}),/请选择/);assert.equal(state.inventory.length,3);
  const newRank=card.rank===14?13:card.rank+1;state=E.useItem(state,'rank',{cardId:card.id,rank:newRank});
  assert.equal(state.hand.find(c=>c.id===card.id).rank,newRank);assert.deepEqual(state.deck.find(c=>c.id===card.id),original);
});
test('祭坛改造持久化、不可无限叠加，祭拜移除并发放符令', () => {
  let state=shopState(421);const id=state.deck.find(c=>!c.joker).id;
  state=E.altar(state,'spirit',id);assert.equal(state.deck.find(c=>c.id===id).spirit,'saint');
  assert.throws(()=>E.altar(state,'spirit',id),/已经附灵/);
  state=E.altar(state,'stamp',id);assert.equal(state.deck.find(c=>c.id===id).stamp,'gold');
  const count=state.inventory.length;state=E.altar(state,'sacrifice',id);assert.equal(state.inventory.length,count+1);assert.equal(state.deck.find(c=>c.id===id).spirit,undefined);assert.equal(state.deck.find(c=>c.id===id).stamp,undefined);
  assert.throws(()=>E.altar(state,'sacrifice',id),/没有改造/);
});
test('圣灵与金印同时放大输赢，结算汇总正确', () => {
  let state=arrange(E.startHand(E.newGame(2026)));
  const card=state.hand.find(c=>c.id===state.rows[0][0]);card.spirit='saint';card.stamp='gold';
  const resolved=E.resolveHand(state);assert.equal(resolved.lastResult.lanes[0].multiplier,3);
  assert.equal(Math.abs(resolved.lastResult.lanes[0].delta),9);
  assert.equal(resolved.soul,state.soul+resolved.lastResult.total);assert.throws(()=>E.resolveHand(resolved),/阶段/);
});
test('存档恢复完整布局和随机数，读档不重复触发收入', () => {
  let state=shopState('save');state=E.buyItem(state,0);state=E.altar(state,'spirit','c-0-2');
  const loaded=E.hydrate(E.serialize(state));assert.deepEqual(loaded,state);assert.deepEqual(E.continueRun(loaded),E.continueRun(state));
  assert.throws(()=>E.hydrate('{}'),/存档/);
});
test('完整36局自然推进，最后进入通关；魂值耗尽则失败优先', () => {
  let state=E.startHand(E.newGame('full-run'));assert.equal(state.soul,100);
  for(let n=1;n<=36;n++){
    state=E.hydrate(E.serialize(arrange(state)));state=E.resolveHand(state);assert.equal(state.completed,n);state=E.hydrate(E.serialize(state));state=E.enterShop(state);state=E.hydrate(E.serialize(state));
    if(n<36){assert.equal(state.phase,'shop');state=E.continueRun(state);assert.equal(state.chapter,Math.floor(n/3)+1);assert.equal(state.round,n%3+1);}else assert.equal(state.phase,'victory');
  }
  const losing=E.resolveHand(arrange(E.startHand(E.newGame('ending'))));losing.soul=0;losing.completed=36;
  assert.equal(E.enterShop(losing).phase,'defeat');
});
test('真实负分结算耗尽魂值，正常进入失败页', () => {
  let state=E.startHand(E.newGame('loss-path'));
  const get=(rank,suit)=>structuredClone(state.deck.find(c=>c.rank===rank&&c.suit===suit));
  const player=[[get(2,0),get(4,1),get(6,2)],[get(3,0),get(5,1),get(8,2)],[get(7,0),get(9,1),get(11,2)]];
  const enemy=[[get(4,0),get(4,2),get(13,1)],[get(6,0),get(6,1),get(13,2)],[get(8,0),get(8,1),get(14,2)]];
  state.hand=player.flat();state.enemy=enemy.flat();state.rows=player.map(row=>row.map(c=>c.id));state.enemyRows=enemy.map(row=>row.map(c=>c.id));state.soul=3;
  assert.equal(E.validateRows(state).ok,true);state=E.resolveHand(state);assert.equal(state.lastResult.total,-9);assert.equal(state.soul,-6);assert.equal(E.enterShop(state).phase,'defeat');
});
test('七黑两红仅初次发牌触发，读档和换牌不重发', () => {
  let match;
  for(let seed=1;seed<=1000;seed++){
    const intro=E.newGame(seed);intro.relics=['blackred'];const trial=E.startHand(intro);
    if(trial.soul===110){match=trial;break;}
  }
  assert.ok(match,'应能找到7黑2红种子');assert.equal(match.stats.earned,10);
  assert.equal(E.hydrate(E.serialize(match)).soul,110);
  const changed=E.replaceCard(match,match.hand[0].id);assert.equal(changed.soul,107);assert.equal(changed.stats.earned,10);
});
test('同墩每一种牌位互换都精确交换，未选牌的位置不变', () => {
  const initial=arrange(E.startHand(E.newGame('same-row')));
  for(let row=0;row<3;row++)for(let from=0;from<3;from++)for(let to=0;to<3;to++){
    const expected=structuredClone(initial.rows);
    [expected[row][from],expected[row][to]]=[expected[row][to],expected[row][from]];
    const result=E.placeCard(initial,initial.rows[row][from],row,to);
    assert.deepEqual(result.rows,expected);assertConservation(result);
  }
});
test('多牌换墩流程与UI一致，移出旧牌、挪入三张、不丢实体牌', () => {
  let state=arrange(E.startHand(E.newGame('multi-select')));
  const chosen=[state.rows[0][0],state.rows[1][1],state.rows[2][2]];
  for(const id of [...state.rows[1],...chosen])state=E.returnToHand(state,id);
  for(const id of chosen)state=E.placeCard(state,id,1);
  assert.deepEqual(state.rows[1],chosen);assert.equal(new Set(state.rows.flat()).size,state.rows.flat().length);assertConservation(state);
  assert.deepEqual(E.hydrate(E.serialize(state)),state);
});
test('全部重抽符令保留实体守恒，余牌不足时不消耗符令', () => {
  let state=E.startHand(E.newGame('redraw'));state.inventory=['tide','tide','tide','tide','tide'];
  for(let i=0;i<4;i++){state=E.useItem(state,'tide');assertConservation(state);assert.equal(state.rows.flat().length,0);}
  assert.equal(state.stock.length,0);assert.equal(state.inventory.length,1);
  const before=E.serialize(state);assert.throws(()=>E.useItem(state,'tide'),/不足9张/);assert.equal(E.serialize(state),before);
});
test('祭坛改造留在牌库，之后摸到该实体牌仍生效；对手不继承我方改造', () => {
  let state=shopState('persistent');state=E.altar(state,'spirit','c-0-2');state=E.altar(state,'stamp','c-0-2');
  state=E.hydrate(E.serialize(state));let seen=false;
  for(let n=0;n<12;n++){
    state=E.continueRun(state);
    const held=state.hand.find(c=>c.id==='c-0-2');if(held){assert.equal(held.spirit,'saint');assert.equal(held.stamp,'gold');seen=true;break;}
    const enemy=state.enemy.find(c=>c.id==='c-0-2');if(enemy){assert.equal(enemy.spirit,undefined);assert.equal(enemy.stamp,undefined);}
    state=E.enterShop(E.resolveHand(arrange(state)));assert.equal(state.phase,'shop');
  }
  assert.ok(seen,'此种子应在12局内将目标牌发到玩家手里');
});
test('损坏存档在进入UI前被拒绝，覆盖牌、牌墩、货品、结算与计数结构', () => {
  const arranging=arrange(E.startHand(E.newGame('corrupted')));
  const settlement=E.resolveHand(arranging),shop=E.enterShop(settlement);
  const cases=[
    [arranging,s=>s.rows=null], [arranging,s=>s.rows[0]=null], [arranging,s=>s.rows[0][0]='missing-id'],
    [arranging,s=>s.rows[0][0]=s.rows[1][0]], [arranging,s=>s.enemyRows[0].pop()],
    [arranging,s=>s.hand[0]=null], [arranging,s=>s.hand[0].rank=99], [arranging,s=>s.hand[0].id='evil-id'],
    [arranging,s=>s.stock.push(s.hand[0])], [arranging,s=>s.deck[0]=null], [arranging,s=>s.deck[0].rank=99],
    [arranging,s=>s.rng=0], [arranging,s=>s.chapter=999], [arranging,s=>s.effects=[]], [arranging,s=>s.stats={wins:0}],
    [shop,s=>s.shop[0]=null], [shop,s=>s.shop[0].itemId='unknown'], [shop,s=>s.shop[0].itemId='constructor'], [shop,s=>s.inventory=['unknown']],
    [shop,s=>s.relics=['twin','twin']], [shop,s=>s.selectedAltar='bad-id'],
    [settlement,s=>s.lastResult=null], [settlement,s=>s.lastResult.lanes[0].player=null],
    [settlement,s=>s.lastResult.total+=99], [settlement,s=>s.lastResult.lanes[0].enemyType='<b>wrong</b>'], [settlement,s=>s.completed=36], [settlement,s=>s.phase='reveal'],
  ];
  for(const [valid,mutate] of cases){const broken=structuredClone(valid);mutate(broken);assert.throws(()=>E.hydrate(JSON.stringify(broken)),/存档/);}
  assert.deepEqual(E.hydrate(E.serialize(E.newGame('initial'))),E.newGame('initial'));
});
