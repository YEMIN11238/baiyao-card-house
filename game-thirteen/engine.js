/**
 * 十三张独立版本：52张牌、前墩3张、中墩5张、后墩5张。
 * 基础比较采用常见十三水规则；魂值、商店和功能牌是本原型的闯关扩展。
 * 所有状态操作返回新对象。此文件不修改或迁移比鸡版的状态。
 */
export const ROW_SIZES = Object.freeze([3, 5, 5]);
export const ROW_NAMES = Object.freeze(['前墩', '中墩', '后墩']);
export const CONFIG = Object.freeze({ version: 2, ruleset: 'thirteen', handSize: 13, deckSize: 52, rowSizes: ROW_SIZES, startingSoul: 100, chapters: 12, roundsPerChapter: 3, baseStake: 3, inventoryCap: 10, relicCap: 12, refreshPrice: 6, spiritPrice: 10, stampPrice: 14, autoPrice: 1, exchangePrice: 3, reshufflePrice: 12 });
export const SUITS = ['♦', '♣', '♥', '♠'];
export const RANK_NAMES = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const ITEMS = [
  { id: 'mirror', name: '照影镜', kind: 'spell', price: 2, icon: '镜', target: 'none', description: '随机查看对手3张尚未公开的实体手牌。已公开的牌不会重复选中。' },
  { id: 'flush', name: '金花真经', kind: 'spell', price: 3, icon: '花', target: 'suit', description: '选择自己的一张牌，将其花色改为指定花色，本局有效。不能与自己其他手牌重面。' },
  { id: 'swap', name: '换命帖', kind: 'spell', price: 3, icon: '换', target: 'card', description: '弃掉自己的一张牌，从余牌抽取一张；已摆放的位置保留。' },
  { id: 'tide', name: '归潮令', kind: 'spell', price: 7, icon: '潮', target: 'none', description: '收回并替换自己的全部13张手牌。对手的牌及已公开信息不变。' },
  { id: 'rank', name: '易数符', kind: 'spell', price: 7, icon: '数', target: 'rank', description: '选择自己的一张牌，点数增加或减少1。2和A之间不循环，不能与自己其他手牌重面，本局有效。' },
  { id: 'wild', name: '千面符', kind: 'spell', price: 14, icon: '幻', target: 'face', description: '将自己的一张普通牌变为指定点数与花色，本局有效。不能与自己手中其他牌的牌面重复。' },
  { id: 'tail', name: '断尾契', kind: 'spell', price: 6, icon: '契', target: 'none', description: '本局后墩基础输赢由3魂值改为6魂值。同局只能生效一次。' },
  { id: 'shield', name: '护身纸', kind: 'spell', price: 6, icon: '护', target: 'none', description: '本局第一次输墩时，最终扣除的魂值减少3，最低为0。同局只能生效一次。' },
  { id: 'blackred', name: '七黑六红', kind: 'relic', price: 16, icon: '衡', description: '每局初次发牌恰好7张黑牌、6张红牌时，立即获得10魂值。不乘倍率。' },
  { id: 'twin', name: '双生扣', kind: 'relic', price: 12, icon: '双', description: '每局第一次以对子或两对赢墩，额外获得3魂值。' },
  { id: 'wind', name: '逐风铃', kind: 'relic', price: 14, icon: '铃', description: '每局第一次以顺子或同花顺赢墩，额外获得3魂值。' },
  { id: 'flower', name: '同花灯', kind: 'relic', price: 14, icon: '灯', description: '每局第一次以同花或同花顺赢墩，额外获得3魂值。' },
  { id: 'tailrelic', name: '尾签', kind: 'relic', price: 12, icon: '尾', description: '后墩获胜时，额外获得3魂值。' },
  { id: 'headrelic', name: '头签', kind: 'relic', price: 12, icon: '首', description: '前墩获胜时，额外获得3魂值。' },
  { id: 'single', name: '孤灯', kind: 'relic', price: 18, icon: '烛', description: '一局恰好赢一墩，结算额外获得3魂值。' },
  { id: 'full', name: '满堂红', kind: 'relic', price: 24, icon: '喜', description: '一局三墩全胜，结算额外获得6魂值。' },
];
export const ITEM_MAP = Object.fromEntries(ITEMS.map(item => [item.id, item]));
const copy = state => structuredClone(state);
const fail = message => { throw new Error(message); };
const log = (state, message) => { state.logs.push(message); state.logs = state.logs.slice(-60); };
const assertPhase = (state, phase) => { if (state.phase !== phase) fail('当前阶段不能进行这项操作。'); };
const round2 = n => Math.round(n * 100) / 100;
function seedNumber(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 1;
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) || 1;
}
function random(state) {
  let value = state.rng >>> 0;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.rng = value >>> 0;
  return state.rng / 4294967296;
}
function shuffle(state, values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function spend(state, amount) {
  if (!Number.isFinite(amount) || amount < 0) fail('无效的魂值消耗。');
  if (state.soul - amount < 1) fail(`魂值不足：需${amount}魂值，消费后至少保留1魂值。`);
  state.soul = round2(state.soul - amount);
  state.stats.spent = round2(state.stats.spent + amount);
}
export function makeDeck() {
  const deck = [];
  for (let suit = 0; suit < 4; suit++) for (let rank = 2; rank <= 14; rank++) deck.push({ id: `c-${suit}-${rank}`, rank, suit });
  return deck;
}
export function cardName(card) {
  return `${RANK_NAMES[card.rank] || card.rank}${SUITS[card.suit] || ''}`;
}
const pendingRank = () => ({ tier: -1, name: '待组牌', key: [-1] });
const validFace = card => card && !card.joker && Number.isInteger(card.rank) && card.rank >= 2 && card.rank <= 14 && Number.isInteger(card.suit) && card.suit >= 0 && card.suit < 4;
export function rankHand(cards) {
  if (!Array.isArray(cards) || ![3, 5].includes(cards.length) || !cards.every(validFace)) return pendingRank();
  if (new Set(cards.map(card => `${card.rank}:${card.suit}`)).size !== cards.length) return { tier: -1, name: '重复牌面', key: [-1] };
  const ranks = cards.map(card => card.rank).sort((a, b) => b - a);
  const counts = new Map();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const result = (tier, name, values) => ({ tier, name, key: [tier, ...values] });
  if (cards.length === 3) {
    if (groups[0][1] === 3) return result(3, '三条', [groups[0][0]]);
    if (groups[0][1] === 2) return result(1, '对子', [groups[0][0], groups[1][0]]);
    // 前墩的三张同花、连张都只按散牌比较。
    return result(0, '散牌', ranks);
  }
  const flush = cards.every(card => card.suit === cards[0].suit);
  const wheel = ranks.join(',') === '14,5,4,3,2';
  const straight = counts.size === 5 && (wheel || ranks[0] - ranks[4] === 4);
  if (straight && flush) return result(8, '同花顺', [wheel ? 5 : ranks[0]]);
  if (groups[0][1] === 4) return result(7, '四条', [groups[0][0], groups[1][0]]);
  if (groups[0][1] === 3 && groups[1][1] === 2) return result(6, '葫芦', [groups[0][0], groups[1][0]]);
  if (flush) return result(5, '同花', ranks);
  if (straight) return result(4, '顺子', [wheel ? 5 : ranks[0]]);
  if (groups[0][1] === 3) return result(3, '三条', [groups[0][0], ...groups.slice(1).map(group => group[0])]);
  if (groups[0][1] === 2 && groups[1][1] === 2) return result(2, '两对', [groups[0][0], groups[1][0], groups[2][0]]);
  if (groups[0][1] === 2) return result(1, '对子', [groups[0][0], ...groups.slice(1).map(group => group[0])]);
  return result(0, '散牌', ranks);
}
function compareRank(a, b) {
  // 3张前墩和5张中墩同级时，只比较共同存在的点数项。
  // 同级、共同点数相同即可合法，额外的五张牌踢脚不使前墩倒水。
  for (let index = 0; index < Math.min(a.key.length, b.key.length); index++) {
    if (a.key[index] !== b.key[index]) return Math.sign(a.key[index] - b.key[index]);
  }
  return 0;
}
export function compareHands(a, b) { return compareRank(rankHand(a), rankHand(b)); }
function rowsOf(state) { return state.rows.map(row => row.map(id => state.hand.find(card => card.id === id))); }
export function validateRows(state) {
  if (!state || !Array.isArray(state.rows) || state.rows.length !== 3 || state.rows.some((row, index) => !Array.isArray(row) || row.length !== ROW_SIZES[index])) return { ok: false, message: '前墩放3张，中墩和后墩各放5张，共13张。' };
  const ids = state.rows.flat();
  if (new Set(ids).size !== 13 || ids.some(id => !state.hand.some(card => card.id === id))) return { ok: false, message: '十三张手牌都要使用，且每张只能使用一次。' };
  const groups = rowsOf(state);
  if (groups.some(group => rankHand(group).tier < 0)) return { ok: false, message: '牌面无效或重复，无法结算。' };
  if (compareHands(groups[0], groups[1]) > 0) return { ok: false, message: `倒水：前墩${rankHand(groups[0]).name}强于中墩${rankHand(groups[1]).name}，请调整。`, invalidRows: [0, 1] };
  if (compareHands(groups[1], groups[2]) > 0) return { ok: false, message: `倒水：中墩${rankHand(groups[1]).name}强于后墩${rankHand(groups[2]).name}，请调整。`, invalidRows: [1, 2] };
  return { ok: true, message: '前墩 ≤ 中墩 ≤ 后墩，可以开牌。' };
}
function combinations(length, count) {
  const results = [], current = [];
  const walk = start => {
    if (current.length === count) { results.push([...current]); return; }
    for (let index = start; index <= length - count + current.length; index++) { current.push(index); walk(index + 1); current.pop(); }
  };
  walk(0);
  return results;
}
const THREE_OF_THIRTEEN = combinations(13, 3);
const FIVE_OF_THIRTEEN = combinations(13, 5);
const FOUR_OF_NINE = combinations(9, 4);
const arrangementCache = new Map();
function rankStrength(rank) {
  return rank.tier * 20 + rank.key.slice(1).reduce((sum, value, index) => sum + value / (15 ** index), 0);
}
function solve(cards) {
  if (!Array.isArray(cards) || cards.length !== 13 || !cards.every(validFace) || new Set(cards.map(card => card.id)).size !== 13 || new Set(cards.map(card => `${card.rank}:${card.suit}`)).size !== 13) fail('需要13张不同的有效手牌才能给出摆牌参考。');
  const ordered = [...cards].sort((a, b) => a.id.localeCompare(b.id));
  const signature = ordered.map(card => `${card.id}:${card.rank}:${card.suit}`).join('|');
  if (arrangementCache.has(signature)) return arrangementCache.get(signature);
  const ranks = new Map(), indexes = new Map();
  for (const indices of [...THREE_OF_THIRTEEN, ...FIVE_OF_THIRTEEN]) {
    const mask = indices.reduce((value, index) => value | (1 << index), 0);
    const rank = rankHand(indices.map(index => ordered[index]));
    ranks.set(mask, rank); indexes.set(mask, indices);
  }
  const all = [];
  for (const frontIndices of THREE_OF_THIRTEEN) {
    const frontMask = frontIndices.reduce((mask, index) => mask | (1 << index), 0);
    const remaining = [];
    for (let i = 0; i < 13; i++) if (!(frontMask & (1 << i))) remaining.push(i);
    const frontRank = ranks.get(frontMask);
    // 固定剩余第一张在其中一组，避免对称重复；前3×中5×后5共考察36036分配。
    for (const tailIndices of FOUR_OF_NINE) {
      let middleMask = 1 << remaining[0];
      for (const index of tailIndices) middleMask |= 1 << remaining[index + 1];
      let backMask = 8191 ^ frontMask ^ middleMask;
      if (compareRank(ranks.get(middleMask), ranks.get(backMask)) > 0) [middleMask, backMask] = [backMask, middleMask];
      const middleRank = ranks.get(middleMask), backRank = ranks.get(backMask);
      if (compareRank(frontRank, middleRank) > 0) continue;
      const strengths = [frontRank, middleRank, backRank].map(rankStrength);
      const score = strengths[0] * 2.1 + strengths[1] * 1.25 + strengths[2];
      all.push({ masks: [frontMask, middleMask, backMask], score, front: strengths[0] * 10000 + score, back: strengths[2] * 10000 + score });
    }
  }
  if (!all.length) fail('当前手牌没有合法分配。');
  const materialize = item => ({ rows: item.masks.map(mask => indexes.get(mask).map(index => ordered[index].id)), types: item.masks.map(mask => ranks.get(mask).name), score: item.score });
  all.sort((a, b) => b.score - a.score);
  const balanced = all.slice(0, 64).map(materialize);
  all.sort((a, b) => b.front - a.front);
  const front = all.slice(0, 64).map(materialize);
  all.sort((a, b) => b.back - a.back);
  const back = all.slice(0, 64).map(materialize);
  const solutions = { balanced, front, back };
  arrangementCache.set(signature, solutions);
  if (arrangementCache.size > 8) arrangementCache.delete(arrangementCache.keys().next().value);
  return solutions;
}
export function findArrangements(cards) { return copy(solve(cards).balanced); }
export function getSuggestions(cards) {
  const solutions = solve(cards), seen = new Set(), result = [];
  for (const [style, label] of [['balanced', '均衡三墩'], ['front', '优先前墩'], ['back', '做强后墩']]) {
    const choice = solutions[style].find(candidate => !seen.has(JSON.stringify(candidate.rows)));
    if (!choice) continue;
    seen.add(JSON.stringify(choice.rows));
    result.push({ style, label, ...copy(choice) });
  }
  return result;
}
function makeShop(state) {
  let spells = shuffle(state, ITEMS.filter(item => item.kind === 'spell'));
  if (state.completed === 1 && state.stats.shopsVisited === 0) spells = [ITEM_MAP.flush, ITEM_MAP.mirror, ...spells.filter(item => !['flush', 'mirror'].includes(item.id))];
  const relics = shuffle(state, ITEMS.filter(item => item.kind === 'relic' && !state.relics.includes(item.id)));
  const pool = [...spells.slice(0, 4), ...relics.slice(0, 2)];
  while (pool.length < 6) pool.push(spells[pool.length % spells.length]);
  return pool.map((item, index) => ({ id: `s-${state.completed}-${state.stats.refreshes}-${index}`, itemId: item.id, sold: false }));
}
export function newGame(seed = Date.now()) {
  const parsed = seedNumber(seed);
  return { version: CONFIG.version, ruleset: CONFIG.ruleset, seed: String(seed), rng: parsed, soul: CONFIG.startingSoul, completed: 0, chapter: 1, round: 1, phase: 'intro', deck: makeDeck(), hand: [], enemy: [], rows: [[], [], []], enemyRows: [[], [], []], stock: [], discarded: [], inventory: [], relics: [], shop: [], lastResult: null, logs: ['你推开牌馆的门，带着100魂值入席。'], selectedAltar: 'c-0-2', revealedEnemy: [], effects: {}, initialBonusApplied: false, stats: { wins: 0, losses: 0, ties: 0, spellsUsed: 0, spent: 0, earned: 0, shopsVisited: 0, refreshes: 0, highestSoul: CONFIG.startingSoul } };
}
function deal(state) {
  const cards = shuffle(state, copy(state.deck));
  state.hand = cards.splice(0, CONFIG.handSize);
  state.enemy = cards.splice(0, CONFIG.handSize).map(card => { delete card.spirit; delete card.stamp; return card; });
  state.stock = cards;
  state.discarded = [];
  state.rows = [[], [], []];
  state.effects = {};
  state.revealedEnemy = [];
  state.initialBonusApplied = false;
  const candidates = findArrangements(state.enemy);
  // The rival chooses among a small set based only on their own cards.
  const choiceRange = Math.max(1, 9 - Math.floor((state.chapter - 1) / 2));
  state.enemyRows = candidates[Math.floor(random(state) * choiceRange)].rows;
  if (state.relics.includes('blackred')) {
    const normal = state.hand.filter(card => !card.joker);
    const blacks = normal.filter(card => card.suit === 1 || card.suit === 3).length;
    const reds = normal.filter(card => card.suit === 0 || card.suit === 2).length;
    if (blacks === 7 && reds === 6) {
      state.soul += 10; state.stats.earned += 10;
      log(state, '七黑六红：初次发牌获得10魂值。');
    }
  }
  state.initialBonusApplied = true;
  state.phase = 'arrange';
  state.stats.highestSoul = Math.max(state.stats.highestSoul, state.soul);
  log(state, `第${state.chapter}章·第${state.round}回合，十三张牌已发下。`);
  return state;
}
export function startHand(state) {
  assertPhase(state, 'intro');
  if (state.completed !== 0) fail('该局已经开始，请继续当前牌局。');
  return deal(copy(state));
}
export function placeCard(state, cardId, rowIndex, slot) {
  assertPhase(state, 'arrange');
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > 2) fail('请选择前、中、后墩。');
  if (!state.hand.some(card => card.id === cardId)) fail('这张牌不在你的手中。');
  const next = copy(state);
  const sourceRow = next.rows.findIndex(row => row.includes(cardId));
  const sourceIndex = sourceRow < 0 ? -1 : next.rows[sourceRow].indexOf(cardId);
  if (sourceRow === rowIndex && slot == null) return next;
  const target = next.rows[rowIndex];
  if (target.length >= ROW_SIZES[rowIndex] && slot == null) fail(`这一墩已经有${ROW_SIZES[rowIndex]}张牌；点击其中一张牌可以交换。`);
  if (slot != null && (!Number.isInteger(slot) || slot < 0 || slot >= ROW_SIZES[rowIndex])) fail('无效的牌位。');
  const displaced = slot == null ? null : target[slot];
  if (displaced === cardId) return next;
  if (sourceRow >= 0) next.rows[sourceRow].splice(sourceIndex, 1);
  if (displaced) {
    const targetPosition = next.rows[rowIndex].indexOf(displaced);
    next.rows[rowIndex].splice(targetPosition, 1, cardId);
    if (sourceRow >= 0) next.rows[sourceRow].splice(Math.min(sourceIndex, next.rows[sourceRow].length), 0, displaced);
  } else {
    next.rows[rowIndex].splice(Math.min(slot ?? next.rows[rowIndex].length, next.rows[rowIndex].length), 0, cardId);
  }
  return next;
}
export function returnToHand(state, cardId) {
  assertPhase(state, 'arrange');
  if (!state.hand.some(card => card.id === cardId)) fail('找不到这张手牌。');
  const next = copy(state);
  next.rows = next.rows.map(row => row.filter(id => id !== cardId));
  return next;
}
export function clearRows(state) {
  assertPhase(state, 'arrange');
  const next = copy(state); next.rows = [[], [], []]; return next;
}
export function autoArrange(state, style = 'balanced') {
  assertPhase(state, 'arrange');
  if (!['balanced', 'front', 'back'].includes(style)) fail('未知的摆牌参考。');
  const choices = getSuggestions(state.hand);
  const arrangement = choices.find(choice => choice.style === style) || choices[0];
  const next = copy(state); spend(next, CONFIG.autoPrice); next.rows = copy(arrangement.rows);
  log(next, `采用${arrangement.label}参考，消耗1魂值。`); return next;
}
export function transformJoker() { fail('十三张使用52张普通牌，不含大小王。'); }
function validateFace(rank, suit) {
  if (!Number.isInteger(rank) || rank < 2 || rank > 14 || !Number.isInteger(suit) || suit < 0 || suit > 3) fail('请选择2至A中的点数以及一种花色。');
}
function handTarget(state, target) {
  const card = state.hand.find(card => card.id === target?.cardId);
  if (!card) fail('请先选择自己的一张手牌。');
  return card;
}
function replaceOne(state, cardId) {
  const index = state.hand.findIndex(card => card.id === cardId);
  if (index < 0) fail('请选择自己的一张手牌。');
  if (state.stock.length < 1) fail('余牌已经用完，不能再换牌。');
  const previous = state.hand[index];
  const occupied = new Set(state.hand.filter(card => card.id !== cardId).map(card => `${card.rank}:${card.suit}`));
  const replacementIndex = state.stock.findIndex(card => !occupied.has(`${card.rank}:${card.suit}`));
  if (replacementIndex < 0) fail('余牌没有可换入的不重复牌面。');
  const [replacement] = state.stock.splice(replacementIndex, 1);
  state.discarded.push(previous);
  state.hand[index] = replacement;
  state.rows = state.rows.map(row => row.map(id => id === previous.id ? replacement.id : id));
}
function redrawThirteen(state) {
  if (state.stock.length < CONFIG.handSize) fail('余牌不足13张，不能重新洗牌。');
  state.discarded.push(...state.hand);
  state.hand = state.stock.splice(0, CONFIG.handSize);
  state.rows = [[], [], []];
}
export function replaceCard(state, cardId) {
  assertPhase(state, 'arrange');
  const next = copy(state); replaceOne(next, cardId); spend(next, CONFIG.exchangePrice);
  log(next, '换牌消耗3魂值。'); return next;
}
export function reshuffleHand(state) {
  assertPhase(state, 'arrange');
  const next = copy(state); redrawThirteen(next); spend(next, CONFIG.reshufflePrice);
  log(next, '洗牌消耗12魂值，重新抽取十三张手牌。'); return next;
}
export function useItem(state, itemId, target = {}) {
  assertPhase(state, 'arrange');
  const item = ITEM_MAP[itemId];
  if (!item || item.kind !== 'spell') fail('这不是可使用的符令。');
  const index = state.inventory.indexOf(itemId);
  if (index < 0) fail('背包里没有这张符令。');
  const next = copy(state);
  if (itemId === 'mirror') {
    const unknown = shuffle(next, next.enemy.filter(card => !next.revealedEnemy.includes(card.id)));
    if (!unknown.length) fail('对手所有手牌都已公开。');
    next.revealedEnemy.push(...unknown.slice(0, 3).map(card => card.id));
  } else if (itemId === 'swap') replaceOne(next, target.cardId);
  else if (itemId === 'tide') redrawThirteen(next);
  else if (itemId === 'tail' || itemId === 'shield') {
    if (next.effects[itemId]) fail('这个效果本局已经生效。');
    next.effects[itemId] = true;
  } else {
    const card = handTarget(next, target);
    if (itemId === 'flush') {
      validateFace(card.rank, target.suit);
      if (card.suit === target.suit) fail('请选择与当前不同的花色。');
      card.suit = target.suit;
    } else if (itemId === 'rank') {
      validateFace(target.rank, card.suit);
      if (Math.abs(target.rank - card.rank) !== 1) fail('易数符只允许点数增加或减少1。');
      card.rank = target.rank;
    } else if (itemId === 'wild') {
      validateFace(target.rank, target.suit);
      if (card.rank === target.rank && card.suit === target.suit) fail('请选择一个不同的牌面。');
      card.rank = target.rank; card.suit = target.suit;
    }
    if (next.hand.some(other => other.id !== card.id && other.rank === card.rank && other.suit === card.suit)) fail('不能变成自己手中已经存在的牌面，请选择其他牌。');
    card.altered = true;
  }
  next.inventory.splice(index, 1);
  next.stats.spellsUsed++;
  log(next, `使用了${item.name}。`);
  return next;
}
export function resolveHand(state) {
  assertPhase(state, 'arrange');
  const validation = validateRows(state);
  if (!validation.ok) fail(validation.message);
  const next = copy(state);
  const playerRows = rowsOf(next);
  const enemyRows = next.enemyRows.map(row => row.map(id => next.enemy.find(card => card.id === id)));
  const triggered = new Set();
  let shieldUsed = false;
  const lanes = playerRows.map((player, index) => {
    const enemy = enemyRows[index];
    const outcome = compareHands(player, enemy);
    const playerType = rankHand(player).name;
    const enemyType = rankHand(enemy).name;
    const base = CONFIG.baseStake * (next.effects.tail && index === 2 ? 2 : 1);
    const multiplier = (player.some(card => card.spirit) ? 2 : 1) * (player.some(card => card.stamp) ? 1.5 : 1);
    const notes = [];
    if (player.some(card => card.spirit)) notes.push('附灵·圣灵 ×2');
    if (player.some(card => card.stamp)) notes.push('刻印·金印 ×1.5');
    let delta = outcome * base * multiplier;
    if (outcome < 0 && next.effects.shield && !shieldUsed) { delta = Math.min(0, delta + 3); notes.push('护身纸减免3'); shieldUsed = true; }
    if (outcome > 0) {
      const extras = [
        ['twin', playerType === '对子' || playerType === '两对'], ['wind', playerType === '顺子' || playerType === '同花顺'],
        ['flower', playerType === '同花' || playerType === '同花顺'], ['tailrelic', index === 2], ['headrelic', index === 0],
      ];
      for (const [id, eligible] of extras) if (eligible && next.relics.includes(id) && !triggered.has(id)) {
        triggered.add(id); delta += 3; notes.push(`${ITEM_MAP[id].name} +3`);
      }
    }
    return { index, player: copy(player), enemy: copy(enemy), playerType, enemyType, outcome, base, multiplier, delta: round2(delta), notes };
  });
  const wins = lanes.filter(lane => lane.outcome > 0).length;
  let bonus = 0;
  const bonusNotes = [];
  if (wins === 1 && next.relics.includes('single')) { bonus += 3; bonusNotes.push('孤灯 +3'); }
  if (wins === 3 && next.relics.includes('full')) { bonus += 6; bonusNotes.push('满堂红 +6'); }
  const total = round2(lanes.reduce((sum, lane) => sum + lane.delta, 0) + bonus);
  const soulBefore = next.soul;
  next.soul = round2(next.soul + total);
  next.completed++;
  if (total > 0) next.stats.wins++; else if (total < 0) next.stats.losses++; else next.stats.ties++;
  next.stats.earned = round2(next.stats.earned + Math.max(0, total));
  next.stats.highestSoul = Math.max(next.stats.highestSoul, next.soul);
  next.lastResult = { lanes, bonus, bonusNotes, total, soulBefore, soulAfter: next.soul, completed: next.completed };
  next.revealedEnemy = next.enemy.map(card => card.id);
  next.phase = 'settlement';
  log(next, `第${next.completed}局结算${total >= 0 ? '+' : ''}${total}魂值。`);
  return next;
}
export function enterShop(state) {
  assertPhase(state, 'settlement');
  const next = copy(state);
  if (next.soul <= 0) { next.phase = 'defeat'; log(next, '魂值耗尽，此局已终。'); return next; }
  if (next.completed >= CONFIG.chapters * CONFIG.roundsPerChapter) { next.phase = 'victory'; log(next, '三十六局已过，百妖为你让席。'); return next; }
  next.phase = 'shop';
  next.shop = makeShop(next);
  next.stats.shopsVisited++;
  next.selectedAltar = next.hand[0]?.id || next.deck[0].id;
  return next;
}
export function continueRun(state) {
  assertPhase(state, 'shop');
  if (state.soul < 1) fail('魂值已耗尽。');
  const next = copy(state);
  next.chapter = Math.floor(next.completed / CONFIG.roundsPerChapter) + 1;
  next.round = (next.completed % CONFIG.roundsPerChapter) + 1;
  return deal(next);
}
export function buyItem(state, index) {
  assertPhase(state, 'shop');
  const offer = state.shop[index];
  if (!offer || offer.sold) fail('这件货品已经售出。');
  const item = ITEM_MAP[offer.itemId];
  if (!item) fail('找不到这件货品。');
  if (item.kind === 'spell' && state.inventory.length >= CONFIG.inventoryCap) fail('符令背包已满，最多携带10张。');
  if (item.kind === 'relic' && state.relics.length >= CONFIG.relicCap) fail('奇珍位置已满，最多12件。');
  if (item.kind === 'relic' && state.relics.includes(item.id)) fail('已经拥有这件奇珍。');
  const next = copy(state); spend(next, item.price);
  (item.kind === 'spell' ? next.inventory : next.relics).push(item.id);
  next.shop[index].sold = true;
  log(next, `购入${item.name}，消耗${item.price}魂值。`);
  return next;
}
export function refreshShop(state) {
  assertPhase(state, 'shop');
  const next = copy(state); spend(next, CONFIG.refreshPrice); next.stats.refreshes++;
  next.shop = makeShop(next); log(next, '刷新商店消耗6魂值。'); return next;
}
export function altar(state, action, cardId) {
  assertPhase(state, 'shop');
  const next = copy(state);
  const card = next.deck.find(card => card.id === cardId);
  if (!card) fail('请先选择一张牌作为祭坛目标。');
  if (action === 'spirit') {
    if (card.spirit) fail('这张牌已经附灵。');
    spend(next, CONFIG.spiritPrice); card.spirit = 'saint'; log(next, `${cardName(card)}附灵·圣灵，消耗10魂值。`);
  } else if (action === 'stamp') {
    if (card.stamp) fail('这张牌已经刻印。');
    spend(next, CONFIG.stampPrice); card.stamp = 'gold'; log(next, `${cardName(card)}刻印·金印，消耗14魂值。`);
  } else if (action === 'sacrifice') {
    if (!card.spirit && !card.stamp) fail('这张牌没有改造，无法祭拜。');
    if (next.inventory.length >= CONFIG.inventoryCap) fail('符令背包已满，无法领取祭拜所得。');
    delete card.spirit; delete card.stamp;
    const spells = ITEMS.filter(item => item.kind === 'spell');
    const item = spells[Math.floor(random(next) * spells.length)];
    next.inventory.push(item.id); log(next, `祭拜清除了${cardName(card)}的改造，获得${item.name}。`);
  } else fail('未知的祭坛操作。');
  next.selectedAltar = cardId;
  return next;
}
export function serialize(state) { return JSON.stringify(state); }
export function hydrate(serialized) {
  let state;
  try { state = typeof serialized === 'string' ? JSON.parse(serialized) : copy(serialized); } catch { fail('存档损坏，无法继续游戏。'); }
  const invalid = () => fail('存档内容不完整或已损坏，无法继续游戏。');
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, min, max = Number.MAX_SAFE_INTEGER) => Number.isInteger(value) && value >= min && value <= max;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const strings = value => Array.isArray(value) && value.every(entry => typeof entry === 'string');
  const unique = values => new Set(values).size === values.length;
  const phases = ['intro', 'arrange', 'settlement', 'shop', 'defeat', 'victory'];
  if (!record(state) || state.version !== CONFIG.version || state.ruleset !== CONFIG.ruleset || !phases.includes(state.phase) || !finite(state.soul) || !integer(state.completed, 0, 36) || !integer(state.rng, 1, 0xffffffff) || typeof state.seed !== 'string') invalid();
  for (const key of ['deck', 'hand', 'enemy', 'rows', 'enemyRows', 'stock', 'discarded', 'inventory', 'relics', 'shop', 'logs', 'revealedEnemy']) if (!Array.isArray(state[key])) invalid();
  const original = new Map(makeDeck().map(card => [card.id, card]));
  const validCard = (card, inDeck = false) => {
    if (!record(card) || typeof card.id !== 'string' || !original.has(card.id)) return false;
    const source = original.get(card.id);
    if (card.joker !== source.joker || (card.spirit !== undefined && card.spirit !== 'saint') || (card.stamp !== undefined && card.stamp !== 'gold')) return false;
    for (const key of ['transformed', 'altered']) if (card[key] !== undefined && typeof card[key] !== 'boolean') return false;
    if (inDeck) return card.rank === source.rank && card.suit === source.suit && !card.transformed && !card.altered && (!card.joker || (!card.spirit && !card.stamp));
    return integer(card.rank, 2, 14) && integer(card.suit, 0, 3) && !card.joker && !card.transformed;
  };
  if (state.deck.length !== CONFIG.deckSize || !state.deck.every(card => validCard(card, true)) || !unique(state.deck.map(card => card.id))) invalid();
  for (const key of ['hand', 'enemy', 'stock', 'discarded']) if (!state[key].every(card => validCard(card))) invalid();
  if (!original.has(state.selectedAltar) || typeof state.initialBonusApplied !== 'boolean') invalid();
  const initial = state.phase === 'intro';
  if (initial) {
    if (state.completed !== 0 || state.chapter !== 1 || state.round !== 1 || state.initialBonusApplied || state.lastResult !== null || state.hand.length || state.enemy.length || state.stock.length || state.discarded.length) invalid();
  } else {
    if (state.hand.length !== CONFIG.handSize || state.enemy.length !== CONFIG.handSize || !state.initialBonusApplied) invalid();
    if (!unique(state.hand.map(card => `${card.rank}:${card.suit}`)) || !unique(state.enemy.map(card => `${card.rank}:${card.suit}`))) invalid();
    const dealt = [...state.hand, ...state.enemy, ...state.stock, ...state.discarded].map(card => card.id);
    if (dealt.length !== CONFIG.deckSize || !unique(dealt)) invalid();
    const position = state.phase === 'arrange' ? state.completed : state.completed - 1;
    if (!integer(position, 0, 35) || state.chapter !== Math.floor(position / 3) + 1 || state.round !== position % 3 + 1) invalid();
  }
  const validRows = (rows, cards, complete) => Array.isArray(rows) && rows.length === 3 && rows.every((row, index) => strings(row) && row.length <= ROW_SIZES[index] && (!complete || row.length === ROW_SIZES[index])) && unique(rows.flat()) && rows.flat().every(id => cards.some(card => card.id === id));
  if (!validRows(state.rows, state.hand, !initial && state.phase !== 'arrange') || !validRows(state.enemyRows, state.enemy, !initial)) invalid();
  if (!initial) {
    const enemyGroups = state.enemyRows.map(row => row.map(id => state.enemy.find(card => card.id === id)));
    if (enemyGroups.some(group => rankHand(group).tier < 0) || compareHands(enemyGroups[0], enemyGroups[1]) > 0 || compareHands(enemyGroups[1], enemyGroups[2]) > 0 || (state.phase !== 'arrange' && !validateRows(state).ok)) invalid();
  }
  if (!strings(state.revealedEnemy) || !unique(state.revealedEnemy) || state.revealedEnemy.some(id => !state.enemy.some(card => card.id === id))) invalid();
  if (!strings(state.inventory) || state.inventory.length > CONFIG.inventoryCap || state.inventory.some(id => ITEM_MAP[id]?.kind !== 'spell')) invalid();
  if (!strings(state.relics) || state.relics.length > CONFIG.relicCap || !unique(state.relics) || state.relics.some(id => ITEM_MAP[id]?.kind !== 'relic')) invalid();
  if (!strings(state.logs) || !record(state.effects) || Object.keys(state.effects).some(key => !['tail', 'shield'].includes(key) || typeof state.effects[key] !== 'boolean')) invalid();
  if (!record(state.stats)) invalid();
  for (const key of ['wins', 'losses', 'ties', 'spellsUsed', 'shopsVisited', 'refreshes']) if (!integer(state.stats[key], 0)) invalid();
  for (const key of ['spent', 'earned', 'highestSoul']) if (!finite(state.stats[key]) || state.stats[key] < 0) invalid();
  if (state.stats.wins + state.stats.losses + state.stats.ties !== state.completed) invalid();
  if (![0, 6].includes(state.shop.length) || !state.shop.every(offer => record(offer) && typeof offer.id === 'string' && typeof offer.itemId === 'string' && Object.hasOwn(ITEM_MAP, offer.itemId) && typeof offer.sold === 'boolean') || !unique(state.shop.map(offer => offer.id))) invalid();
  if (state.phase === 'shop' && (state.shop.length !== 6 || state.completed >= 36)) invalid();
  if (state.phase === 'defeat' ? state.soul > 0 : state.phase !== 'settlement' && state.soul < 1) invalid();
  if (state.phase === 'victory' && state.completed !== 36) invalid();
  const result = state.lastResult;
  if (state.completed === 0) { if (result !== null) invalid(); }
  else {
    if (!record(result) || !Array.isArray(result.lanes) || result.lanes.length !== 3 || result.completed !== state.completed || !strings(result.bonusNotes)) invalid();
    for (const key of ['bonus', 'total', 'soulBefore', 'soulAfter']) if (!finite(result[key])) invalid();
    for (const [index, lane] of result.lanes.entries()) {
      if (!record(lane) || lane.index !== index || ![-1, 0, 1].includes(lane.outcome) || !strings(lane.notes)) invalid();
      for (const key of ['player', 'enemy']) if (!Array.isArray(lane[key]) || lane[key].length !== ROW_SIZES[index] || !lane[key].every(card => validCard(card))) invalid();
      if (lane.playerType !== rankHand(lane.player).name || lane.enemyType !== rankHand(lane.enemy).name || lane.outcome !== compareHands(lane.player, lane.enemy)) invalid();
      if (!finite(lane.base) || lane.base <= 0 || !finite(lane.multiplier) || lane.multiplier <= 0 || !finite(lane.delta)) invalid();
    }
    if (!unique(result.lanes.flatMap(lane => [...lane.player, ...lane.enemy]).map(card => card.id))) invalid();
    if (round2(result.lanes.reduce((sum, lane) => sum + lane.delta, 0) + result.bonus) !== result.total || round2(result.soulBefore + result.total) !== result.soulAfter) invalid();
    if (['settlement', 'defeat', 'victory'].includes(state.phase) && state.soul !== result.soulAfter) invalid();
  }
  return state;
}
