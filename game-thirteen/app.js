import * as G from './engine.js';
import { sceneMarkup, emblem } from './scenery.js';
import { ASSETS, ART_PATHS, opponentForChapter } from './assets.js';
import { artImage, mountArt, preloadArt, artStats, retryArt } from './art-loader.js';

const stage = document.querySelector('#stage');
const SAVE_KEY = 'yaopai-thirteen-run-v2';
const OPTIONS_KEY = 'yaopai-thirteen-options-v2';
const ACHIEVEMENTS_KEY = 'yaopai-thirteen-achievements-v2';
const laneNames = ['前墩', '中墩', '后墩'];
const rowSizes = [3, 5, 5];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const signed = value => `${value >= 0 ? '+' : '−'}${number(Math.abs(value))}`;
const itemArt = { mirror: 'eye', flush: 'flower', swap: 'fox', tide: 'wind', rank: 'seal', wild: 'moon', tail: 'seal', shield: 'lantern', blackred: 'moon', twin: 'fox', wind: 'wind', flower: 'flower', tailrelic: 'seal', headrelic: 'coin', single: 'lantern', full: 'flower' };
const achievements = [
  ['first', '初入牌馆', '完成第一局十三张。', 'fox'],
  ['allwin', '三墩皆胜', '在同一局中赢下三墩。', 'flower'],
  ['shop', '有备而来', '在集市买下一件货品。', 'coin'],
  ['spell', '借一缕妖力', '在牌局中使用一张符令。', 'eye'],
  ['altar', '牌中有灵', '为一张牌附灵或刻印。', 'seal'],
  ['chapter', '灯火未熄', '完成第一章的三局牌。', 'lantern'],
  ['clear', '与百妖相会', '带着剩余魂值走完十二章。', 'moon'],
];
function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
const savedOptions = readJSON(OPTIONS_KEY, {});
let options = {
  sound: typeof savedOptions.sound === 'boolean' ? savedOptions.sound : true,
  music: typeof savedOptions.music === 'boolean' ? savedOptions.music : false,
  volume: typeof savedOptions.volume === 'number' && Number.isFinite(savedOptions.volume) ? Math.min(1,Math.max(0,savedOptions.volume)) : 0.3,
  speed: [1,2,4].includes(savedOptions.speed) ? savedOptions.speed : 1,
};
const savedAchievements = readJSON(ACHIEVEMENTS_KEY, {});
let unlocked = Object.fromEntries(achievements.filter(([id]) => typeof savedAchievements[id] === 'number' && Number.isFinite(savedAchievements[id])).map(([id]) => [id,savedAchievements[id]]));
let state = null;
let saveError = '';
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) state = G.hydrate(raw); } catch { saveError = '上次存档无法读取。可以选择新的开始。'; }
const ui = { screen: 'menu', modal: null, selected: [], filter: -1, reveal: -1, revealToken: 0, toast: '', error: false, drag: null, focusReturn: null, handSort: 'rank' };
let toastTimer;
let audioContext;
let musicTimer;
let melodyPosition = 0;

function resize() { document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1440, innerHeight / 810)); }
addEventListener('resize', resize);
resize();

