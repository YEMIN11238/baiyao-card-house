import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import * as E from './engine.js';

const card = (rank, suit = 0) => ({ id: `c-${suit}-${rank}`, rank, suit });
const cards = values => values.map(([rank, suit]) => card(rank, suit));
const fresh = seed => E.startHand(E.newGame(seed));
const arrange = state => E.autoArrange(state);
const shopState = seed => E.enterShop(E.resolveHand(arrange(fresh(seed))));
const copy = value => structuredClone(value);
const layout = groups => ({ ...E.newGame('layout'), phase: 'arrange', hand: groups.flat(), rows: groups.map(group => group.map(c => c.id)) });
function assertConservation(state) {
  const all = [...state.hand, ...state.enemy, ...state.stock, ...state.discarded];
  assert.equal(all.length, 52); assert.equal(new Set(all.map(c => c.id)).size, 52);
  assert.equal(state.hand.length, 13); assert.equal(state.enemy.length, 13);
}
function checkArrangement(state, rows) {
  assert.deepEqual(rows.map(row => row.length), [3,5,5]);
  assert.equal(new Set(rows.flat()).size, 13);
  assert.deepEqual([...rows.flat()].sort(),state.hand.map(c=>c.id).sort());
  assert.equal(E.validateRows({...state,rows}).ok,true);
}

// These fixtures encode poker ranking, not a copy of the engine's evaluation algorithm.
test('十三张独立规则：52张无王，13张，前3中5后5，与比鸡版本不同', () => {
  assert.equal(E.CONFIG.version,2);
  assert.deepEqual(E.ROW_SIZES,[3,5,5]);
  assert.deepEqual(E.ROW_NAMES,['前墩','中墩','后墩']);
  const deck=E.makeDeck(); assert.equal(deck.length,52); assert.equal(new Set(deck.map(c=>c.id)).size,52); assert.ok(deck.every(c=>!c.joker));
  const initial=E.newGame('identity'); assert.equal(initial.ruleset,'thirteen');
  const dealt=E.startHand(initial); assertConservation(dealt); assert.equal(dealt.stock.length,26); assert.equal(dealt.soul,100);
});

test('五张牌完整牌型：同花顺、四条、葫芦、同花、顺子、三条、两对、对子、散牌', () => {
  const hands=[
    cards([[10,3],[11,3],[12,3],[13,3],[14,3]]),
    cards([[8,0],[8,1],[8,2],[8,3],[2,0]]),
    cards([[5,0],[5,1],[5,2],[2,0],[2,1]]),
    cards([[2,2],[5,2],[7,2],[10,2],[14,2]]),
    cards([[4,0],[5,1],[6,2],[7,3],[8,0]]),
    cards([[6,0],[6,1],[6,2],[9,0],[14,3]]),
    cards([[4,0],[4,1],[10,0],[10,1],[14,2]]),
    cards([[4,0],[4,1],[8,2],[11,3],[14,0]]),
    cards([[2,0],[5,1],[8,2],[11,3],[14,0]]),
  ];
  assert.deepEqual(hands.map(h=>E.rankHand(h).tier),[8,7,6,5,4,3,2,1,0]);
  for(let i=0;i<hands.length-1;i++)assert.equal(E.compareHands(hands[i],hands[i+1]),1);
});

test('前墩仅散牌、对子、三条；三张顺子和同花均按散牌', () => {
  assert.equal(E.rankHand(cards([[12,3],[13,3],[14,3]])).tier,0);
  assert.equal(E.rankHand(cards([[2,0],[3,1],[4,2]])).tier,0);
  assert.equal(E.rankHand(cards([[2,2],[7,2],[14,2]])).tier,0);
  assert.equal(E.rankHand(cards([[2,0],[2,1],[14,2]])).tier,1);
  assert.equal(E.rankHand(cards([[2,0],[2,1],[2,2]])).tier,3);
  assert.equal(E.rankHand(cards([[2,0],[3,1],[4,2],[5,3]])).tier,-1);
});

