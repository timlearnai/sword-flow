#!/usr/bin/env python3
# Local-only preview server with MP4 export.
import http.server, os, re, sys, shutil, subprocess, tempfile, threading

CONVERSIONS = threading.BoundedSemaphore(2)

ROOT = os.path.dirname(os.path.abspath(__file__))
REC = os.path.join(ROOT, 'recordings')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')   # 改完页面刷新就是新的，不用再加 ?v=N
        super().end_headers()

    def export_mp4(self):
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''):
            self.send_error(403, 'Local page only'); return
        try:
            size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.send_error(400, 'Invalid size'); return
        if not 0 < size <= 1024 * 1024 * 1024:
            self.send_error(413, 'Recording must be between 1 byte and 1 GB'); return
        ffmpeg = shutil.which('ffmpeg')
        if not ffmpeg:
            self.send_error(503, 'FFmpeg is not available'); return
        if not CONVERSIONS.acquire(blocking=False):
            self.send_error(503, 'Another conversion is in progress'); return
        try:
            with tempfile.TemporaryDirectory(prefix='sword-mp4-') as temp:
                source = os.path.join(temp, 'source.webm')
                target = os.path.join(temp, 'sword.mp4')
                self.connection.settimeout(600)
                with open(source, 'wb') as out:
                    remaining = size
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise ValueError('Incomplete recording')
                        out.write(chunk); remaining -= len(chunk)
                subprocess.run([
                    ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', source,
                    '-map', '0:v:0', '-map', '0:a:0?',
                    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
                    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level:v', '4.2',
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', target
                ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=600)
                self.send_response(200)
                self.send_header('Content-Type', 'video/mp4')
                self.send_header('Content-Length', str(os.path.getsize(target)))
                self.send_header('Content-Disposition', 'attachment; filename="sword.mp4"')
                self.end_headers()
                with open(target, 'rb') as video:
                    shutil.copyfileobj(video, self.wfile)
        except (subprocess.SubprocessError, ValueError, OSError):
            self.send_error(500, 'MP4 conversion failed; keep the original recording')
        finally:
            CONVERSIONS.release()

    def do_POST(self):
        if self.path == '/export-mp4':
            self.export_mp4(); return
        self.send_error(404)



if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
