#!/bin/zsh
cd "$(dirname "$0")" || exit 1
print '请在浏览器打开 http://127.0.0.1:4173'
print '关闭此窗口或按 Control+C 即可停止预览。'
python3 -m http.server 4173 --bind 127.0.0.1