test('A2345为最小五张顺子，TJQKA最大，QKA23不能绕圈', () => {
  const wheel=cards([[14,0],[2,1],[3,2],[4,3],[5,0]]);
  const six=cards([[2,0],[3,1],[4,2],[5,3],[6,0]]);
  const broadway=cards([[10,0],[11,1],[12,2],[13,3],[14,0]]);
  const king=cards([[9,0],[10,1],[11,2],[12,3],[13,0]]);
  assert.equal(E.rankHand(wheel).tier,4); assert.equal(E.compareHands(wheel,six),-1);
  assert.equal(E.compareHands(broadway,king),1);
  assert.equal(E.rankHand(cards([[12,0],[13,1],[14,2],[2,3],[3,0]])).tier,0);
});

test('同点数牌不以花色定输赢；五张同型逐级比较关键点数与踢脚牌', () => {
  assert.equal(E.compareHands(cards([[14,3],[12,2],[9,1]]),cards([[14,0],[12,1],[9,2]])),0);
  assert.equal(E.compareHands(cards([[2,3],[5,3],[8,3],[11,3],[14,3]]),cards([[2,2],[5,2],[8,2],[11,2],[14,2]])),0);
  assert.equal(E.compareHands(cards([[7,0],[7,1],[14,0],[10,1],[9,2]]),cards([[7,2],[7,3],[14,1],[10,2],[8,3]])),1);
  assert.equal(E.compareHands(cards([[12,0],[12,1],[2,0],[2,1],[3,0]]),cards([[11,0],[11,1],[10,0],[10,1],[14,0]])),1);
  assert.equal(E.compareHands(cards([[12,0],[12,1],[4,0],[4,1],[3,0]]),cards([[12,2],[12,3],[3,1],[3,2],[14,0]])),1);
  assert.equal(E.compareHands(cards([[5,0],[5,1],[5,2],[14,0],[14,1]]),cards([[6,0],[6,1],[6,2],[2,0],[2,1]])),-1);
  assert.equal(E.compareHands(cards([[8,0],[8,1],[8,2],[8,3],[14,0]]),cards([[8,0],[8,1],[8,2],[8,3],[13,0]])),1);
});

test('前3对中5只比较共有关键点数：相同前三踢脚牌不因5张多两张而倒墩', () => {
  const front=cards([[14,0],[13,1],[12,2]]),middle=cards([[14,1],[13,2],[12,3],[11,0],[9,1]]);
  assert.equal(E.compareHands(front,middle),0); assert.equal(E.compareHands(middle,front),0);
  assert.equal(E.compareHands(cards([[8,0],[8,1],[14,0]]),cards([[8,2],[8,3],[14,1],[9,2],[2,0]])),0);
  assert.equal(E.compareHands(cards([[8,0],[8,1],[14,0]]),cards([[8,2],[8,3],[13,1],[9,2],[2,0]])),1);
  assert.equal(E.compareHands(cards([[6,0],[6,1],[6,2]]),cards([[6,0],[6,1],[6,2],[14,0],[2,0]])),0);
});

test('倒墩检查依据牌型而非张数：前AAA大于中两对；前AAA小于中顺子', () => {
  const front=cards([[14,0],[14,1],[14,2]]);
  const twoPair=cards([[13,0],[13,1],[12,0],[12,1],[2,3]]);
  const back=cards([[3,3],[4,3],[5,3],[6,3],[7,3]]);
  assert.equal(E.validateRows(layout([front,twoPair,back])).ok,false);
  const straight=cards([[8,0],[9,1],[10,2],[11,0],[12,2]]);
  assert.equal(E.validateRows(layout([front,straight,back])).ok,true);
  const wrong=layout([front,straight,back]); wrong.rows[0].push(wrong.rows[1].pop());
  assert.equal(E.validateRows(wrong).ok,false);
});

test('种子发牌可复现且没有副作用；对手牌固定且已形成合法3/5/5', () => {
  const initial=E.newGame('seeded'),before=copy(initial),state=E.startHand(initial);
  assert.deepEqual(initial,before); assert.deepEqual(state,E.startHand(E.newGame('seeded'))); assertConservation(state);
  checkArrangement({...state,hand:state.enemy},state.enemyRows);
  assert.throws(()=>E.startHand(state));
});

