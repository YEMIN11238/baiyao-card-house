#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if curl -fsS http://127.0.0.1:5173 2>/dev/null | /usr/bin/grep -q '百妖牌馆'; then
  open http://127.0.0.1:5173
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
"$GAME_NODE" server.mjs &
GAME_SERVER_PID=$!
trap 'kill "$GAME_SERVER_PID" 2>/dev/null' EXIT INT TERM
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:5173 >/dev/null 2>&1; then
    open http://127.0.0.1:5173
    break
  fi
  sleep 0.1
done
wait "$GAME_SERVER_PID"
