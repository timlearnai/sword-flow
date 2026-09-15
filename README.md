# 御剑实验室 · Sword Flow

用手势控制飞剑、旋风与巨剑合击的浏览器视觉实验。基于 Three.js 和 MediaPipe。

支持 2400 把飞剑旋风、60 把悬空剑、沿手指轨迹穿行，以及巨剑抵球加速自转和炸裂。

## 在线与本机

在线版可运行视觉效果、手势识别和 WebM 录屏。本机版额外支持 FFmpeg 转 MP4。建议使用桌面 Chrome、摄像头和独立显卡或性能较好的集成显卡。

## 启动

需要 Python 3、支持 WebGL 的桌面浏览器；手势模式需要摄像头。

```sh
python3 serve.py 8770
```

打开 http://127.0.0.1:8770/ 。macOS 也可双击 `start.command`，终端窗口需保持开启。
首次需要联网加载固定版本的 Three.js 和 MediaPipe。点击「开启摄像头」并允许权限后，摄像头画面在浏览器处理；录屏转码请求仅发到本机服务器。在线版不上传录像。录制结果会包含已开启的右下角摄像头小窗，不含页面按钮和文字。

MP4 导出需要单独安装 FFmpeg 并放入 PATH；没有时仍可运行，导出会回退到 WebM。

## 快速测试

1. 点「预览60把排剑」，检查替代模型和排列。
2. 待两秒凝结完成，点「预览递增批次穿行」，观察3、6、9……递增剑流。
3. 点「预览托球巨剑合击」，检查穿行、托球、抵球自转、风效和炸裂。
4. 点「切回手势控制」试摄像头。

## 手势

- 攥拳吸引，握紧2.5秒全场吸引；剑指凝巨剑，快速摊掌炸开。
- 两次完成巨剑并释放后，解锁原来的单食指旋风及托球流程。
- 摊掌保持2秒：进入60把悬空剑；食指引导、移动分批穿行；收拳退出。
- 穿行先展示至少2秒，再托球持续1.5秒：巨剑在球右侧、剑柄抬高30度，剑尖抵球绕自身轴加速，2.5秒后炸裂。
- 圆形剑阵、下挥万剑、球形召剑等保留。识别仍为实验状态，光照、遮挡会影响结果。

## 素材与实现

- 不含歌曲、参考视频、参考图片、原 Blender/GLB 模型、个人录屏、手势采集记录及历史备份。
- 用 `assets/models/procedural-swords.js` 独立生成的简单几何剑替代原模型，外观不同。
- 不含内置音效；可选择本地背景音乐，不附赠曲目。
- 本机服务器只保留静态预览与MP4转码，移除了旧的手势录像上传接口。
- 约90秒的全动作自动演示尚未实现；目前是单项预览及合击预览。

## License

项目自身代码和程序生成模型采用 [MIT](LICENSE) 许可证。第三方库和识别模型遵循各自许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本地自行选择的音乐不属于项目发布内容。

## English quick start

Sword Flow is an experimental browser-based, gesture-controlled sword effect playground. It includes procedural geometry, flowing sword formations and a giant-sword drill attack.

Run `python3 serve.py 8770`, open `http://127.0.0.1:8770/`, then use the preview buttons or enable the camera. Dependencies load from public CDNs. Camera processing stays in the browser. Hosted recording saves WebM; local MP4 conversion requires FFmpeg. Gesture recognition and dense effects depend on lighting and hardware.

Contributions and reproducible bug reports are welcome. Include browser, operating system, reproduction steps and expected behavior; avoid uploading private camera footage.

