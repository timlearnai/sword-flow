// 手势核心：只做识别，不管画面。验证页和以后的特效页共用这一份；node 里也能跑（test-gesture.js）。
// 输入：MediaPipe Hands 的 21 个关键点（x,y 归一化，y 向下）。输出：状态 + 事件。
//
// 状态：none 没检测到手 / open 张开 / fist 攥拳（带 0～1 收拢度）/ sword 剑指
// 事件：fist 攥拳开始 · sword 剑指 · array 剑阵 · back 收回剑指变回攥拳 · fast 快速张开 · slow 慢慢张开 · flick 剑指往下挥 · circle 画圈
//       · palmup 托球（掌心朝上）· palmdown 托球放下 · lost 手丢了
//   离线评测脚本在会话 scratchpad 的 eval/eval-set.js
//
//   先攥拳聚集（攥拳状态 ≥ FIST_GATHER）再伸剑指 → sword，from:'fist'（巨剑）
//   张开手直接比剑指（中间一闪而过的攥拳不算）→ sword，from:'open'；再 手背朝镜头 + 两指竖着 + 手不动 保持 ARRAY_HOLD → array（剑阵）
//   录像里的剑阵手势：手从下面举起、张开、翻到手背朝镜头（正反 ~170°），收起无名小指，剑指竖在脸前（-25～-39°），一动不动 2～3 秒。先只按右手做。
(function (root) {
  // 四指（食 中 无 小）的 指根 MCP / 中节 PIP / 远节 DIP；拇指不参与（剑指时拇指常压着无名指，姿态太随意）
  const FINGERS = [[5, 6, 7], [9, 10, 11], [13, 14, 15], [17, 18, 19]];

  // 关节弯曲角（度）：两段骨头之间的偏折，伸直 ≈ 0
  function bend(a, b, c) {
    const v1x = b.x - a.x, v1y = b.y - a.y, v1z = (b.z || 0) - (a.z || 0);
    const v2x = c.x - b.x, v2y = c.y - b.y, v2z = (c.z || 0) - (b.z || 0);
    const n = Math.hypot(v1x, v1y, v1z) * Math.hypot(v2x, v2y, v2z) || 1e-6;
    return Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y + v1z * v2z) / n))) * 180 / Math.PI;
  }
  // 每根手指的原始读数 = 指根 + 中节 两个关节的弯曲角之和（第一步验证过：伸直≈15°，攥紧≈170°，中间线性）
  function fingerRaw(lm) {
    return FINGERS.map(([m, p, d]) => bend(lm[0], lm[m], lm[p]) + bend(lm[m], lm[p], lm[d]));
  }

  // ---- 角度用的小工具（三维向量用数组）----
  const sub = (a, b) => [a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1e-9; return [a[0] / l, a[1] / l, a[2] / l]; };
  const clamp1 = v => Math.max(-1, Math.min(1, v));
  const DEG = 180 / Math.PI;
  const wrap = d => ((d + 540) % 360) - 180;   // 角度差折到 (-180, 180]
  // 画面内指向（镜像后）：0° 朝上，90° 朝右，180° 朝下，-90° 朝左
  const scrAngle = (a, b) => Math.atan2(-(b.x - a.x), -(b.y - a.y)) * DEG;

  // 正反（拧门把手）：掌心法线和"朝镜头方向"的夹角，0° = 掌心朝镜头（反），180° = 手背朝镜头（正）
  // w 用 MediaPipe 的三维世界坐标（x 右、y 下、z 远离镜头）；sign 区分左右手（同样三个点，左手算出来的法线朝手背）
  // "朝镜头方向"先去掉沿手掌轴（手腕→中指根）的分量，只量绕小臂的翻转，手往前后倒不算
  function orient(w, sign) {
    const u = nrm(sub(w[9], w[0]));
    const n = nrm(cross(sub(w[5], w[0]), sub(w[17], w[0]))).map(v => v * sign);
    const pitch = Math.asin(clamp1(-u[2])) * DEG;                // 俯仰：正 = 手指朝镜头戳过来
    const cu = -u[2], cp = [0 - cu * u[0], 0 - cu * u[1], -1 - cu * u[2]];
    const L = Math.hypot(cp[0], cp[1], cp[2]);
    const up = -n[1];                                            // 掌心朝上的程度（1 = 正朝上，托球）
    if (L < 0.35) return { valid: false, pitch, up };            // 手掌轴几乎正对镜头（拳头怼着镜头），翻转测不准
    return { valid: true, pitch, up, flip: Math.acos(clamp1(dot(n, [cp[0] / L, cp[1] / L, cp[2] / L]))) * DEG };
  }

  function create(opt) {
    const P = Object.assign({
      RAW_OPEN: 15, RAW_FIST: 170,   // 校准值（页面上"记录张开 / 记录握拳"可改）
      SMOOTH: 0.45,                  // 每根手指收拢度的平滑
      GRAB_ON: 0.30, GRAB_OFF: 0.18, // 四指平均收拢度：≥ 进入攥拳，≤ 退出（和手势粒子 v3.1 一致）
      OPEN_FAST: 1.6,                // 松手速度（收拢度/秒）超过它 = 快速张开
      SWORD_STRAIGHT: 0.35,          // 剑指：食指收拢度低于它（伸直）
      SWORD_MID: 0.5,                //       中指低于它就行（录像里中指常被食指挡住，读数在 0～0.5 之间跳）
      SWORD_CURL_AVG: 0.72,          //       无名指 + 小指平均高于它（收起）。真剑指 ≥ 0.74；慢慢张开时先松开食中、无名小指还半弯（0.66）会凑成剑指——用这个分开
      SWORD_HOLD: 120,               // 剑指姿势保持这么多毫秒才算（过渡中一闪而过的不算）
      SWORD_BACK: 0.55,              // 剑指中，食指和中指**都**收拢超过它 = 收回，变回攥拳（原来看两指平均：下挥时中指被挡、读成全弯，平均一过线就误判收回）
      SWORD_OPEN: 0.25,              // 剑指中，无名指或小指有一根收拢低于它（且食指仍伸直）= 张开手掌（录像里张开时小指常被读成还弯着，只看平均认不出）
      SWORD_EXIT_HOLD: 150,          // 退出剑指的条件要连续保持这么多毫秒：手指朝下/朝右时读数会晃，一闪而过的不能把剑放掉（用户 2026-09-13）
      FLICK_WIN: 220,                // 往下挥：在这么多毫秒内
      FLICK_DY: 0.12,                //         指尖往下移动超过画面高度的这个比例
      FLICK_RATIO: 1.5,              //         而且往下的量是左右的 1.5 倍以上（斜着甩也算，横着扫不算）
      FLICK_COOL: 1000,              //         两次下挥至少隔这么多毫秒（原来 600；采集里左手挥完回弹一下，0.67 秒后又算了一次）
      FLICK_BACK_LOCK: 2000,         //         下挥后这么多毫秒内不认"收回成拳"，除非食指真的攥紧（> 0.85）：挥完两指横着 / 朝下停住，食中都读成半弯
      FLICK_TURN: 55,                //         或者：掌心 → 食指尖这把"剑"在 FLICK_TURN_WIN 里往下转过这么多度（用户的下挥是绕手腕压下去；采集：8 次下挥 64～91°，
                                     //         剑指 / 剑阵里的其他动作 ≤ 49°）。只看食指：甩的时候中指被挡、读数不可靠
      FLICK_TURN_WIN: 300,
      FLICK_TURN_KEEP: 0.45,         //         而且"剑"长度保留这么多以上（收回成拳也会转 60° 左右，但剑缩到 0.3）……
      FLICK_TURN_BIG: 70,            //         ……转过这么多度就不管长度（左手有一次下挥转 73°、长度 0.37）
      FLICK_ARM: 300,                //         刚变成剑指 / 剑阵这么多毫秒内不认下挥（举手摆好姿势时会转一下，录像里 0.26 秒时误认过一次）
      MOVE_FREEZE: 0.7,              // 剑指 / 剑阵时掌心速度超过它（画面高度/秒）= 手在快速挥动：手指会被拍糊、读成弯的，这时不退出（用户 2026-09-13：下挥老变成攥拳）
      FLICK_LOCK: 600,               // 下挥之后这么多毫秒内也不因为手指读数退出
      LOST_KEEP: 500,                // 剑指 / 剑阵时手丢了（挥太快摄像头糊了），这么多毫秒内找回来直接恢复
      CIRCLE_V: 0.25,                // 画圈：指尖速度超过它才累计（画面高度/秒）
      CIRCLE_MIN: 0.08,              //       圈至少这么大（画面高度的比例），手抖的小圈不算
      CIRCLE_TURN: 0.92,             //       累计转过 360° × 它 = 画完一圈
      FIST_GATHER: 1000,             // 攥拳状态保持这么多毫秒以上再伸剑指，才算"聚集后出剑"（巨剑）；更短的是比剑指途中路过的攥拳
                                     //   原来 400ms；采集里比剑阵手势途中攥了 0.64 秒被当成巨剑。真正的聚集后出剑都攥了 1.5 秒以上
      ARRAY_FLIP: 70,                // 剑阵：正反 ≥ 它。原来 130（手背朝镜头；最早的录像 ~170°）；2026-09-13 用户录像里侧着手比剑指 83～94° 一直出不来 → 放宽，只排除掌心朝镜头
      ARRAY_UP: 60,                  //       两指指向离"朝上"不超过这么多度（录像里 -25～-39°）
      ARRAY_STILL: 0.35,             //       掌心速度低于它（画面高度/秒）算不动（原来看指尖：中指读数一跳指尖就跳，一直算"在动"）
      REL_WIN: 1500,                 // 松手速度：往回找这么久
      REL_HI_FIST: 0.85,             //   从攥拳松手：从"四指平均还 ≥ 它"的最后一刻算起（原来只看无名小指 0.45 秒：慢慢张开时它们最后一下子松开，被算成快）
      REL_HI_SWORD: 0.75,            //   从剑指松手：从"无名 / 小指还 ≥ 它"的最后一刻算起
      PALMUP_ON: 0.8,                // 托球：掌心朝上的程度高于它（采集：托球中位数 0.89～0.98，别的手势 < 0.7）
      PALMUP_OFF: 0.6,               //       低于它算放下
      PALMUP_OPEN: 0.5,              //       四指平均收拢低于它（张开或微微拢着，像托着东西）
      PALMUP_HOLD: 300,              //       保持这么多毫秒
      ARRAY_HOLD: 500,               //       三个条件一起保持这么多毫秒 → 剑阵
      HAND: 'auto',                  // 左右手：'auto' 看 MediaPipe 标签（'Left' = 实际右手，因为喂的画面没镜像），'right' / 'left' 固定。
      LABEL_HOLD: 800,               // 'auto' 时新标签要连续这么多毫秒才换手（一闪而过的误判不算）
      ANG_SMOOTH: 0.4,               // 角度平滑（越小越稳、越慢）
      VEL_SMOOTH: 0.3,               // 转速平滑
    }, opt);

    const s = {
      state: 'none', f: [0, 0, 0, 0], closed: 0, rp: 0, im: 0, raw: [0, 0, 0, 0],
      swordPose: false, swordSince: -1, backSince: -1, openSince: -1, hist: [], tipHist: [], lastFlick: -1e9,
      tip: null, pointDeg: 0, rate: 0, downSpeed: 0,
      // 角度：fingerDeg 手指指向 / palmDeg 手掌指向 / scrDeg 当前用的那个（剑指看手指，其它看手掌）/ scrVel 画面内转速（°/s，正 = 顺时针）
      // flip 正反 0～180（0 掌心朝镜头 = 反，180 手背朝镜头 = 正）/ flipVel（°/s，正 = 往"正"拧）/ flipJit 抖动 / pitch 俯仰 / orValid 正反能不能测
      fingerDeg: 0, palmDeg: 0, scrDeg: 0, scrVel: 0, flip: 90, flipVel: 0, flipJit: 0, pitch: 0, orValid: false,
      hand: '', calSign: 1, lastT: 0, flipRaw: [], handRight: null, handPendSince: -1,   // handRight：'auto' 时认定的左右手 / handPendSince：标签变了从什么时候开始
      fistSince: -1, swordFrom: '', arraySince: -1, arrayHeld: 0, arrayOk: { back: false, up: false, still: false },
      palm: null, palmHist: [], palmSpeed: 0, lockUntil: 0, graceState: '', graceUntil: 0,
      circle: 0, circ: { acc: 0, last: null, lastMove: 0, bx: [1, 0, 1, 0], p: null, prev: null },   // 画圈进度 0～1 / 画圈的累计状态
      up: 0, palmUp: false, palmUpSince: -1,   // 掌心朝上的程度 / 托球中 / 托球姿势从什么时候开始
      turnHist: [], swordAt: -1e9, openAt: null,   // 食指"剑"的角度历史（下挥）/ 变成剑指的时刻 / 刚看到张开的那一刻
    };

    // 角度更新。w = 三维世界坐标（没有就用 lm），label = MediaPipe 的左右手标签
    function angles(lm, now, w, label) {
      const dt = s.lastT ? Math.max((now - s.lastT) / 1000, 1e-3) : 0; s.lastT = now;
      // 画面内指向：手指 = 食中指根中点 → 食中指尖中点；手掌 = 手腕 → 中指根
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const fRaw = scrAngle(mid(lm[5], lm[9]), mid(lm[8], lm[12])), pRaw = scrAngle(lm[0], lm[9]);
      const a = P.ANG_SMOOTH, prevScr = s.scrDeg;
      if (s.im < 0.6) s.fingerDeg = wrap(s.fingerDeg + wrap(fRaw - s.fingerDeg) * a);   // 食中收起来（攥拳）时两指方向没意义、会乱跳（录像里拳头时 ±97°）→ 停在上一次的值
      s.palmDeg = wrap(s.palmDeg + wrap(pRaw - s.palmDeg) * a);
      s.scrDeg = s.state === 'sword' || s.state === 'array' ? s.fingerDeg : s.palmDeg;
      if (dt) s.scrVel += (wrap(s.scrDeg - prevScr) / dt - s.scrVel) * P.VEL_SMOOTH;
      // 正反：MediaPipe 的左右手标签是按"镜像过的自拍画面"给的，我们喂的是没镜像的摄像头画面 → 标签 Left 实际是右手
      // 标签在手背朝镜头时常乱跳 → 默认固定右手（P.HAND）；'auto' 时新标签要连续 LABEL_HOLD 毫秒才换
      let right;
      if (P.HAND === 'right') right = true;
      else if (P.HAND === 'left') right = false;
      else {
        const lr = label ? label === 'Left' : true;
        if (s.handRight === null) s.handRight = lr;
        if (lr === s.handRight) s.handPendSince = -1;
        else if (s.handPendSince < 0) s.handPendSince = now;
        else if (now - s.handPendSince >= P.LABEL_HOLD) { s.handRight = lr; s.handPendSince = -1; }
        right = s.handRight;
      }
      s.hand = P.HAND === 'auto' ? (right ? '右手' : '左手') : (right ? '右手（固定）' : '左手（固定）');
      const o = orient(w || lm, (right ? 1 : -1) * s.calSign);
      s.pitch += (o.pitch - s.pitch) * a;
      s.up += (o.up - s.up) * a;
      s.orValid = o.valid;
      if (o.valid) {
        s.flipRaw.push(o.flip); if (s.flipRaw.length > 20) s.flipRaw.shift();
        const prev = s.flip; s.flip += (o.flip - s.flip) * a;
        if (dt) s.flipVel += ((s.flip - prev) / dt - s.flipVel) * P.VEL_SMOOTH;
        const m = s.flipRaw.reduce((x, y) => x + y, 0) / s.flipRaw.length;   // 抖动 = 最近 20 帧原始读数的标准差
        s.flipJit = Math.sqrt(s.flipRaw.reduce((x, y) => x + (y - m) * (y - m), 0) / s.flipRaw.length);
      } else s.flipVel *= 0.8;
    }

    // 掌心朝镜头时调用：读数如果 > 90°（左右手判反了），把正反整体翻过来
    function calPalm() { if (s.orValid && s.flip > 90) { s.calSign *= -1; s.flip = 180 - s.flip; s.flipRaw = s.flipRaw.map(v => 180 - v); } }

    function norm(r) { return Math.min(1, Math.max(0, (r - P.RAW_OPEN) / (P.RAW_FIST - P.RAW_OPEN))); }

    // 松手：从 0.3 秒窗口里最紧的那一刻算张开速度（窗口里可能还留着握紧前的 0，不能拿第一条算）
    function release(now, from, at) {
      const sw = from === 'sword' || from === 'array', col = sw ? 2 : 1, HI = sw ? P.REL_HI_SWORD : P.REL_HI_FIST;
      const [te, ve] = at || [now, sw ? Math.min(s.f[2], s.f[3]) : s.closed];
      let k = -1, m = 0;
      for (let i = 0; i < s.hist.length; i++) { const h = s.hist[i]; if (h[0] > te) break; if (h[col] >= HI) k = i; if (h[col] > s.hist[m][col]) m = i; }
      const h0 = s.hist.length ? s.hist[k >= 0 ? k : m] : [te, ve, ve];
      const t0 = h0[0], v0 = h0[col];
      s.rate = (v0 - ve) / Math.max((te - t0) / 1000, 0.05);
      s.state = 'open';
      return { type: s.rate > P.OPEN_FAST ? 'fast' : 'slow', rate: s.rate, from };
    }

    let suspended=false,recoverUntil=-Infinity;
    function suspend(){
      suspended=true;s.recovering=true;
      s.hist.length=s.tipHist.length=s.palmHist.length=s.turnHist.length=0;
      s.swordSince=s.backSince=s.openSince=s.arraySince=s.palmUpSince=-1;s.openAt=null;s.arrayHeld=0;
      s.circ.last=s.circ.prev=null;s.circ.acc=0;s.lastT=0;
    }
    function update(lm, now, w, label) {
      if(suspended){suspended=false;recoverUntil=now+100;}
      s.recovering=now<recoverUntil;
      const ev = [];
      if (s.state === 'none') {
        // 手丢了又找回来：丢之前是剑指 / 剑阵、没超过 LOST_KEEP，直接恢复（别从张开重新判，一判就容易先判成攥拳）
        const keep = s.graceState && now <= s.graceUntil;
        s.state = keep ? s.graceState : 'open'; s.graceState = '';
        s.hist.length = 0; s.tipHist.length = 0; s.palmHist.length = 0; s.lastT = 0; s.flipRaw.length = 0;
        if (keep) { s.lockUntil = now + 300; s.backSince = s.openSince = -1; }
        else { s.handRight = null; s.handPendSince = -1; }   // 新出现的手（可能换了一只）：左右手按它自己的标签重新认，不用等 LABEL_HOLD
      }
      const dtf = s.lastT ? Math.max((now - s.lastT) / 1000, 1e-3) : 1 / 30;   // 和上一帧隔多久（画圈用）
      angles(lm, now, w, label);
      s.raw = fingerRaw(lm);
      for (let i = 0; i < 4; i++) s.f[i] += (norm(s.raw[i]) - s.f[i]) * P.SMOOTH;
      s.closed = (s.f[0] + s.f[1] + s.f[2] + s.f[3]) / 4;
      s.im = (s.f[0] + s.f[1]) / 2;   // 食指 + 中指
      s.rp = (s.f[2] + s.f[3]) / 2;   // 无名指 + 小指：攥拳和剑指里都是收起的，张开手掌时它们一定会伸开 → 用它算松手速度
      s.hist.push([now, s.closed, Math.min(s.f[2], s.f[3])]);   // 松手速度用：[时刻, 四指平均, 无名 / 小指较小值]
      while (s.hist.length > 1 && now - s.hist[0][0] > P.REL_WIN) s.hist.shift();

      // 指尖 = 食指尖和中指尖的中点，x 镜像（像照镜子）
      s.tip = { x: 1 - (lm[8].x + lm[12].x) / 2, y: (lm[8].y + lm[12].y) / 2 };
      s.tipHist.push([now, s.tip.x, s.tip.y]);
      while (s.tipHist.length > 1 && now - s.tipHist[0][0] > P.FLICK_WIN) s.tipHist.shift();
      const [ht, hx, hy] = s.tipHist[0], dts = Math.max((now - ht) / 1000, 1e-3);
      const dy = s.tip.y - hy, dx = s.tip.x - hx;
      s.downSpeed = dy / dts;         // 画面高度/秒，正 = 往下
      // 掌心（手腕 + 四指根，x 镜像）= 手整体怎么动。快速挥动时手指会被拍糊读错，掌心稳得多
      const pc = { x: 0, y: 0 }; for (const j of [0, 5, 9, 13, 17]) { pc.x += (1 - lm[j].x) / 5; pc.y += lm[j].y / 5; }
      s.palm = pc; s.palmHist.push([now, pc.x, pc.y]);
      while (s.palmHist.length > 1 && now - s.palmHist[0][0] > P.FLICK_WIN) s.palmHist.shift();
      const [pt0, px0, py0] = s.palmHist[0], pdts = Math.max((now - pt0) / 1000, 1e-3), pdx = pc.x - px0, pdy = pc.y - py0;
      s.palmSpeed = Math.hypot(pdx, pdy) / pdts;
      // 食指这把"剑"：掌心 → 食指尖（x 镜像），离"朝上"多少度 + 长度；下挥看它 0.3 秒里往下转了多少
      const ix = (1 - lm[8].x) - pc.x, iy = lm[8].y - pc.y, ia = Math.abs(Math.atan2(ix, -iy)) * DEG, iL = Math.hypot(ix, iy);
      s.turnHist.push([now, ia, iL, s.f[0]]);
      while (s.turnHist.length > 1 && now - s.turnHist[0][0] > P.FLICK_TURN_WIN) s.turnHist.shift();
      // 手指指向：食指根 → 食指尖，0° = 朝上，顺时针为正（镜像后）
      s.pointDeg = Math.atan2(-(lm[8].x - lm[5].x), -(lm[8].y - lm[5].y)) * 180 / Math.PI;

      if(s.recovering)return ev; // Rebuild motion history without interpreting the recovery jump as a gesture.
      s.swordPose = s.f[0] < P.SWORD_STRAIGHT && s.f[1] < P.SWORD_MID && s.rp > P.SWORD_CURL_AVG;
      if (!s.swordPose) s.swordSince = -1; else if (s.swordSince < 0) s.swordSince = now;
      const swordHeld = s.swordPose && now - s.swordSince >= P.SWORD_HOLD;

      const resetCirc = full => { const c = s.circ; c.acc = 0; c.last = null; c.lastMove = now; c.bx = [1, 0, 1, 0]; s.circle = 0; if (full) c.p = c.prev = null; };
      const toSword = from => { s.state = 'sword'; s.swordFrom = from; s.swordAt = now; s.backSince = s.openSince = s.arraySince = -1; s.arrayHeld = 0; resetCirc(true); };
      if (s.state === 'open') {
        if (swordHeld) { toSword('open'); ev.push({ type: 'sword', from: 'open' }); }
        else if (s.closed >= P.GRAB_ON) { s.state = 'fist'; s.fistSince = now; ev.push({ type: 'fist' }); }
      } else if (s.state === 'fist') {
        if (swordHeld) {
          const fistMs = now - s.fistSince, from = fistMs >= P.FIST_GATHER ? 'fist' : 'open';   // 攥拳太短 = 比剑指途中路过，当成直接比
          toSword(from); ev.push({ type: 'sword', from, fistMs }); s.tipHist.length = 0;
        }
        else if (s.closed <= P.GRAB_OFF) ev.push(release(now, 'fist'));
      } else if (s.state === 'sword' || s.state === 'array') {
        // 剑指只看"变了的那几根手指"：食中收回去 = 回到攥拳；无名小指也伸开（四指都直）= 张开手掌。过渡途中不来回跳
        // 两个条件都要连续保持 SWORD_EXIT_HOLD 才算，手指指向变了读数晃一下不会把剑放掉
        // 手在快速挥动 / 刚挥完 / 刚找回手：手指形状读数不可信，不退出
        const moving = s.palmSpeed > P.MOVE_FREEZE || now < s.lockUntil;
        const backC = !moving && s.f[0] > P.SWORD_BACK && s.f[1] > P.SWORD_BACK   // 食指和中指都收回去才算（只一根"弯"多半是被挡住 / 斜着对镜头）
          && (now - s.lastFlick > P.FLICK_BACK_LOCK || s.f[0] > 0.85);            // 刚挥完：两指横着停住会读成半弯，要真攥紧才算收回
        const rpMin = Math.min(s.f[2], s.f[3]), openC = now >= s.lockUntil && rpMin < P.SWORD_OPEN && s.f[0] < P.SWORD_STRAIGHT + 0.1;
        s.backSince = backC ? (s.backSince < 0 ? now : s.backSince) : -1;
        if (openC && s.openSince < 0) s.openAt = [now, rpMin];   // 刚看到张开的那一刻（松手速度算到这里）
        s.openSince = openC ? (s.openSince < 0 ? now : s.openSince) : -1;
        const was = s.state;
        if (backC && now - s.backSince >= P.SWORD_EXIT_HOLD) { s.state = 'fist'; s.fistSince = now - P.FIST_GATHER; ev.push({ type: 'back', from: was }); }   // 收回后再伸，仍算聚集后出剑
        else if (openC && now - s.openSince >= P.SWORD_EXIT_HOLD) ev.push(release(now, was, s.openAt));
        else {
          // 下挥：掌心往下猛走（整只手挥下去；挥的时候手指被拍糊、看着像弯了也不管）
          //      或 指尖往下猛走且食中还伸直（手腕一甩；手指往回弯时指尖也会往下走，那种不算）
          //      正在画圈（已转过 60° 以上）时不算
          const byPalm = pdy > P.FLICK_DY * 0.7 && pdy > P.FLICK_RATIO * Math.abs(pdx);
          //   起点食指是伸直的，而且剑没缩短多少（收回成拳会缩到 0.3）；转得够大（FLICK_TURN_BIG）就不管长度。只看食指：甩的时候中指被挡
          let byTurn = false;
          for (const [, a0, L0, f0] of s.turnHist) {
            if (f0 >= 0.5 || L0 < 1e-3) continue;
            const turn = ia - a0;
            if (turn >= P.FLICK_TURN && (iL / L0 >= P.FLICK_TURN_KEEP || turn >= P.FLICK_TURN_BIG)) { byTurn = true; break; }
          }
          const byTip = s.im < P.SWORD_STRAIGHT && dy > P.FLICK_DY && dy > P.FLICK_RATIO * Math.abs(dx);
          // 画圈转过 60° 时掌心 / 指尖往下走不算（画圈的下半圈就是往下走）；绕腕压是"剑"自己在转，不受这条限制
          const armed = now - s.swordAt >= P.FLICK_ARM;   // 刚摆好剑指时会转一下，不算
          if (armed && ((byPalm || byTip) && Math.abs(s.circ.acc) < Math.PI / 3 || byTurn) && now - s.lastFlick > P.FLICK_COOL) {
            s.lastFlick = now; s.lockUntil = now + P.FLICK_LOCK;
            ev.push({ type: 'flick', speed: Math.max(dy / dts, pdy / pdts), by: byPalm ? 'palm' : byTip ? 'tip' : 'turn' });
            s.tipHist.length = 0; s.palmHist.length = 0; s.turnHist.length = 0;
          }
          const c = s.circ, tp = s.tip;
          c.p = c.p ? { x: c.p.x + (tp.x - c.p.x) * 0.5, y: c.p.y + (tp.y - c.p.y) * 0.5 } : { x: tp.x, y: tp.y };
          if (c.prev) {
            const vx = c.p.x - c.prev.x, vy = c.p.y - c.prev.y;
            if (Math.hypot(vx, vy) / dtf > P.CIRCLE_V) {
              const dir = Math.atan2(vy, vx);
              if (c.last !== null) { const d = Math.atan2(Math.sin(dir - c.last), Math.cos(dir - c.last)); c.acc += Math.max(-1, Math.min(1, d)); }
              c.last = dir; c.lastMove = now;
              c.bx = [Math.min(c.bx[0], c.p.x), Math.max(c.bx[1], c.p.x), Math.min(c.bx[2], c.p.y), Math.max(c.bx[3], c.p.y)];
            } else if (now - c.lastMove > 350) resetCirc(false);   // 停下来超过 0.35 秒就重新计
          }
          c.prev = { x: c.p.x, y: c.p.y };
          s.circle = Math.min(1, Math.abs(c.acc) / (2 * Math.PI * P.CIRCLE_TURN));
          const cw = c.bx[1] - c.bx[0], ch = c.bx[3] - c.bx[2];
          if (s.circle >= 1 && Math.max(cw, ch) >= P.CIRCLE_MIN && Math.min(cw, ch) >= P.CIRCLE_MIN * 0.5) {
            ev.push({ type: 'circle', dir: c.acc > 0 ? 'cw' : 'ccw', size: Math.max(cw, ch) });   // 画面 y 朝下：角度越转越大 = 顺时针
            resetCirc(false); s.lockUntil = now + 300;
          }
          // 剑阵：直接比出来的剑指，手背朝镜头 + 两指竖着 + 手不动，一起保持 ARRAY_HOLD
          if (s.state === 'sword' && s.swordFrom === 'open') {
            const ok = s.arrayOk = { back: s.orValid && s.flip >= P.ARRAY_FLIP, up: Math.abs(s.fingerDeg) <= P.ARRAY_UP, still: s.palmSpeed < P.ARRAY_STILL };
            if (ok.back && ok.up && ok.still) {
              if (s.arraySince < 0) s.arraySince = now;
              s.arrayHeld = now - s.arraySince;
              if (s.arrayHeld >= P.ARRAY_HOLD) { s.state = 'array'; ev.push({ type: 'array' }); }
            } else { s.arraySince = -1; s.arrayHeld = 0; }
          }
        }
      }
      if (s.state !== 'sword' && s.state !== 'array') resetCirc(true);
      const upPose = s.up > P.PALMUP_ON && s.closed < P.PALMUP_OPEN && s.state !== 'sword' && s.state !== 'array';
      if (!s.palmUp) {
        if (upPose) { if (s.palmUpSince < 0) s.palmUpSince = now; if (now - s.palmUpSince >= P.PALMUP_HOLD) { s.palmUp = true; ev.push({ type: 'palmup' }); } }
        else s.palmUpSince = -1;
      } else if (s.up < P.PALMUP_OFF || s.closed > P.PALMUP_OPEN + 0.15 || s.state === 'sword' || s.state === 'array') {
        s.palmUp = false; s.palmUpSince = -1; ev.push({ type: 'palmdown' });
      }
      return ev;
    }

    // 手丢了。now 要和 update 用同一个时钟（特效页用模拟时间）；不给就用 performance.now()
    function lost(now) {
      if (now === undefined) now = typeof performance !== 'undefined' ? performance.now() : 0;
      suspended=false;recoverUntil=-Infinity;s.recovering=false;
      const was = s.state;
      if (was === 'sword' || was === 'array') { s.graceState = was; s.graceUntil = now + P.LOST_KEEP; }
      else if (was !== 'none') s.graceState = '';
      s.state = 'none'; s.swordSince = -1; s.arraySince = -1; s.arrayHeld = 0; s.hist.length = 0; s.tipHist.length = 0; s.palmHist.length = 0; s.turnHist.length = 0;
      const out = was === 'none' ? [] : [{ type: 'lost', from: was }];
      if (s.palmUp) { s.palmUp = false; out.push({ type: 'palmdown' }); } s.palmUpSince = -1;
      return out;
    }

    return { P, s, update, lost, suspend, calPalm };
  }

  const api = { create, fingerRaw, bend, orient, FINGERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GestureCore = api;
})(this);
