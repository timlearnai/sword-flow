#!/bin/zsh
cd -- "$(dirname -- "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo '需要先安装 Python 3。'; read; exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo '未检测到 FFmpeg：可运行演示，录制先保存为 WebM。'
fi
echo '打开 http://127.0.0.1:8770/ 。按 Control+C 停止。'
python3 serve.py 8770