function persist() {
  try { if (state) localStorage.setItem(SAVE_KEY, G.serialize(state)); }
  catch { toast('浏览器未能保存进度，请保持此窗口打开。', true); }
}
function unlock(id) { if (!unlocked[id]) { unlocked[id] = Date.now(); try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked)); } catch {} } }
function saveOptions() { try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(options)); } catch {} }
function announce(message) { document.querySelector('#announcer').textContent = message; }
function toast(message, error = false) {
  clearTimeout(toastTimer);
  ui.toast = message; ui.error = error;
  const previous = stage.querySelector('.toast'); if (previous) previous.remove();
  stage.insertAdjacentHTML('beforeend', `<div class="toast ${error ? 'error' : ''}" role="status">${escape(message)}</div>`);
  announce(message);
  toastTimer = setTimeout(() => { ui.toast = ''; stage.querySelector('.toast')?.remove(); }, 3400);
}
function commit(action, ...args) {
  try { state = action(state, ...args); persist(); render(); return true; }
  catch (error) { toast(error.message, true); return false; }
}
function audioReady() {
  try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume(); }
  catch { return; }
  if (options.music && !musicTimer) startMusic();
}
function tone(frequency, duration = 0.12, gain = 0.15, type = 'sine') {
  if (!audioContext || document.hidden) return;
  const oscillator = audioContext.createOscillator(), volume = audioContext.createGain();
  oscillator.type = type; oscillator.frequency.value = frequency;
  volume.gain.setValueAtTime(Math.max(0.0001, gain * options.volume), audioContext.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(volume); volume.connect(audioContext.destination);
  oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}
function sfx(name = 'click') {
  if (!options.sound) return;
  if (name === 'win') { tone(523, 0.4, 0.2); setTimeout(() => tone(784, 0.5, 0.16), 100); }
  else if (name === 'lose') tone(164, 0.35, 0.1, 'triangle');
  else if (name === 'buy') { tone(880, 0.16, 0.12); setTimeout(() => tone(1174, 0.3, 0.1), 80); }
  else tone(380, 0.07, 0.08, 'triangle');
}
function startMusic() {
  clearInterval(musicTimer); musicTimer = null;
  if (!options.music || !audioContext) return;
  const notes = [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 329.63, 261.63, 196, 220, 293.66];
  musicTimer = setInterval(() => { if (!options.music) return; tone(notes[melodyPosition++ % notes.length], 1.5, 0.055); if (melodyPosition % 4 === 0) tone(130.81, 3, 0.045); }, 1050);
}

function itemArtwork(id) { return ASSETS.items[id] ? artImage(ASSETS.items[id], 'item-art') : emblem(itemArt[id]); }
function cardHTML(card, { hidden = false, action = '', selected = false, extra = '', attrs = '', disabled = false } = {}) {
  if (!card) return '';
  const tag = action ? 'button' : 'div';
  if (hidden) return `<div class="playing-card card-back has-card-back" aria-label="对手的暗牌">${ASSETS.cardBack ? artImage(ASSETS.cardBack, 'card-back-image') : emblem('fox')}</div>`;
  const wild = card.joker && !card.transformed;
  const rank = wild ? (card.joker === 'big' ? '大' : '小') : (G.RANK_NAMES[card.rank] || card.rank);
  const suit = wild ? '王' : G.SUITS[card.suit];
  const label = `${G.cardName(card)}${card.spirit ? '，附灵·圣灵' : ''}${card.stamp ? '，刻印·金印' : ''}${card.altered || card.transformed ? '，本局变化牌面' : ''}`;
  const type = wild ? 'moon' : ['flower', 'fox', 'lantern', 'moon', 'wind', 'seal'][card.rank % 6];
  const face = ASSETS.cardFaces[card.id] || ASSETS.cardFaces[wild ? card.id : card.rank];
  return `<${tag} class="playing-card has-card-art ${card.suit === 0 || card.suit === 2 ? 'red' : 'black'} ${wild ? 'joker-card' : ''} ${selected ? 'selected' : ''} ${extra}" ${action ? `type="button" data-action="${action}"` : ''} data-card-id="${card.id}" aria-label="${escape(label)}" title="${escape(label)}" ${disabled ? 'disabled' : ''} ${attrs}>
    ${artImage(ASSETS.cardFrame, 'card-frame-image')}<span class="card-rank">${rank}<span class="card-suit">${suit}</span></span><span class="card-art">${face ? artImage(face, 'card-face-image') : emblem(type)}</span><span class="card-corner">${rank}<small>${suit}</small></span>
    ${wild ? '<span class="joker-prompt">点击变化</span>' : ''}<span class="card-mods">${card.spirit ? '<i>灵</i>' : ''}${card.stamp ? '<i>印</i>' : ''}${card.altered || card.transformed ? '<i>幻</i>' : ''}</span></${tag}>`;
}
function button(text, action, className = 'secondary', attrs = '') { return `<button class="${className}" data-action="${action}" ${attrs}>${text}</button>`; }
function header() {
  let soul = state.soul;
  if (ui.reveal >= 0 && state.lastResult) soul = state.lastResult.soulBefore + state.lastResult.lanes.slice(0, ui.reveal).reduce((sum, lane) => sum + lane.delta, 0);
  return `<header class="game-header"><div class="brand"><span class="seal">妖</span><div class="wordmark"><h1>百妖牌馆 <span class="mode-badge">十三张</span></h1><small>第 ${state.chapter} 章 · 第 ${state.round} 回合 · ${opponentForChapter(state.chapter).name}</small></div></div></header>
    <div class="soul-meter" aria-label="剩余${number(soul)}魂值"><span class="soul-number">${number(soul)}</span><small>魂值</small></div>`;
}
function sideTools() { return `<nav class="side-tools" aria-label="游戏工具">${[['settings','⚙','设置'],['rules','卷','规则'],['tutorial','学','教学'],['deck','册','牌库'],['progress','途','行程']].map(([action, icon, title]) => button(`<span>${icon}</span>${title}`, action, 'tool-button')).join('')}</nav>`; }
function bagBar() { return `<div class="bag-bar">${button(`<span>符</span>符令 <b>${state.inventory.length}/10</b>`, 'inventory', 'bag-button')}${button(`<span>珍</span>奇珍 <b>${state.relics.length}/12</b>`, 'relics', 'bag-button')}</div>`; }
function progress() { return `<div class="progress-track" aria-label="已通关${Math.floor(state.completed / 3)}章">${Array.from({length:12}, (_,i) => `<i class="${i < Math.floor(state.completed / 3) ? 'done' : i === state.chapter - 1 ? 'current' : ''}"></i>`).join('')}<span>已通关 ${Math.floor(state.completed / 3)}/12</span></div>`; }
function menu() {
  return `<div class="menu-panel"><div class="eyebrow">一 间 只 在 入 夜 后 开 门 的 牌 馆</div><h1 class="menu-title">百妖牌馆</h1><div class="menu-subtitle">十三张 · 三墩较量</div><div class="menu-actions">
    ${button('<span>✧</span>新的开始','new-game')}${button('<span>◈</span>继续游戏','continue-save','secondary',!state ? 'disabled' : '')}${button('<span>⚙</span>设置','settings')}${button('<span>学</span>玩法教学','tutorial')}${button('<span>♜</span>成就解锁','achievements')}
    </div></div><div class="menu-footer">与百妖相会，<br>一局定乾坤。<small>十三水 · 前三中五后五</small></div><span class="menu-version"><a class="switch-version" href="${['127.0.0.1','localhost'].includes(location.hostname) ? 'http://127.0.0.1:5173/' : '../game/'}" target="_blank" rel="noopener">打开保留的比鸡版 ↗</a>十三张 · 山海美术版 0.3</span>`;
}
function intro() {
  return `<section class="intro-panel"><div class="intro-kicker">十三张 · 三墩较量</div><h2>前墩三张，中后各五张。</h2><p>把手中十三张，摆成三组好牌。<br><strong>前墩 ≤ 中墩 ≤ 后墩</strong>，然后逐墩比大小。</p><p>五张能组成两对、顺子、同花、葫芦……<br>前墩只有三张，只认散牌、对子和三条。</p><div class="intro-actions">${button('先学怎么摆','tutorial','primary')}${button('入席开局','start')}</div><small>100 魂值入馆 · 不限思考时间 · 可看摆牌参考</small></section>`;
}
function table() {
  const arranging = state.phase === 'arrange';
  const done = !arranging && ui.reveal < 0;
  const valid = G.validateRows(state);
  const placed = new Set(state.rows.flat());
  const available = state.hand.filter(card => !placed.has(card.id)).sort((a,b) => ui.handSort === 'suit' ? b.suit-a.suit || b.rank-a.rank : b.rank-a.rank || b.suit-a.suit);
  const hints = ui.selected.length ? `已选 ${ui.selected.length} 张 · 点击前／中／后墩放入${ui.selected.length === 1 ? '，或点另一张已摆好的牌交换' : ''}` : available.length ? '前墩放 3 张，中、后墩各放 5 张 · 可多选后放入，也可拖动单张' : valid.message;
  const dialogue = arranging ? ['十三张在手，慢慢摆，不限时。', '好牌放哪一墩，比拿到好牌更要紧。', '前墩三张，中后五张，别倒了墩。'][state.round-1] : done ? (state.lastResult.total >= 0 ? '这一手，有几分意思。' : '输赢已定，下一局再见。') : '前、中、后，依次见分晓。';
  return `${header()}${sideTools()}<div class="host-dialogue">${opponentForChapter(state.chapter).name} · ${dialogue}</div>
    <div class="table-content"><div class="table-side-label"><span>你的三墩 · 3 / 5 / 5</span><span>对方三墩 · 3 / 5 / 5</span></div>${state.rows.map((ids, index) => {
      const lane = state.lastResult?.lanes[index];
      const revealed = !arranging && (done || index < ui.reveal);
      const playerCards = ids.map(id => state.hand.find(card => card.id === id));
      const type = playerCards.length === rowSizes[index] ? G.rankHand(playerCards).name : `待组牌 ${playerCards.length}/${rowSizes[index]}`;
      return `<div class="lane ${revealed ? (lane.outcome > 0 ? 'lane-won' : lane.outcome < 0 ? 'lane-lost' : '') : ''}" data-row="${index}">
        ${button(`<span>${['前','中','后'][index]}</span>`,'place','lane-marker',`data-row="${index}" ${!arranging ? 'disabled' : ''} aria-label="放入${laneNames[index]}，${rowSizes[index]}张"`)}<span class="lane-progress">${ids.length}/${rowSizes[index]}</span>
        <div class="player-cards" data-drop-row="${index}">${Array.from({length:rowSizes[index]}, (_,slot) => playerCards[slot] ? cardHTML(playerCards[slot], { action: arranging ? 'hand-card' : '', selected: ui.selected.includes(playerCards[slot].id), attrs: `data-row="${index}" data-slot="${slot}" ${arranging ? 'draggable="true"' : ''}`, extra: revealed ? (lane.outcome > 0 ? 'won' : lane.outcome < 0 ? 'lost' : '') : '' }) : button('+','place','playing-card empty-slot',`data-row="${index}" data-slot="${slot}" aria-label="放入${laneNames[index]}第${slot+1}张牌" ${!arranging ? 'disabled' : ''}`)).join('')}<span class="lane-type">${escape(type)}${index === 0 && arranging ? ' · 只认散牌 / 对子 / 三条' : ''}</span></div>
        <div class="versus ${revealed ? (lane.delta >= 0 ? 'positive' : 'negative') : ''}">${revealed ? signed(lane.delta) : '对'}<small>${revealed ? '魂值' : '局'}</small></div>
        <div class="enemy-cards">${state.enemyRows[index].map(id => { const card = state.enemy.find(c => c.id === id); return cardHTML(card, { hidden: !revealed && !(arranging && state.revealedEnemy.includes(id)), extra: revealed && ui.reveal >= 0 && index === ui.reveal - 1 ? 'flipped' : '' }); }).join('')}<span class="lane-type">${revealed ? lane.enemyType : '待揭晓'}</span></div></div>`;
    }).join('')}</div>
    ${arranging ? `<div class="hand-tools">${button('按点数排','sort-rank','text-button')}${button('按花色排','sort-suit','text-button')}${ui.selected.length ? button('收回所选','return-selected','text-button')+button('取消选牌','deselect','text-button') : '<span class="muted">前墩 ≤ 中墩 ≤ 后墩</span>'}</div><div class="hand-tray" aria-label="未摆放的手牌" data-drop-hand="true">${available.map(card => cardHTML(card, {action:'hand-card', selected:ui.selected.includes(card.id), attrs:'draggable="true"'})).join('')}</div><div class="board-hint ${!available.length && !valid.ok ? 'negative' : ''}">${escape(hints)}</div>` : ''}
    ${bagBar()}${progress()}<div class="action-area">${arranging ? `${button('结束出牌<small>前 3 · 中 5 · 后 5</small>','resolve','primary',!valid.ok ? 'disabled' : '')}${button('摆牌参考','suggestions')}${button('自动理牌 · −1','auto','secondary',state.soul < 2 ? 'disabled' : '')}${available.length < 13 ? button('收回重排','clear') : ''}<small>${state.effects.tail ? '断尾契 · 后墩输赢翻倍' : state.effects.shield ? '护身纸已生效' : '不计时 · 想好了再开牌'}</small>` : ui.reveal >= 0 ? button('跳过动画','skip-reveal') : button(state.soul <= 0 ? '此局已终' : state.completed >= 36 ? '百妖相送' : '前往集市','market','primary') }</div>
    ${ui.reveal >= 0 ? `<div class="reveal-note">${ui.reveal === 0 ? '即将开牌' : `正在结算${laneNames[Math.min(ui.reveal - 1,2)]}`}</div>` : done ? `<div class="settlement-banner" data-outcome="${resultOutcome()}">${artImage(ASSETS.results[resultOutcome()],'result-banner-art')}<span>第 ${state.completed} 局</span><strong class="${state.lastResult.total >= 0 ? 'positive' : 'negative'}">${signed(state.lastResult.total)}</strong><small>魂值</small>${button('结算明细','result','text-button')}</div>` : ''}`;
}
function shop() {
  const target = state.deck.find(card => card.id === state.selectedAltar) || state.deck[0];
  return `${header()}<div class="market-overlay"><div class="market-status">魂值 <strong>${number(state.soul)}</strong> · 已完成 ${state.completed}/36 局 · 第 ${state.completed} 局结算 <span class="${state.lastResult.total >= 0 ? 'positive' : 'negative'}">${signed(state.lastResult.total)} 魂值</span></div>
    <div class="market-panels"><section class="shop-panel has-panel-art">${artImage(ASSETS.shopPanel,'panel-art')}<div class="panel-roof"><h2>商店</h2><small>新货上架 · 以魂易物</small></div><div class="stock-grid">${state.shop.map((offer,index) => { const item = G.ITEM_MAP[offer.itemId]; return `<button class="stock-item ${offer.sold ? 'sold' : ''}" data-action="buy" data-index="${index}" data-tooltip="${item.id}" aria-label="${item.name}，${item.price}魂值。${escape(item.description)}" ${offer.sold ? 'disabled' : ''}><span class="item-illustration">${itemArtwork(item.id)}</span><span class="item-tag">${item.kind === 'spell' ? '符令' : '奇珍'}</span><span class="item-title">${item.name}</span><span class="item-price">${offer.sold ? '售罄' : item.price}</span></button>`; }).join('')}</div>${button('刷新商店 <small>◉ 6</small>','refresh','shop-refresh',state.soul < 7 ? 'disabled' : '')}</section>
    <section class="altar-panel has-panel-art">${artImage(ASSETS.altarPanel,'panel-art')}<div class="panel-roof"><h2>祭坛</h2><small>一纸为契 · 万物有灵</small></div><div class="altar-card-area">${cardHTML(target,{action:'altar-picker'})}${button(`目标：${G.cardName(target)} · 点击更换`,'altar-picker','altar-target')}<small>${target.spirit ? '圣灵 ×2' : '未附灵'}　${target.stamp ? '金印 ×1.5' : '未刻印'}</small></div><p class="altar-subtitle">选择一项神灵的祈福</p><div class="altar-options">
      <div class="altar-option"><span class="altar-icon">${emblem('fox')}</span><p>消耗 10 魂值<br>为此牌赋予附灵</p>${button('附灵','altar-spirit','',target.spirit || target.joker || state.soul < 11 ? 'disabled' : '')}</div>
      <div class="altar-option"><span class="altar-icon">${emblem('lantern')}</span><p>消耗 14 魂值<br>为此牌赋予刻印</p>${button('刻印','altar-stamp','',target.stamp || target.joker || state.soul < 15 ? 'disabled' : '')}</div>
      <div class="altar-option"><span class="altar-icon">${emblem('seal')}</span><p>清除目标牌改造<br>换取一张符令</p>${button('祭拜','altar-sacrifice','',!target.spirit && !target.stamp || target.joker || state.inventory.length >= 10 ? 'disabled' : '')}</div>
    </div></section></div><div class="market-footer">${button('继续下一局','next','primary')}<small>交易后需保留至少 1 魂值</small></div>
    <div class="market-tools">${button(`符令 ${state.inventory.length}/10`,'inventory')}${button(`奇珍 ${state.relics.length}/12`,'relics')}${button('设置','settings')}</div></div>`;
}
function ending() {
  const won = state.phase === 'victory';
  return `<section class="ending-panel"><div class="ending-symbol"><span>${won ? '归' : '终'}</span></div><h1>${won ? '恭喜通关' : '此局已终'}</h1><p>${won ? '三十六局，灯火未熄。<br>今夜，百妖为你让席。' : '浮生如牌，聚散无常。<br>等你准备好了再来。'}</p><div class="ending-stats"><div><strong>${state.completed}</strong>完成牌局</div><div><strong>${state.stats.wins}</strong>获胜牌局</div><div><strong>${number(Math.max(0,state.soul))}</strong>剩余魂值</div></div>${button('再来一局','new-game','primary')}${button('返回主菜单','menu')}</section>`;
}

function openModal(type, detail = {}) {
  ui.focusReturn = document.activeElement?.dataset?.action;
  ui.modal = { type, ...detail }; ui.filter = -1; render();
  stage.querySelector('.modal .close')?.focus({preventScroll:true});
}
function closeModal() { ui.modal = null; render(); stage.querySelector(`[data-action="${ui.focusReturn || 'settings'}"]`)?.focus({preventScroll:true}); }
function rulesContent() {
  return `<p>一副52张牌，不含大小王。双方各拿13张，分成<strong>前墩3张、中墩5张、后墩5张</strong>，每张牌只使用一次。前墩不能强于中墩，中墩不能强于后墩，摆反称为“倒墩”。</p><div class="rules-order">五张牌：同花顺 ＞ 四条 ＞ 葫芦 ＞ 同花 ＞ 顺子 ＞ 三条 ＞ 两对 ＞ 对子 ＞ 散牌</div><p class="tutorial-front-notice"><strong>前墩只有三张：只认三条、对子、散牌。</strong>三张同花、三张连号都按散牌比较。</p><div class="rules-grid">
    <div class="rule"><h3>怎样摆牌</h3><p>选3张放前墩，选5张放中墩或后墩。也能逐张放入、拖动或交换。按点数／花色整理手牌不收费。摆牌参考展示不同分法，采用或自动理牌每次花1魂值。</p></div>
    <div class="rule"><h3>怎样比较</h3><p>先比牌型，再比组成牌型的点数，然后逐张比余牌。两对先比大对，再比小对和单张；葫芦先比三条，再比对子。花色不分高低，相同点数组合平局。</p></div>
    <div class="rule"><h3>A在顺子中</h3><p>A2345是最小的五张顺子，10JQKA最大。A只能放在这两端，QKA23不算顺子。</p><div class="rule-example">A2345 ＜ 23456 ＜ … ＜ 10JQKA</div></div>
    <div class="rule"><h3>前墩如何和中墩比</h3><p>先比牌型，再比共同的关键点数。例如前墩三条大于中墩两对，属于倒墩。散牌比前三张点数；对子比对子与最大单张；共同点数完全相同允许摆放。</p></div>
    <div class="rule"><h3>本版的闯关计分</h3><p>前对前、中对中、后对后，基础每赢一墩+3魂值，输一墩−3，平局0。暂不加入地方玩法的打枪、特殊牌自动获胜或额外番数。符令与奇珍可改变收益。</p></div>
    <div class="rule"><h3>牌馆与功能牌</h3><p>十二章、每章三局，每局后可逛商店和祭坛。符令在开牌前使用；奇珍持续生效。功能牌是闯关扩展，变牌后仍需满足3/5/5与强弱约束。</p></div></div><p class="rules-note">思考不限时，倒墩会提示原因并阻止开牌。附灵·圣灵×2、金印×1.5放大所在墩的基础输赢。魂值用于消费与生存，消费后至少留下1。</p>`;
}
function tutorialContent(step = 0) {
  const card = (rank,suit) => ({id:`lesson-${rank}-${suit}`,rank,suit});
  const rows = step === 0 ? [[card(12,1),card(12,0),card(2,2)],[card(3,1),card(4,0),card(5,2),card(6,3),card(7,1)],[card(13,1),card(13,0),card(13,2),card(9,3),card(9,0)]] : step === 1 ? [[card(14,3),card(13,3),card(12,3)],[card(9,1),card(9,0),card(5,1),card(5,0),card(2,2)],[card(13,1),card(13,0),card(13,2),card(7,1),card(7,0)]] : [[card(9,3),card(9,1),card(9,2)],[card(13,3),card(13,1),card(12,3),card(12,1),card(2,0)],[card(14,1),card(14,2),card(14,0),card(7,1),card(7,2)]];
  const explanations = ['这13张牌分成对子、顺子、葫芦。三墩由弱到强，就能开牌。','注意前墩：虽然是三张黑桃、点数也相连，在十三张里仍是散牌。中墩的两对、后墩的葫芦则按五张牌计算。','这一手前墩是三条，中墩却只有两对。先判断：能直接开牌吗？'];
  return `<div class="tutorial-steps">${['先分3／5／5','认识牌型','避免倒墩'].map((label,i)=>`<span class="${i===step?'active':''}">${i+1} · ${label}</span>`).join('')}</div><p>${explanations[step]}</p><div class="tutorial-example">${rows.map((row,i)=>`<div class="tutorial-row"><strong>${laneNames[i]} · ${row.length}张<br><small>${G.rankHand(row).name}</small></strong><div class="tutorial-cards">${row.map(c=>cardHTML(c)).join('')}</div></div>`).join('')}</div>${step === 2 ? `<div class="confirm-buttons">${button('可以开牌','tutorial-answer','secondary','data-answer="yes"')}${button('不能，前墩比中墩强','tutorial-answer','secondary','data-answer="no"')}</div>${ui.modal.answer ? `<p class="inline-note">${ui.modal.answer === 'no' ? '判断正确。' : '还不能开牌。'}三条强于两对，需要重新分配，确保前墩不强于中墩。</p>` : ''}` : ''}<div class="modal-footer">${step > 0 ? button('上一步','tutorial-prev') : ''}${step < 2 ? button('下一步','tutorial-next','primary') : button(state?.phase === 'intro' && ui.screen !== 'menu' ? '入席开局' : '我明白了','tutorial-done','primary')}</div>`;
}
function suggestionContent() {
  return `<p>三种分法只参考你自己的牌。比较三墩的取舍，再决定是否采用；<strong>它们不保证赢牌</strong>，也未计算所有奇珍收益。</p><div class="suggestion-grid">${ui.modal.suggestions.map(item => `<article class="suggestion-option"><h3>${escape(item.label)}</h3><p>${item.style === 'front' ? '尽量保住前墩的强度' : item.style === 'back' ? '更多好牌留给后墩' : '兼顾三墩的牌型与点数'}</p><div class="suggestion-types">${item.rows.map((row,i)=>`<div><b>${laneNames[i]} · ${escape(item.types[i])}</b><small>${row.map(id=>G.cardName(state.hand.find(c=>c.id===id))).join('　')}</small></div>`).join('')}</div>${button('采用方案 · −1魂值','adopt-suggestion','secondary',`data-style="${item.style}" ${state.soul<2?'disabled':''}`)}</article>`).join('')}</div><p class="rules-note">查看不收费。采用后仍可手动调整，调整不收费。</p>`;
}
function resultContent() {
  const result = state.lastResult;
  if (!result) return '<p>完成一局之后，可在这里查看结算。</p>';
  return `<div class="result-art-heading">${artImage(ASSETS.results[resultOutcome()], 'result-banner-art')}<strong>${result.total > 0 ? '此局获胜' : result.total < 0 ? '此局惜败' : '平分秋色'}</strong></div><div class="result-lanes">${result.lanes.map(lane => `<div class="result-item"><h3>${laneNames[lane.index]}</h3><div><p>你：${lane.player.map(G.cardName).join(' ')}（${escape(lane.playerType)}）</p><p>对手：${lane.enemy.map(G.cardName).join(' ')}（${escape(lane.enemyType)}）</p><p>基础 ${lane.outcome < 0 ? '−' : lane.outcome > 0 ? '+' : ''}${lane.outcome === 0 ? 0 : lane.base} × ${lane.multiplier}${lane.notes.length ? ' · ' + lane.notes.map(escape).join(' · ') : ''}</p></div><strong class="${lane.delta >= 0 ? 'positive' : 'negative'}">${signed(lane.delta)}</strong></div>`).join('')}</div>${result.bonus ? `<p class="inline-note">整局奖励：${result.bonusNotes.map(escape).join(' · ')}</p>` : ''}<div class="result-total"><span>${number(result.soulBefore)} → ${number(result.soulAfter)} 魂值</span><strong>${signed(result.total)}</strong></div>`;
}
function targetCards(item) { return state.hand.filter(card => item.target === 'card' || !card.joker); }
function modalContent() {
  const m = ui.modal;
  if (!m) return '';
  let title = '', body = '', size = '';
  if (m.type === 'rules') { title = '十三张 · 牌馆规矩'; body = rulesContent(); }
  else if (m.type === 'tutorial') { title = '认识十三张'; body = tutorialContent(m.step || 0); }
  else if (m.type === 'suggestions') { title = '摆牌参考'; size = 'wide'; body = suggestionContent(); }
  else if (m.type === 'settings') {
    title = '设置'; size = 'compact';
    body = `<div class="settings-row"><label for="sound-toggle">牌桌音效</label><button id="sound-toggle" data-action="sound-toggle" aria-pressed="${options.sound}">${options.sound ? '开启' : '关闭'}</button></div><div class="settings-row"><label for="music-toggle">牌馆音乐</label><button id="music-toggle" data-action="music-toggle" aria-pressed="${options.music}">${options.music ? '开启' : '关闭'}</button></div><div class="settings-row"><label for="volume">音量</label><input id="volume" type="range" min="0" max="1" step="0.05" value="${options.volume}"></div><div class="settings-row"><label for="speed">翻牌速度</label><select id="speed"><option value="1" ${options.speed === 1 ? 'selected' : ''}>从容 · 标准</option><option value="2" ${options.speed === 2 ? 'selected' : ''}>利落 · 两倍</option><option value="4" ${options.speed === 4 ? 'selected' : ''}>疾风 · 四倍</option></select></div><p class="settings-hint">进度会自动保存在当前浏览器。关闭窗口后可从主菜单继续。</p>${ui.screen !== 'menu' ? button('保存并返回主菜单','menu','secondary') : ''}${button('继续','close-modal','primary')}`;
  } else if (m.type === 'achievements') {
    title = '成就解锁'; body = `<div class="achievement-list">${achievements.map(([id,name,description,icon]) => `<div class="achievement ${unlocked[id] ? '' : 'locked'}">${emblem(icon)}<div><h3>${name} ${unlocked[id] ? '· 已解锁' : ''}</h3><p>${description}</p></div></div>`).join('')}</div>`;
  } else if (m.type === 'confirm-new') {
    title = '开始新的旅程'; size = 'compact'; body = `<p>新的开始会覆盖十三张的当前存档。比鸡版进度和已解锁成就都会保留。</p><div class="confirm-buttons">${button('保留当前进度','close-modal')}${button('重新入馆','confirm-new','primary')}</div>`;
  } else if (m.type === 'inventory' || m.type === 'relics') {
    const spells = m.type === 'inventory'; title = spells ? `背包 · 未使用符令 ${state.inventory.length}` : `奇珍 · ${state.relics.length}/12`;
    const list = spells ? state.inventory : state.relics;
    body = list.length ? `<div class="inventory-grid">${list.map((id,index) => { const item = G.ITEM_MAP[id]; return `<article class="inventory-item">${itemArtwork(id)}<h3>${item.name}</h3><p>${item.description}</p>${spells ? button(state.phase === 'arrange' ? '使用' : '开局后使用','use-item','secondary',`data-id="${id}" data-index="${index}" ${state.phase !== 'arrange' ? 'disabled' : ''}`) : '<span class="muted">本趟旅程持续生效</span>'}</article>`; }).join('')}</div>` : `<div class="inventory-empty">${spells ? '暂无未使用的符令。<br>一局之后，可在集市购买。' : '尚未收集奇珍。<br>每件奇珍，都有它的妙用。'}</div>`;
  } else if (m.type === 'deck' || m.type === 'altar-picker') {
    title = m.type === 'deck' ? '牌库 · 五十二张' : '选择祭坛目标'; size = 'wide';
    body = `<p>${m.type === 'deck' ? '附灵和刻印随实体牌留在本趟旅程中。' : '选一张普通牌。附灵与刻印将保留到之后的牌局。'}</p><div class="card-library">${state.deck.filter(card => m.type === 'deck' || !card.joker).map(card => cardHTML(card,{action:m.type === 'altar-picker' ? 'altar-target' : '',selected:card.id === state.selectedAltar})).join('')}</div>`;
  } else if (m.type === 'progress') {
    title = '十二章 · 三十六局'; body = `<p>已完成 ${state.completed} 局，当前第 ${state.chapter} 章、第 ${state.round} 回合。</p><div class="chapter-steps">${Array.from({length:12},(_,i) => `<div class="chapter-step ${i < Math.floor(state.completed / 3) ? 'done' : i === state.chapter-1 ? 'current' : ''}">第 ${i+1} 章<br><span class="chapter-opponent">${opponentForChapter(i+1).name}</span><br><small>${i < Math.floor(state.completed / 3) ? '已通过' : i === state.chapter-1 ? '当前' : '未抵达'}</small></div>`).join('')}</div><div class="inline-note">${state.logs.slice(-5).map(log => `<div>${escape(log)}</div>`).join('')}</div>`;
  } else if (m.type === 'result') { title = '逐墩结算'; body = resultContent(); }
  else if (m.type === 'face') {
    title = `${G.ITEM_MAP[m.itemId].name} · 选择变化牌面`; size = 'wide';
    body = `<p>点击一张牌完成变化，本局有效。</p><div class="joker-filters">${button('全部','filter',ui.filter === -1 ? 'active' : '', 'data-suit="-1"')}${G.SUITS.map((suit,index) => `<button data-action="filter" data-suit="${index}" class="${ui.filter === index ? 'active' : ''}">${suit} ${['方块','梅花','红桃','黑桃'][index]}</button>`).join('')}</div><div class="joker-grid">${G.makeDeck().filter(card => !card.joker && (ui.filter === -1 || card.suit === ui.filter)).map(card => cardHTML(card,{action:'choose-face',attrs:`data-rank="${card.rank}" data-suit="${card.suit}"`})).join('')}</div>`;
  } else if (m.type === 'spell-target') {
    const item = G.ITEM_MAP[m.itemId]; title = `${item.name} · 选择目标`; size = 'wide';
    body = `<p>${item.description}</p><div class="card-library">${targetCards(item).map(card => cardHTML(card,{action:'spell-card'})).join('')}</div>`;
  } else if (m.type === 'spell-choice') {
    const item = G.ITEM_MAP[m.itemId], card = state.hand.find(c => c.id === m.cardId);
    title = `${item.name} · ${G.cardName(card)}`; size = 'compact';
    body = `<p>${item.description}</p><div class="choice-grid">${item.target === 'suit' ? G.SUITS.map((suit,i) => button(`${suit} ${['方块','梅花','红桃','黑桃'][i]}`,'spell-value','',`data-suit="${i}" ${card.suit === i ? 'disabled' : ''}`)).join('') : [card.rank-1,card.rank+1].filter(rank => rank >= 2 && rank <= 14).map(rank => button(`变为 ${G.RANK_NAMES[rank] || rank}`,'spell-value','',`data-rank="${rank}"`)).join('')}</div>`;
  }
  return `<div class="modal-backdrop"><section class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${title}</h2>${button('×','close-modal','close','aria-label="返回牌桌"')}</header><div class="modal-body">${body}</div></section></div>`;
}

function resultOutcome() { return state?.lastResult?.total > 0 ? 'win' : state?.lastResult?.total < 0 ? 'lose' : 'draw'; }
function hostExpression(screen, opponent) {
  if (screen !== 'table') return 'neutral';
  if (state.phase === 'arrange') return ui.selected.length && opponent.sprites.thinking ? 'thinking' : 'neutral';
  if (ui.reveal === 0) return opponent.sprites.thinking ? 'thinking' : 'neutral';
  const total = ui.reveal > 0 ? state.lastResult.lanes.slice(0, ui.reveal).reduce((sum,lane)=>sum+lane.delta,0) : state.lastResult?.total || 0;
  // Expressions describe the opponent's outcome, which is the reverse of ours.
  if (total > 0) return ui.reveal > 0 && opponent.sprites.surprised ? 'surprised' : 'losing';
  if (total < 0) return 'winning';
  return 'neutral';
}
function updateArtLoading() {
  const status = artStats();
  let panel = stage.querySelector('.art-loading');
  if (status.total && status.loaded === status.total) { panel?.remove(); return; }
  if (!panel) { stage.insertAdjacentHTML('beforeend','<aside class="art-loading" role="status" aria-live="polite"></aside>'); panel = stage.querySelector('.art-loading'); }
  panel.dataset.status = status.failed ? 'failed' : 'loading';
  panel.innerHTML = `<span class="art-loading-message">${status.failed ? `有 ${status.failed} 张画面暂未载入` : '正在点亮山海牌馆'} · ${status.loaded}/${status.total}</span>${status.failed ? '<button data-action="retry-art">重新加载</button>' : ''}`;
}
function showArtEffect(kind) {
  if (!ASSETS.effects[kind]) return;
  stage.querySelector('.art-effect')?.remove();
  const target = document.createElement('div');
  target.className = `art-effect art-effect-${kind}`;
  target.dataset.effect = kind;
  target.setAttribute('aria-hidden','true');
  target.innerHTML = artImage(ASSETS.effects[kind], 'effect-art');
  stage.append(target); mountArt(target);
  target.addEventListener('animationend',()=>target.remove(),{once:true});
  setTimeout(()=>target.remove(),1400 / options.speed);
}
window.addEventListener('art-progress',updateArtLoading);

function render() {
  const focus = document.activeElement?.dataset;
  let screen = ui.screen === 'menu' ? 'menu' : state?.phase === 'intro' ? 'intro' : state?.phase === 'shop' ? 'shop' : ['defeat','victory'].includes(state?.phase) ? 'ending' : 'table';
  const opponent = opponentForChapter(screen === 'menu' || screen === 'intro' ? 1 : state?.chapter);
  const expression = hostExpression(screen, opponent);
  stage.className = `screen-${screen} art-theme`;
  stage.dataset.phase = ui.screen === 'menu' ? 'menu' : state.phase;
  stage.dataset.opponent = opponent.id;
  stage.dataset.expression = expression;
  stage.innerHTML = sceneMarkup({screen, chapter:state?.chapter, expression, ending:screen === 'ending' ? state.phase : null}) + ({menu, intro, shop, ending, table}[screen])() + modalContent() + (ui.toast ? `<div class="toast ${ui.error ? 'error' : ''}" role="status">${escape(ui.toast)}</div>` : '');
  mountArt(stage);
  updateArtLoading();
  if (focus?.action && ui.modal) stage.querySelector(`.modal [data-action="${focus.action}"]`)?.focus({preventScroll:true});
}
function newRun() {
  state = G.newGame(Date.now()); ui.screen = 'game'; ui.modal = null; ui.selected = []; ui.reveal = -1; ui.revealToken++; persist(); render();
}
function startReveal() {
  if (!commit(G.resolveHand)) return;
  unlock('first'); if (state.lastResult.lanes.every(l => l.outcome > 0)) unlock('allwin'); if (state.completed >= 3) unlock('chapter');
  ui.selected = []; ui.reveal = 0; const token = ++ui.revealToken; render();
  const tick = () => {
    if (token !== ui.revealToken) return;
    if (ui.reveal < 3) { const lane = state.lastResult.lanes[ui.reveal]; ui.reveal++; sfx(lane.delta > 0 ? 'win' : 'lose'); announce(`${laneNames[lane.index]}，${lane.playerType}对${lane.enemyType}，${signed(lane.delta)}魂值。`); render(); showArtEffect('reveal'); setTimeout(tick, 1050 / options.speed); }
    else { ui.reveal = -1; render(); announce(`本局结束，共${signed(state.lastResult.total)}魂值。`); }
  };
  setTimeout(tick, 450 / options.speed);
}
function selectCard(id, row, slot) {
  if (state.phase !== 'arrange') return;
  if (ui.selected.length === 1 && !ui.selected.includes(id) && Number.isInteger(row)) {
    const previous = ui.selected[0]; ui.selected = []; commit(G.placeCard, previous, row, slot); return;
  }
  if (ui.selected.includes(id)) ui.selected = ui.selected.filter(c => c !== id);
  else if (ui.selected.length < 5) ui.selected.push(id);
  else { toast('最多选5张。前墩放3张，中后墩各放5张。'); return; }
  render();
}
function placeSelected(row, slot) {
  if (!ui.selected.length) { toast(`先选手牌再放入${laneNames[row]}，这里需要${rowSizes[row]}张。`); return; }
  if (ui.selected.length > rowSizes[row]) { toast(`${laneNames[row]}只能放${rowSizes[row]}张，当前选了${ui.selected.length}张。`,true); return; }
  try {
    let next = state;
    if (ui.selected.length === 1) next = G.placeCard(next, ui.selected[0], row, slot);
    else {
      const chosen = [...ui.selected];
      const incoming = chosen.filter(id => !next.rows[row].includes(id));
      const remaining = rowSizes[row] - next.rows[row].length;
      if (incoming.length > remaining) {
        toast(`${laneNames[row]}还可放${remaining}张，所选中有${incoming.length}张需要放入。请减少选牌，或先收回这一墩的牌。`,true);
        return;
      }
      for (const id of incoming) next = G.placeCard(next, id, row);
    }
    state = next; ui.selected = []; persist(); render(); sfx();
  } catch (error) { toast(error.message, true); }
}
function applySpell(id, target = {}) {
  if (commit(G.useItem,id,target)) { ui.modal = null; ui.selected = []; unlock('spell'); render(); showArtEffect('talisman'); sfx('buy'); toast(`${G.ITEM_MAP[id].name}已生效。`); }
}
function action(name, element) {
  const data = element.dataset;
  switch (name) {
    case 'retry-art': retryArt(); break;
    case 'new-game': if (state && !['defeat','victory'].includes(state.phase)) openModal('confirm-new'); else newRun(); break;
    case 'confirm-new': newRun(); break;
    case 'continue-save': if (state) { ui.screen = 'game'; ui.reveal = -1; ui.modal = null; render(); } break;
    case 'start': ui.modal = null; commit(G.startHand); break;
    case 'tutorial': openModal('tutorial',{step:0}); break;
    case 'tutorial-next': ui.modal.step++; ui.modal.answer = null; render(); break;
    case 'tutorial-prev': ui.modal.step--; ui.modal.answer = null; render(); break;
    case 'tutorial-answer': ui.modal.answer = data.answer; render(); break;
    case 'tutorial-done': if (state?.phase === 'intro' && ui.screen !== 'menu') { ui.modal = null; commit(G.startHand); } else closeModal(); break;
    case 'suggestions': openModal('suggestions',{suggestions:G.getSuggestions(state.hand)}); break;
    case 'adopt-suggestion': ui.selected=[]; if (commit(G.autoArrange,data.style)) closeModal(); break;
    case 'sort-rank': ui.handSort='rank'; render(); break;
    case 'sort-suit': ui.handSort='suit'; render(); break;
    case 'return-selected': { let next=state; for(const id of ui.selected) next=G.returnToHand(next,id); state=next; ui.selected=[]; persist(); render(); break; }
    case 'menu': persist(); ui.screen = 'menu'; ui.modal = null; ui.selected = []; ui.reveal = -1; ui.revealToken++; render(); break;
    case 'settings': case 'rules': case 'achievements': case 'inventory': case 'relics': case 'progress': case 'deck': case 'result': case 'altar-picker': openModal(name); break;
    case 'close-modal': closeModal(); break;
    case 'sound-toggle': options.sound = !options.sound; saveOptions(); render(); break;
    case 'music-toggle': options.music = !options.music; saveOptions(); startMusic(); render(); break;
    case 'auto': ui.selected = []; commit(G.autoArrange); break;
    case 'clear': ui.selected = []; commit(G.clearRows); break;
    case 'deselect': ui.selected = []; render(); break;
    case 'hand-card': selectCard(data.cardId, data.row == null ? undefined : +data.row, +data.slot); break;
    case 'place': placeSelected(+data.row,data.slot == null ? undefined : +data.slot); break;
    case 'resolve': startReveal(); break;
    case 'skip-reveal': ui.revealToken++; ui.reveal = -1; render(); break;
    case 'market': if (commit(G.enterShop) && state.phase === 'victory') unlock('clear'); break;
    case 'next': ui.selected = []; ui.modal = null; commit(G.continueRun); break;
    case 'buy': if (commit(G.buyItem,+data.index)) { unlock('shop'); sfx('buy'); toast(state.logs.at(-1)); } break;
    case 'refresh': if (commit(G.refreshShop)) { sfx('buy'); toast('新货上架。'); } break;
    case 'altar-target': state = {...state,selectedAltar:data.cardId}; persist(); closeModal(); break;
    case 'altar-spirit': case 'altar-stamp': case 'altar-sacrifice': if (commit(G.altar,name.slice(6),state.selectedAltar)) { unlock('altar'); showArtEffect(name === 'altar-spirit' ? 'spirit' : name === 'altar-stamp' ? 'stamp' : 'talisman'); sfx('buy'); toast(state.logs.at(-1)); } break;
    case 'filter': ui.filter = +data.suit; render(); break;
    case 'choose-face': {
      const modal = {...ui.modal};
      applySpell(modal.itemId,{cardId:modal.cardId,rank:+data.rank,suit:+data.suit});
      break;
    }
    case 'use-item': { const item = G.ITEM_MAP[data.id]; if (item.target === 'none') applySpell(item.id); else openModal('spell-target',{itemId:item.id}); break; }
    case 'spell-card': {
      const item = G.ITEM_MAP[ui.modal.itemId];
      if (item.target === 'card') applySpell(item.id,{cardId:data.cardId});
      else openModal(item.target === 'face' ? 'face' : 'spell-choice',{itemId:item.id,cardId:data.cardId});
      break;
    }
    case 'spell-value': applySpell(ui.modal.itemId,{cardId:ui.modal.cardId,...(data.rank != null ? {rank:+data.rank} : {}),...(data.suit != null ? {suit:+data.suit} : {})}); break;
  }
}

stage.addEventListener('click', event => {
  const element = event.target.closest('[data-action]');
  if (!element || element.disabled) return;
  if (ui.modal && !element.closest('.modal') && element.dataset.action !== 'retry-art') return;
  audioReady(); sfx();
  try { action(element.dataset.action,element); } catch (error) { console.error(error); toast('操作未完成，请重试。'+error.message,true); }
});
stage.addEventListener('change', event => {
  if (event.target.id === 'speed') options.speed = Number(event.target.value);
  else if (event.target.id === 'volume') options.volume = Number(event.target.value);
  saveOptions();
});
stage.addEventListener('input', event => { if (event.target.id === 'volume') { options.volume = Number(event.target.value); saveOptions(); } });
stage.addEventListener('dragstart', event => {
  const element = event.target.closest('[draggable="true"]');
  if (!element || state.phase !== 'arrange') return;
  ui.drag = element.dataset.cardId; event.dataTransfer.setData('text/plain',ui.drag); event.dataTransfer.effectAllowed = 'move';
});
stage.addEventListener('dragover', event => { if (event.target.closest('[data-drop-row], [data-drop-hand], [data-action="place"]')) event.preventDefault(); });
stage.addEventListener('drop', event => {
  event.preventDefault(); const id = ui.drag; ui.drag = null;
  if (!id || state.phase !== 'arrange' || ui.modal) return;
  const target = event.target.closest('[data-row]'), slot = event.target.closest('[data-slot]');
  if (target) { ui.selected = [id]; placeSelected(+target.dataset.row,slot ? +slot.dataset.slot : undefined); }
  else if (event.target.closest('[data-drop-hand]')) { ui.selected = []; commit(G.returnToHand,id); }
});
stage.addEventListener('contextmenu', event => {
  const element = event.target.closest('[data-action="hand-card"][data-row]');
  if (element && state.phase === 'arrange' && !ui.modal) { event.preventDefault(); ui.selected = []; commit(G.returnToHand,element.dataset.cardId); }
});
stage.addEventListener('pointerover', event => {
  const element = event.target.closest('[data-tooltip]');
  if (!element || ui.modal || element.contains(event.relatedTarget)) return;
  const item = G.ITEM_MAP[element.dataset.tooltip];
  stage.querySelector('.tooltip')?.remove();
  if (!item) return;
  const rect = element.getBoundingClientRect(), board = stage.getBoundingClientRect(), scale = board.width / 1440;
  const x = Math.min(1140,Math.max(20,(rect.right-board.left)/scale+10)), y = Math.min(590,(rect.top-board.top)/scale);
  stage.insertAdjacentHTML('beforeend',`<aside class="tooltip" style="left:${x}px;top:${y}px"><h3>${item.name}</h3>${item.description}<p style="margin-top:8px">点击购买 · ${item.price} 魂值</p></aside>`);
});
stage.addEventListener('pointerout', event => { const element = event.target.closest('[data-tooltip]'); if (element && !element.contains(event.relatedTarget)) stage.querySelector('.tooltip')?.remove(); });
addEventListener('keydown', event => {
  if (event.key === 'Escape') { if (ui.modal) closeModal(); else if (ui.selected.length) { ui.selected = []; render(); } else if (ui.screen !== 'menu') openModal('settings'); }
  if (event.key === 'Tab' && ui.modal) {
    const nodes = [...stage.querySelectorAll('.modal button:not(:disabled), .modal input, .modal select')];
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && (document.activeElement === first || !stage.querySelector('.modal').contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
render();
preloadArt(ART_PATHS);
if (saveError) toast(saveError,true);
