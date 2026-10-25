// Versioned production artwork. Text, pips and modification labels remain UI.
const root = './assets/shanhai-v2/';
const file = name => root + name;
export const ASSETS = {
  room: file('backgrounds/table-room.png'),
  menuRoom: file('backgrounds/menu-room.png'),
  host: file('characters/host-neutral.png'),
  cardBack: file('cards/card-back.png'),
  cardFrame: file('ui/card-frame.png'),
  cardFaces: Object.fromEntries([
    [2,'2-jingwei'],[3,'3-xuangui'],[4,'4-lushu'],[5,'5-dijiang-v3'],
    [6,'6-bifang'],[7,'7-nine-tail-fox'],[8,'8-wenyao'],[9,'9-zheng'],
    [10,'10-tiangou'],[11,'11-yingzhao'],[12,'12-luwu-v2'],[13,'13-kui'],[14,'14-yinglong']
  ].map(([rank, name]) => [rank, file(`cards/illustrations/${name}.png`)])),
  items: Object.fromEntries(['mirror','flush','swap','tide','rank','wild','tail','shield','blackred','twin','wind','flower','tailrelic','headrelic','single','full'].map(id => [id, file(`items/${id === 'rank' ? 'rank-v2' : id}.png`)])),
  shopPanel: file('ui/shop-panel.png'),
  altarPanel: file('ui/altar-panel.png'),
  endings: Object.fromEntries(['victory','defeat'].map(kind => [kind,file(`endings/${kind}-background.png`)])),
  results: Object.fromEntries(['win','lose','draw'].map(kind => [kind,file(`results/${kind}-banner.png`)])),
  effects: Object.fromEntries(['reveal','talisman','spirit','stamp'].map(kind => [kind,file(`effects/${kind}.png`)]))
};
export const OPPONENTS = [
  {id:'fox',name:'九尾狐',chapters:[1,2],sprites:{neutral:ASSETS.host,...Object.fromEntries(['thinking','winning','surprised','losing'].map(e=>[e,file(`characters/expressions/fox-${e}.png`)]))}},
  ...[['lushu','鹿蜀'],['xuangui','旋龟'],['tiangou','天狗'],['zheng','狰'],['yinglong','应龙']].map(([id,name],index)=>({
    id,name,chapters:[index*2+3,index*2+4],sprites:Object.fromEntries(['neutral','winning','losing'].map(e=>[e,file(`characters/opponents/${id}-${e}${id==='yinglong'&&e==='neutral'?'-v2':''}.png`)]))
  }))
];
export function opponentForChapter(chapter = 1) {
  return OPPONENTS[Math.max(0,Math.min(OPPONENTS.length-1,Math.floor((chapter-1)/2)))];
}
const flatten = value => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(flatten) : value && typeof value === 'object' ? Object.values(value).flatMap(flatten) : [];
export const ART_PATHS = [...new Set([...flatten(ASSETS), ...OPPONENTS.flatMap(o=>Object.values(o.sprites))])];
