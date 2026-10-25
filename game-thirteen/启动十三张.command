#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if curl -fsS http://127.0.0.1:5174 2>/dev/null | /usr/bin/grep -q '十三张'; then
  [[ "$1" == '--no-open' ]] || open http://127.0.0.1:5174
  exit 0
fi
GAME_NODE="$(command -v node)"
if [[ -z "$GAME_NODE" && -x "$HOME/.local/node/bin/node" ]]; then
  GAME_NODE="$HOME/.local/node/bin/node"
fi
if [[ -z "$GAME_NODE" ]]; then
  print '需要 Node.js 20 或更新版本。安装后重新双击此文件。'
  read 'reply?按回车关闭。'
  exit 1
fi
mkdir -p .runtime || exit 1
# Detach the local server so closing this launcher does not stop the game.
"$GAME_NODE" - "$PWD" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = process.argv[2];
const log = fs.openSync(path.join(root, '.runtime/server.log'), 'a');
const child = spawn(process.execPath, [path.join(root, 'server.mjs'), '--port', '5174'], {
  cwd: root, detached: true, stdio: ['ignore', log, log],
});
child.unref();
fs.closeSync(log);
fs.writeFileSync(path.join(root, '.runtime/server.pid'), String(child.pid));
NODE
[[ $? == 0 ]] || exit 1
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:5174 2>/dev/null | /usr/bin/grep -q '十三张'; then
    [[ "$1" == '--no-open' ]] || open http://127.0.0.1:5174
    print '游戏已启动。可以关闭此窗口，游戏会继续运行。'
    exit 0
  fi
  sleep 0.1
done
print '游戏未能启动，详细信息请查看 .runtime/server.log。'
[[ "$1" == '--no-open' ]] || read 'reply?按回车关闭。'
exit 1
