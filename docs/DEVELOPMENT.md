# 开发与部署

## 本地运行

需要 Node.js 20 或更新版本，CI 使用 Node.js 24。没有第三方运行依赖，无需安装 npm 包。

```bash
git clone https://github.com/YEMIN11238/baiyao-card-house.git
cd baiyao-card-house
npm start
```

主版地址为 `http://127.0.0.1:5174/`，通过终端运行时需要保持该进程。macOS 也可以双击 `game-thirteen/启动十三张.command`；该脚本会启动后台服务，之后可以关闭启动窗口，电脑重启后需要重新启动。

```bash
# 比鸡早期版，独立端口 5173
npm run start:biji

# 两版规则测试
npm test

# 检查图片路径和文档链接
npm run check

# 生成 GitHub Pages 静态文件
npm run build
```

## 代码结构

```text
game-thirteen/              十三张主版
  engine.js                 牌型、组牌、状态、经济、存档校验
  engine.test.mjs           规则与完整流程测试
  app.js                    教学、交互、揭牌与持久化
  assets.js                 图片与关卡对手映射
  art-loader.js             队列加载、解码校验与重试
  scenery.js                场景与角色层
  styles.css                界面、美术与横屏缩放
  assets/shanhai-v2/         64 张运行时素材
game/                       保留的比鸡早期版本
docs/                       玩法说明、截图与素材说明
scripts/                    发布检查与静态构建
.github/workflows/pages.yml 测试与 Pages 部署
```

## 在线部署

推送到 `main` 后，GitHub Actions 会先运行两版规则测试、检查素材与文档，再把 `dist/` 部署到 GitHub Pages。Pull request 只测试和构建，不发布。

静态站点包含 `/game-thirteen/` 与 `/game/` 两个版本。首页进入十三张；在在线主版里点击比鸡入口会跳转到同一站点的旧版，本地启动则使用独立的 5173 端口。

`dist/` 只包含浏览器运行文件。服务端脚本、启动日志、测试数据、开发备份和原始参考材料不会部署。

## 存档与当前范围

游戏使用浏览器 localStorage 自动保存。在线地址与本地地址存档各自独立；清除站点数据或换浏览器不会自动迁移进度。比鸡和十三张使用不同存档键。

目前是单人可玩原型。界面按 1440×810 横屏等比缩放，尚无手机竖屏专用布局；玩法数值仍需持续试玩，Steam 客户端、SDK、联机与逐帧角色动画尚未接入。

当前没有指定开源许可证；`package.json` 的 `private: true` 用于防止误发布 npm 包，不影响 GitHub 公开访问。
