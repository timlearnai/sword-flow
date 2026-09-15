# Third-party dependencies

External libraries are loaded at runtime and are not copied into this folder.

- Three.js r128: https://github.com/mrdoob/three.js/tree/r128 — MIT; upstream notice: https://raw.githubusercontent.com/mrdoob/three.js/r128/LICENSE
- MediaPipe Hands and Camera Utils: https://github.com/google-ai-edge/mediapipe — upstream project license and exceptions: https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE . The browser fetches the runtime and hand models from jsDelivr; these packages are not sublicensed by this project. Pinned npm versions: `@mediapipe/hands@0.4.1675469240` and `@mediapipe/camera_utils@0.3.1675466862`.
- FFmpeg: optional, separately installed local executable used for MP4 conversion. No FFmpeg binaries or codec libraries are bundled. See https://ffmpeg.org/legal.html for the license of your chosen build.

Keep these notices when packaging dependencies. The project MIT license does not replace third-party license terms.