test('三种摆牌参考均合法、不重用实体，并在合理时间内生成', t => {
  const state=fresh('suggestion-rich');const before=copy(state.hand);const start=performance.now();
  const suggestions=E.getSuggestions(state.hand);const duration=performance.now()-start;
  assert.equal(suggestions.length,3);
  assert.deepEqual(suggestions.map(s=>s.style).sort(),['back','balanced','front']);
  assert.equal(new Set(suggestions.map(s=>JSON.stringify(s.rows))).size,suggestions.length);
  for(const suggestion of suggestions)checkArrangement(state,suggestion.rows);
  assert.deepEqual(state.hand,before);assert.ok(duration<2000,`solver took ${duration.toFixed(1)}ms`);
  t.diagnostic(`三种参考耗时 ${duration.toFixed(1)}ms（本机样本，不代表所有设备）。`);
});

test('自动理牌合法、花1魂值；不查看对手手牌，不修改输入', () => {
  const state=fresh('solver-independent'),before=copy(state),enemyChanged=copy(state);
  enemyChanged.enemy.reverse(); enemyChanged.enemyRows.reverse();
  for(const style of ['balanced','front','back']){
    const next=E.autoArrange(state,style);checkArrangement(next,next.rows);assert.equal(next.soul,99);
    assert.deepEqual(next.rows,E.autoArrange(enemyChanged,style).rows);
  }
  assert.deepEqual(state,before);
});

test('十三张所有墩内牌位互换精确；前墩与后墩可交换，不挤丢牌', () => {
  const initial=arrange(fresh('slots'));
  for(let row=0;row<3;row++)for(let from=0;from<E.ROW_SIZES[row];from++)for(let to=0;to<E.ROW_SIZES[row];to++){
    const expected=copy(initial.rows);[expected[row][from],expected[row][to]]=[expected[row][to],expected[row][from]];
    const changed=E.placeCard(initial,initial.rows[row][from],row,to);assert.deepEqual(changed.rows,expected);assertConservation(changed);
  }
  const a=initial.rows[0][0],b=initial.rows[2][4];const swapped=E.placeCard(initial,a,2,4);
  assert.equal(swapped.rows[2][4],a);assert.equal(swapped.rows[0][0],b);assertConservation(swapped);
  assert.throws(()=>E.placeCard(initial,initial.rows[2][0],0,3));
});

test('五张手动组墩和收回重排保留实体；第四张不能直接塞进前墩', () => {
  let state=fresh('manual');
  for(const c of state.hand.slice(0,3))state=E.placeCard(state,c.id,0);
  assert.throws(()=>E.placeCard(state,state.hand[3].id,0));
  for(const c of state.hand.slice(3,8))state=E.placeCard(state,c.id,1);
  assert.equal(state.rows[1].length,5);
  state=E.returnToHand(state,state.hand[4].id);assert.equal(state.rows[1].length,4);assertConservation(state);
  state=E.clearRows(state);assert.deepEqual(state.rows,[[],[],[]]);assertConservation(state);
  assert.deepEqual(E.hydrate(E.serialize(state)),state);
});

test('两次归潮令各换13张，用尽26张余牌后失败且不消耗第三张符令', () => {
  let state=fresh('redraw-13');const enemy=copy(state.enemyRows);state.inventory=['tide','tide','tide'];
  for(let n=0;n<2;n++){state=E.useItem(state,'tide');assertConservation(state);assert.equal(state.rows.flat().length,0);assert.deepEqual(state.enemyRows,enemy);}
  assert.equal(state.stock.length,0);assert.equal(state.inventory.length,1);const before=E.serialize(state);
  assert.throws(()=>E.useItem(state,'tide'));assert.equal(E.serialize(state),before);
});

test('换牌保留原牌位及对手布局；洗牌保持52实体守恒', () => {
  let state=arrange(fresh('exchange'));const enemy=copy(state.enemyRows),beforeId=state.rows[1][4];
  state=E.replaceCard(state,beforeId);assert.notEqual(state.rows[1][4],beforeId);assert.equal(state.rows[1].length,5);assert.deepEqual(state.enemyRows,enemy);assertConservation(state);
  state=E.reshuffleHand(state);assertConservation(state);assert.deepEqual(state.rows,[[],[],[]]);
});

test('照影镜每次公开至多3张，最后一次只公开剩余1张，不重复给信息', () => {
  let state=fresh('mirror');state.inventory=Array(6).fill('mirror');
  for(const expected of [3,6,9,12,13]){state=E.useItem(state,'mirror');assert.equal(state.revealedEnemy.length,expected);}
  assert.equal(new Set(state.revealedEnemy).size,13);assert.equal(state.inventory.length,1);
  const before=E.serialize(state);assert.throws(()=>E.useItem(state,'mirror'));assert.equal(E.serialize(state),before);
});

