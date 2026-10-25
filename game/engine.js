/**
 * 比鸡流程原型的纯状态引擎。所有操作返回新状态，禁止重复结算与越阶段消费。
 * 视频可确认：54张牌中的大小王、三墩比牌、±3基础魂值、36局、商店6格、
 * 10符令/12奇珍、刷新6、附灵10、刻印14、圣灵×2及金印×1.5。
 * 未展示的符令、发牌策略和奖励细节为本原型的可替换参数，不宣称原版规则。
 */
export const CONFIG = Object.freeze({ version: 1, startingSoul: 100, chapters: 12, roundsPerChapter: 3, baseStake: 3, inventoryCap: 10, relicCap: 12, refreshPrice: 6, spiritPrice: 10, stampPrice: 14, autoPrice: 1, exchangePrice: 3, reshufflePrice: 12 });
export const SUITS = ['♦', '♣', '♥', '♠'];
export const RANK_NAMES = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const ITEMS = [
  { id: 'mirror', name: '照影镜', kind: 'spell', price: 2, icon: '镜', target: 'none', description: '随机查看对手3张尚未公开的实体手牌。已公开的牌不会重复选中。' },
  { id: 'flush', name: '金花真经', kind: 'spell', price: 3, icon: '花', target: 'suit', description: '选择自己的一张普通牌，将其花色改为指定花色，本局有效。' },
  { id: 'swap', name: '换命帖', kind: 'spell', price: 3, icon: '换', target: 'card', description: '弃掉自己的一张牌，从余牌抽取一张；已摆放的位置保留。' },
  { id: 'tide', name: '归潮令', kind: 'spell', price: 7, icon: '潮', target: 'none', description: '收回并替换自己的全部9张手牌。对手的牌及已公开信息不变。' },
  { id: 'rank', name: '易数符', kind: 'spell', price: 7, icon: '数', target: 'rank', description: '选择自己的一张普通牌，点数增加或减少1。2和A之间不循环，本局有效。' },
  { id: 'wild', name: '千面符', kind: 'spell', price: 14, icon: '幻', target: 'face', description: '将自己的一张普通牌变为指定点数与花色，本局有效。允许出现相同牌面。' },
  { id: 'tail', name: '断尾契', kind: 'spell', price: 6, icon: '契', target: 'none', description: '本局大墩基础输赢由3魂值改为6魂值。同局只能生效一次。' },
  { id: 'shield', name: '护身纸', kind: 'spell', price: 6, icon: '护', target: 'none', description: '本局第一次输墩时，最终扣除的魂值减少3，最低为0。同局只能生效一次。' },
  { id: 'blackred', name: '七黑两红', kind: 'relic', price: 16, icon: '衡', description: '每局初次发牌恰好7张黑牌、2张红牌时，立即获得10魂值。大小王不计，不乘倍率。' },
  { id: 'twin', name: '双生扣', kind: 'relic', price: 12, icon: '双', description: '每局第一次以对子赢墩，额外获得3魂值。' },
  { id: 'wind', name: '逐风铃', kind: 'relic', price: 14, icon: '铃', description: '每局第一次以顺子或同花顺赢墩，额外获得3魂值。' },
  { id: 'flower', name: '同花灯', kind: 'relic', price: 14, icon: '灯', description: '每局第一次以同花或同花顺赢墩，额外获得3魂值。' },
  { id: 'tailrelic', name: '尾签', kind: 'relic', price: 12, icon: '尾', description: '大墩获胜时，额外获得3魂值。' },
  { id: 'headrelic', name: '头签', kind: 'relic', price: 12, icon: '首', description: '小墩获胜时，额外获得3魂值。' },
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
  deck.push({ id: 'joker-small', rank: 0, suit: -1, joker: 'small' }, { id: 'joker-big', rank: 0, suit: -1, joker: 'big' });
  return deck;
}
export function cardName(card) {
  if (card.joker && !card.transformed) return card.joker === 'big' ? '大王' : '小王';
  return `${RANK_NAMES[card.rank] || card.rank}${SUITS[card.suit] || ''}`;
}
export function rankHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 3) return { tier: -1, name: '待组牌', key: [-1] };
  if (cards.some(card => !card || !Number.isInteger(card.rank) || card.rank < 2 || card.rank > 14 || !Number.isInteger(card.suit) || card.suit < 0 || card.suit > 3)) return { tier: -1, name: '待变化', key: [-1] };
  const sorted = [...cards].sort((a, b) => b.rank - a.rank || b.suit - a.suit);
  const ranks = sorted.map(card => card.rank);
  const counts = new Map();
  for (const card of sorted) counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  const isFlush = cards.every(card => card.suit === cards[0].suit);
  const lowAce = ranks.join(',') === '14,3,2';
  const isStraight = counts.size === 3 && (lowAce || (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1));
  const suits = sorted.map(card => card.suit);
  if (counts.size === 1) return { tier: 5, name: '三条', key: [5, ranks[0], ...suits] };
  if (isStraight && isFlush) return { tier: 4, name: '同花顺', key: [4, lowAce ? 3 : ranks[0], cards[0].suit] };
  if (isFlush) return { tier: 3, name: '同花', key: [3, ...ranks, cards[0].suit] };
  if (isStraight) {
    const straightCards = [...cards].sort((a, b) => (lowAce && b.rank === 14 ? 1 : b.rank) - (lowAce && a.rank === 14 ? 1 : a.rank) || b.suit - a.suit);
    return { tier: 2, name: '顺子', key: [2, lowAce ? 3 : ranks[0], ...straightCards.map(card => card.suit)] };
  }
  if (counts.size === 2) {
    const pairRank = [...counts.entries()].find(([, count]) => count === 2)[0];
    const kicker = sorted.find(card => card.rank !== pairRank);
    return { tier: 1, name: '对子', key: [1, pairRank, kicker.rank, ...sorted.filter(card => card.rank === pairRank).map(card => card.suit), kicker.suit] };
  }
  return { tier: 0, name: '散牌', key: [0, ...ranks, ...suits] };
}
export function compareHands(a, b) {
  const ka = rankHand(a).key, kb = rankHand(b).key;
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const difference = (ka[i] || 0) - (kb[i] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}
function rowsOf(state) { return state.rows.map(row => row.map(id => state.hand.find(card => card.id === id))); }
export function validateRows(state) {
  if (!state || !Array.isArray(state.rows) || state.rows.length !== 3 || state.rows.some(row => !Array.isArray(row) || row.length !== 3)) return { ok: false, message: '把9张手牌分成3墩，每墩3张。' };
  const ids = state.rows.flat();
  if (new Set(ids).size !== 9 || ids.some(id => !state.hand.some(card => card.id === id))) return { ok: false, message: '每张手牌只能使用一次。' };
  const rows = rowsOf(state);
  if (rows.some(row => rankHand(row).tier < 0)) return { ok: false, message: '请先点击大小王，选定变化牌面。' };
  if (compareHands(rows[0], rows[1]) > 0 || compareHands(rows[1], rows[2]) > 0) return { ok: false, message: '请按小墩 ≤ 中墩 ≤ 大墩摆牌，不能倒墩。' };
  return { ok: true, message: '三墩合法，可以结束出牌。' };
}
function arrangementScore(groups) {
  return groups.reduce((score, row, index) => {
    const r = rankHand(row);
    const rankValue = r.key.slice(1).reduce((sum, value, i) => sum + value / (16 ** i), 0);
    return score + [1.06, 1.02, 1][index] * (Math.pow(r.tier + 1, 1.35) * 20 + rankValue);
  }, 0);
}
export function findArrangements(cards) {
  if (!Array.isArray(cards) || cards.length !== 9 || cards.some(card => rankHand([card, card, card]).tier < 0)) fail('请先为大小王选择牌面。');
  const arrangements = [];
  for (let a = 1; a < 8; a++) for (let b = a + 1; b < 9; b++) {
    const group1 = [cards[0], cards[a], cards[b]];
    const remaining = cards.filter((_, i) => i !== 0 && i !== a && i !== b);
    for (let c = 1; c < 5; c++) for (let d = c + 1; d < 6; d++) {
      const group2 = [remaining[0], remaining[c], remaining[d]];
      const group3 = remaining.filter((_, i) => i !== 0 && i !== c && i !== d);
      const groups = [group1, group2, group3].sort(compareHands);
      arrangements.push({ rows: groups.map(row => row.map(card => card.id)), score: arrangementScore(groups) });
    }
  }
  return arrangements.sort((a, b) => b.score - a.score);
}
function transformEnemyJokers(state) {
  for (const card of state.enemy) {
    if (!card.joker) continue;
    const others = state.enemy.filter(other => other.rank >= 2 && other.id !== card.id);
    const rankCounts = new Map();
    for (const other of others) rankCounts.set(other.rank, (rankCounts.get(other.rank) || 0) + 1);
    const bestRank = [...rankCounts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] || 14;
    card.rank = bestRank; card.suit = 3; card.transformed = true;
  }
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
  return { version: CONFIG.version, seed: String(seed), rng: parsed, soul: CONFIG.startingSoul, completed: 0, chapter: 1, round: 1, phase: 'intro', deck: makeDeck(), hand: [], enemy: [], rows: [[], [], []], enemyRows: [[], [], []], stock: [], discarded: [], inventory: [], relics: [], shop: [], lastResult: null, logs: ['你推开牌馆的门，带着100魂值入席。'], selectedAltar: 'c-0-2', revealedEnemy: [], effects: {}, initialBonusApplied: false, stats: { wins: 0, losses: 0, ties: 0, spellsUsed: 0, spent: 0, earned: 0, shopsVisited: 0, refreshes: 0, highestSoul: CONFIG.startingSoul } };
}
function deal(state) {
  const cards = shuffle(state, copy(state.deck));
  state.hand = cards.splice(0, 9);
  state.enemy = cards.splice(0, 9).map(card => { delete card.spirit; delete card.stamp; return card; });
  state.stock = cards;
  state.discarded = [];
  state.rows = [[], [], []];
  state.effects = {};
  state.revealedEnemy = [];
  state.initialBonusApplied = false;
  transformEnemyJokers(state);
  const candidates = findArrangements(state.enemy);
  // The rival chooses among a small set based only on their own cards.
  const choiceRange = Math.max(1, 9 - Math.floor((state.chapter - 1) / 2));
  state.enemyRows = candidates[Math.floor(random(state) * choiceRange)].rows;
  if (state.relics.includes('blackred')) {
    const normal = state.hand.filter(card => !card.joker);
    const blacks = normal.filter(card => card.suit === 1 || card.suit === 3).length;
    const reds = normal.filter(card => card.suit === 0 || card.suit === 2).length;
    if (blacks === 7 && reds === 2) {
      state.soul += 10; state.stats.earned += 10;
      log(state, '七黑两红：初次发牌获得10魂值。');
    }
  }
  state.initialBonusApplied = true;
  state.phase = 'arrange';
  state.stats.highestSoul = Math.max(state.stats.highestSoul, state.soul);
  log(state, `第${state.chapter}章·第${state.round}回合，九张牌已发下。`);
  return state;
}
export function startHand(state) {
  assertPhase(state, 'intro');
  if (state.completed !== 0) fail('该局已经开始，请继续当前牌局。');
  return deal(copy(state));
}
export function placeCard(state, cardId, rowIndex, slot) {
  assertPhase(state, 'arrange');
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > 2) fail('请选择小、中、大墩。');
  if (!state.hand.some(card => card.id === cardId)) fail('这张牌不在你的手中。');
  const next = copy(state);
  const sourceRow = next.rows.findIndex(row => row.includes(cardId));
  const sourceIndex = sourceRow < 0 ? -1 : next.rows[sourceRow].indexOf(cardId);
  if (sourceRow === rowIndex && slot == null) return next;
  const target = next.rows[rowIndex];
  if (target.length >= 3 && slot == null) fail('这一墩已经有3张牌；点击其中一张牌可以交换。');
  if (slot != null && (!Number.isInteger(slot) || slot < 0 || slot > 2)) fail('无效的牌位。');
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
export function autoArrange(state) {
  assertPhase(state, 'arrange');
  const arrangement = findArrangements(state.hand)[0];
  const next = copy(state); spend(next, CONFIG.autoPrice); next.rows = arrangement.rows;
  log(next, '自动理牌消耗1魂值。'); return next;
}
export function transformJoker(state, cardId, rank, suit) {
  assertPhase(state, 'arrange');
  const next = copy(state);
  const card = next.hand.find(card => card.id === cardId);
  if (!card?.joker) fail('请选择手中的大王或小王。');
  if (card.transformed) fail('这张王本局已选定牌面，不能重复变化。');
  validateFace(rank, suit);
  card.rank = rank; card.suit = suit; card.transformed = true;
  log(next, `${card.joker === 'big' ? '大王' : '小王'}变化为${cardName(card)}。`);
  return next;
}
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
  const replacement = state.stock.shift();
  state.discarded.push(previous);
  state.hand[index] = replacement;
  state.rows = state.rows.map(row => row.map(id => id === previous.id ? replacement.id : id));
}
function redrawNine(state) {
  if (state.stock.length < 9) fail('余牌不足9张，不能重新洗牌。');
  state.discarded.push(...state.hand);
  state.hand = state.stock.splice(0, 9);
  state.rows = [[], [], []];
}
export function replaceCard(state, cardId) {
  assertPhase(state, 'arrange');
  const next = copy(state); replaceOne(next, cardId); spend(next, CONFIG.exchangePrice);
  log(next, '换牌消耗3魂值。'); return next;
}
export function reshuffleHand(state) {
  assertPhase(state, 'arrange');
  const next = copy(state); redrawNine(next); spend(next, CONFIG.reshufflePrice);
  log(next, '洗牌消耗12魂值，重新抽取九张手牌。'); return next;
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
  else if (itemId === 'tide') redrawNine(next);
  else if (itemId === 'tail' || itemId === 'shield') {
    if (next.effects[itemId]) fail('这个效果本局已经生效。');
    next.effects[itemId] = true;
  } else {
    const card = handTarget(next, target);
    if (card.joker) fail('这张符令只能作用于普通牌，大小王请直接选择变化牌面。');
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
        ['twin', playerType === '对子'], ['wind', playerType === '顺子' || playerType === '同花顺'],
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
  if (card.joker) fail('大小王不能附灵或刻印，请选择普通牌。');
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
  if (!record(state) || state.version !== CONFIG.version || !phases.includes(state.phase) || !finite(state.soul) || !integer(state.completed, 0, 36) || !integer(state.rng, 1, 0xffffffff) || typeof state.seed !== 'string') invalid();
  for (const key of ['deck', 'hand', 'enemy', 'rows', 'enemyRows', 'stock', 'discarded', 'inventory', 'relics', 'shop', 'logs', 'revealedEnemy']) if (!Array.isArray(state[key])) invalid();
  const original = new Map(makeDeck().map(card => [card.id, card]));
  const validCard = (card, inDeck = false) => {
    if (!record(card) || typeof card.id !== 'string' || !original.has(card.id)) return false;
    const source = original.get(card.id);
    if (card.joker !== source.joker || (card.spirit !== undefined && card.spirit !== 'saint') || (card.stamp !== undefined && card.stamp !== 'gold')) return false;
    for (const key of ['transformed', 'altered']) if (card[key] !== undefined && typeof card[key] !== 'boolean') return false;
    if (inDeck) return card.rank === source.rank && card.suit === source.suit && !card.transformed && !card.altered && (!card.joker || (!card.spirit && !card.stamp));
    if (card.joker && !card.transformed) return card.rank === 0 && card.suit === -1;
    return integer(card.rank, 2, 14) && integer(card.suit, 0, 3) && (Boolean(card.joker) || !card.transformed);
  };
  if (state.deck.length !== 54 || !state.deck.every(card => validCard(card, true)) || !unique(state.deck.map(card => card.id))) invalid();
  for (const key of ['hand', 'enemy', 'stock', 'discarded']) if (!state[key].every(card => validCard(card))) invalid();
  if (!original.has(state.selectedAltar) || typeof state.initialBonusApplied !== 'boolean') invalid();
  const initial = state.phase === 'intro';
  if (initial) {
    if (state.completed !== 0 || state.chapter !== 1 || state.round !== 1 || state.initialBonusApplied || state.lastResult !== null || state.hand.length || state.enemy.length || state.stock.length || state.discarded.length) invalid();
  } else {
    if (state.hand.length !== 9 || state.enemy.length !== 9 || !state.initialBonusApplied) invalid();
    const dealt = [...state.hand, ...state.enemy, ...state.stock, ...state.discarded].map(card => card.id);
    if (dealt.length !== 54 || !unique(dealt)) invalid();
    const position = state.phase === 'arrange' ? state.completed : state.completed - 1;
    if (!integer(position, 0, 35) || state.chapter !== Math.floor(position / 3) + 1 || state.round !== position % 3 + 1) invalid();
  }
  const validRows = (rows, cards, complete) => Array.isArray(rows) && rows.length === 3 && rows.every(row => strings(row) && row.length <= 3 && (!complete || row.length === 3)) && unique(rows.flat()) && rows.flat().every(id => cards.some(card => card.id === id));
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
      for (const key of ['player', 'enemy']) if (!Array.isArray(lane[key]) || lane[key].length !== 3 || !lane[key].every(card => validCard(card))) invalid();
      if (lane.playerType !== rankHand(lane.player).name || lane.enemyType !== rankHand(lane.enemy).name || lane.outcome !== compareHands(lane.player, lane.enemy)) invalid();
      if (!finite(lane.base) || lane.base <= 0 || !finite(lane.multiplier) || lane.multiplier <= 0 || !finite(lane.delta)) invalid();
    }
    if (!unique(result.lanes.flatMap(lane => [...lane.player, ...lane.enemy]).map(card => card.id))) invalid();
    if (round2(result.lanes.reduce((sum, lane) => sum + lane.delta, 0) + result.bonus) !== result.total || round2(result.soulBefore + result.total) !== result.soulAfter) invalid();
    if (['settlement', 'defeat', 'victory'].includes(state.phase) && state.soul !== result.soulAfter) invalid();
  }
  return state;
}
