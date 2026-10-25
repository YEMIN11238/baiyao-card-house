// 图片生成后放入 assets/ 并填写相对路径；null 保留矢量占位画面。
// 卡牌图片只占中间画面，点数、花色、附灵和刻印标记由界面绘制。
export const ASSETS = {
  room: null,      // './assets/room.webp'：1440×810，含空牌桌的暖灯牌馆
  host: null,      // './assets/host.webp'：透明猫掌柜，建议900×780
  cardBack: null,  // './assets/card-back.webp'：竖版背面图案
  cardFaces: {},   // 优先实体ID如'c-3-14'，其次点数如'14'，或'joker-big'
  items: {},       // 引擎货品ID，如 mirror / flush / blackred
};