test('变牌禁止和自己手牌重面，失败不耗符；敌方相同牌面不妨碍施法', () => {
  let state=fresh('face-collision');state.inventory=['wild','wild'];
  const [from,other]=state.hand,enemy=state.enemy[0],original=copy(state.deck.find(c=>c.id===from.id));const before=E.serialize(state);
  assert.throws(()=>E.useItem(state,'wild',{cardId:from.id,rank:other.rank,suit:other.suit}));assert.equal(E.serialize(state),before);
  state=E.useItem(state,'wild',{cardId:from.id,rank:enemy.rank,suit:enemy.suit});
  const changed=state.hand.find(c=>c.id===from.id);assert.equal(changed.rank,enemy.rank);assert.equal(changed.suit,enemy.suit);assert.equal(changed.id,from.id);
  assert.deepEqual(state.deck.find(c=>c.id===from.id),original);assert.equal(state.inventory.length,1);assertConservation(state);
});

test('改花色、改点数仅本局生效；参数错误不消费；数量仍为13', () => {
  let state=fresh('spell-faces');state.inventory=['rank','flush'];
  const source=state.hand.find(c=>[c.rank-1,c.rank+1].some(rank=>rank>=2&&rank<=14&&!state.hand.some(x=>x.rank===rank&&x.suit===c.suit)));
  const nextRank=[source.rank-1,source.rank+1].find(rank=>rank>=2&&rank<=14&&!state.hand.some(x=>x.rank===rank&&x.suit===source.suit));
  const original=copy(state.deck.find(c=>c.id===source.id));
  assert.throws(()=>E.useItem(state,'rank',{cardId:source.id,rank:99}));assert.equal(state.inventory.length,2);
  state=E.useItem(state,'rank',{cardId:source.id,rank:nextRank});assert.deepEqual(state.deck.find(c=>c.id===source.id),original);
  const selected=state.hand.find(c=>[0,1,2,3].some(suit=>suit!==c.suit&&!state.hand.some(x=>x.rank===c.rank&&x.suit===suit)));
  const suit=[0,1,2,3].find(suit=>suit!==selected.suit&&!state.hand.some(x=>x.rank===selected.rank&&x.suit===suit));
  state=E.useItem(state,'flush',{cardId:selected.id,suit});assert.equal(state.hand.find(c=>c.id===selected.id).suit,suit);assertConservation(state);
});

test('消费至少保留1魂值，非法阶段与失败操作不能修改状态', () => {
  const state=fresh('last-soul');state.soul=1;const before=E.serialize(state);
  assert.throws(()=>E.autoArrange(state));assert.throws(()=>E.replaceCard(state,state.hand[0].id));assert.equal(E.serialize(state),before);
  assert.throws(()=>E.buyItem(state,0));assert.throws(()=>E.continueRun(state));
});

test('商店六格、售罄防重、符令容量、奇珍不重复；局数按每三局换章', () => {
  let state=shopState('merchant-13');assert.equal(state.phase,'shop');assert.equal(state.shop.length,6);
  const index=state.shop.findIndex(offer=>offer.itemId==='mirror');assert.ok(index>=0);const soul=state.soul;
  state=E.buyItem(state,index);assert.equal(state.soul,soul-2);assert.throws(()=>E.buyItem(state,index));
  const full=copy(state);full.inventory=Array(10).fill('mirror');const spellIndex=full.shop.findIndex(o=>!o.sold&&E.ITEM_MAP[o.itemId].kind==='spell');assert.throws(()=>E.buyItem(full,spellIndex));
  const refreshed=E.refreshShop(state);assert.equal(refreshed.soul,state.soul-6);assert.equal(refreshed.shop.length,6);
  state=E.continueRun(state);assert.equal(state.round,2);assert.equal(state.completed,1);assertConservation(state);
});

test('附灵刻印、祭拜和后续摸到改造实体牌均保留正确状态', () => {
  let state=shopState('altar-persistent');const target=state.deck[0].id;
  state=E.altar(state,'spirit',target);state=E.altar(state,'stamp',target);assert.throws(()=>E.altar(state,'spirit',target));
  assert.equal(state.deck.find(c=>c.id===target).spirit,'saint');assert.equal(state.deck.find(c=>c.id===target).stamp,'gold');
  const sacrificed=E.altar(state,'sacrifice',target);assert.equal(sacrificed.inventory.length,state.inventory.length+1);assert.ok(!sacrificed.deck.find(c=>c.id===target).spirit);assert.ok(!sacrificed.deck.find(c=>c.id===target).stamp);assert.throws(()=>E.altar(sacrificed,'sacrifice',target));
  state=E.hydrate(E.serialize(state));let seen=false;
  for(let n=0;n<12;n++){
    state=E.continueRun(state);const held=state.hand.find(c=>c.id===target),rival=state.enemy.find(c=>c.id===target);
    if(rival){assert.ok(!rival.spirit);assert.ok(!rival.stamp);}
    if(held){assert.equal(held.spirit,'saint');assert.equal(held.stamp,'gold');seen=true;break;}
    state=E.enterShop(E.resolveHand(arrange(state)));assert.equal(state.phase,'shop');
  }
  assert.ok(seen,'测试种子应在12局内摸到目标实体牌');
});

test('魂值结算包含前中后3/5/5：附灵刻印同样放大失分，合计仅结算一次', () => {
  const state=arrange(fresh('score-13'));const modified=copy(state);
  const target=modified.hand.find(c=>c.id===modified.rows[1][0]);target.spirit='saint';target.stamp='gold';
  const plain=E.resolveHand(state),enhanced=E.resolveHand(modified);
  assert.equal(enhanced.lastResult.lanes[1].multiplier,3);
  assert.equal(enhanced.lastResult.lanes[1].delta,plain.lastResult.lanes[1].delta*3);
  assert.deepEqual(enhanced.lastResult.lanes.map(l=>l.player.length),[3,5,5]);
  assert.deepEqual(enhanced.lastResult.lanes.map(l=>l.enemy.length),[3,5,5]);
  assert.equal(enhanced.soul,modified.soul+enhanced.lastResult.total);assert.throws(()=>E.resolveHand(enhanced));
});

test('断尾契只翻倍后墩，护身纸只减免一次失墩', () => {
  let state=arrange(fresh('effects-13'));state.inventory=['tail','shield'];
  const plain=E.resolveHand(state),withTail=E.resolveHand(E.useItem(state,'tail'));
  assert.equal(withTail.lastResult.lanes[2].base,plain.lastResult.lanes[2].base*2);
  assert.equal(withTail.lastResult.lanes[0].base,plain.lastResult.lanes[0].base);
  const shielded=E.resolveHand(E.useItem(state,'shield'));
  let consumed=false;
  for(let i=0;i<3;i++){
    const expected=plain.lastResult.lanes[i].delta;
    if(expected<0&&!consumed){assert.equal(shielded.lastResult.lanes[i].delta,Math.min(0,expected+3));consumed=true;}else assert.equal(shielded.lastResult.lanes[i].delta,expected);
  }
});

test('七黑六红按初始十三张判定；读档、换牌不重复奖励', () => {
  let match;
  for(let seed=1;seed<=50;seed++){
    const initial=E.newGame(seed);initial.relics=['blackred'];const state=E.startHand(initial);
    const blacks=state.hand.filter(c=>c.suit===1||c.suit===3).length;
    assert.equal(state.soul,blacks===7?110:100);
    if(blacks===7){match=state;break;}
  }
  assert.ok(match);assert.equal(match.stats.earned,10);assert.equal(E.hydrate(E.serialize(match)).soul,110);
  const exchanged=E.replaceCard(match,match.hand[0].id);assert.equal(exchanged.stats.earned,10);assert.equal(exchanged.soul,107);
});

test('存档恢复相同牌、随机数、祭坛与下一局；旧比鸡存档明确拒绝', () => {
  let state=shopState('save-13');state=E.buyItem(state,0);state=E.altar(state,'spirit',state.deck[0].id);
  const loaded=E.hydrate(E.serialize(state));assert.deepEqual(loaded,state);assert.deepEqual(E.continueRun(loaded),E.continueRun(state));
  const old=copy(state);old.version=1;delete old.ruleset;assert.throws(()=>E.hydrate(JSON.stringify(old)),/存档/);
  assert.throws(()=>E.hydrate('{}'),/存档/);
});

test('初始100魂完成12章36局；各阶段保存恢复后正常推进到通关', () => {
  let state=fresh('full-run');assert.equal(state.soul,100);let reached=0;
  while(['arrange','shop'].includes(state.phase)){
    if(state.phase==='shop')state=E.continueRun(state);
    state=E.hydrate(E.serialize(arrange(state)));state=E.resolveHand(state);reached++;assert.equal(state.completed,reached);assert.ok(reached<=36);
    state=E.hydrate(E.serialize(state));state=E.enterShop(state);state=E.hydrate(E.serialize(state));
    if(state.phase==='shop'){assert.equal(state.chapter,Math.floor((reached-1)/3)+1);assert.equal(state.round,(reached-1)%3+1);}
  }
  assert.equal(state.phase,'victory');assert.equal(reached,36);assert.ok(state.soul>0);
});

test('真实负分结算的失败边界，完整3/5/5合法且26实体不重复', () => {
  let state=fresh('loss-boundary');
  const player=[cards([[2,0],[4,1],[6,2]]),cards([[3,0],[5,1],[7,2],[8,3],[10,0]]),cards([[4,0],[6,1],[8,2],[9,3],[11,0]])];
  const enemy=[cards([[12,1],[12,0],[2,2]]),cards([[3,1],[3,2],[5,0],[5,2],[13,3]]),cards([[7,0],[7,1],[7,3],[14,3],[14,2]])];
  state.hand=player.flat();state.enemy=enemy.flat();state.rows=player.map(g=>g.map(c=>c.id));state.enemyRows=enemy.map(g=>g.map(c=>c.id));
  const used=new Set([...state.hand,...state.enemy].map(c=>c.id));state.stock=state.deck.filter(c=>!used.has(c.id));state.discarded=[];state.soul=3;
  assertConservation(state);assert.equal(E.validateRows(state).ok,true);
  state=E.resolveHand(state);assert.equal(state.lastResult.total,-9);assert.equal(state.soul,-6);assert.equal(E.enterShop(state).phase,'defeat');
  assert.equal(E.hydrate(E.serialize(E.enterShop(state))).phase,'defeat');
});

test('损坏存档在UI渲染前拒绝：规则身份、3/5/5、26张守恒、货品和结算', () => {
  const arranging=arrange(fresh('corrupted-13')),settlement=E.resolveHand(arranging),shop=E.enterShop(settlement);
  const cases=[
    [arranging,s=>s.ruleset='biji'],[arranging,s=>s.hand.pop()],[arranging,s=>s.rows=null],
    [arranging,s=>s.rows[0].push(s.rows[1].pop())],[arranging,s=>s.rows[1][0]=s.rows[2][0]],
    [arranging,s=>s.rows[2][0]='missing'],[arranging,s=>s.enemyRows[1].pop()],
    [arranging,s=>s.hand[0].rank=99],[arranging,s=>s.hand[0].id='joker-big'],
    [arranging,s=>s.stock.push(s.hand[0])],[arranging,s=>s.deck.pop()],[arranging,s=>s.rng=0],
    [arranging,s=>s.chapter=999],[arranging,s=>s.effects=[]],[arranging,s=>s.stats={}],
    [shop,s=>s.shop[0]=null],[shop,s=>s.shop[0].itemId='constructor'],[shop,s=>s.inventory=['bad']],
    [shop,s=>s.inventory=Array(11).fill('mirror')],[shop,s=>s.relics=['twin','twin']],
    [settlement,s=>s.lastResult=null],[settlement,s=>s.lastResult.lanes[1].player.pop()],
    [settlement,s=>s.lastResult.total+=100],[settlement,s=>s.lastResult.lanes[0].enemyType='<b>wrong</b>'],
    [settlement,s=>s.completed=36],[settlement,s=>s.phase='reveal'],
  ];
  for(const [valid,mutate] of cases){const bad=copy(valid);mutate(bad);assert.throws(()=>E.hydrate(JSON.stringify(bad)),/存档/);}
  assert.deepEqual(E.hydrate(E.serialize(E.newGame('initial'))),E.newGame('initial'));
});
