// Record the effect canvas and mirrored camera inset; exclude all page UI.
(() => {
  const effect = document.getElementById('c'), camera = document.getElementById('cam');
  const button = document.createElement('button');
  button.id = 'recordVideo'; button.title = '录制剑阵、自选音乐和右下角摄像头小窗，不包含按钮或网页文字'; button.textContent = '● 开始录制';
  const status = document.createElement('span');
  status.style.cssText = 'color:#eee;font-size:12px;white-space:nowrap';
  status.setAttribute('role', 'status');
  const download = document.createElement('a');
  download.textContent = '下载 MP4'; download.style.cssText = 'color:#ffd166;display:none;white-space:nowrap';
  document.getElementById('bottom').append(button, status, download);
  const output = document.createElement('canvas'), ctx = output.getContext('2d');
  let recorder = null, stream = null, chunks = [], started = 0, url = null, lastCapture = -Infinity, converting = false;
  function cleanup() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; recorder = null;
    button.disabled = false; button.textContent = '● 开始录制';
    document.body.classList.remove('recording');
  }
  window.captureSwordVideoFrame = () => {
    if (!recorder || recorder.state !== 'recording') return;
    const now = performance.now();
    if (now-lastCapture < 1000/60-1) return;
    lastCapture = now;
    const w = output.width, h = output.height;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    // Fixed recording dimensions; preserve the scene proportions after a window resize.
    const scale = Math.min(w / effect.width, h / effect.height);
    const ew = effect.width * scale, eh = effect.height * scale;
    ctx.drawImage(effect, (w-ew)/2, (h-eh)/2, ew, eh);
    if (camera && camera.readyState >= 2 && camera.videoWidth > 0 && camera.videoHeight > 0) {
      const cw = w * 0.18, ch = cw * 0.75, margin = w * 0.012;
      const x = w-cw-margin, y = h-ch-margin;
      ctx.save(); ctx.beginPath(); ctx.roundRect(x,y,cw,ch,10); ctx.clip();
      ctx.fillStyle='#101820'; ctx.fillRect(x,y,cw,ch);
      // Contain the full camera image so the upper body is not cropped.
      const k = Math.min(cw/camera.videoWidth, ch/camera.videoHeight);
      const vw=camera.videoWidth*k, vh=camera.videoHeight*k;
      ctx.translate(x+cw,y); ctx.scale(-1,1);
      ctx.drawImage(camera,(cw-vw)/2,(ch-vh)/2,vw,vh); ctx.restore();
      ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.roundRect(x,y,cw,ch,10); ctx.stroke();
    }
    const seconds = Math.floor((performance.now()-started)/1000);
    status.textContent = '剑阵＋摄像头 ' + Math.floor(seconds/60) + ':' + String(seconds%60).padStart(2,'0') + ' · ' + w + '×' + h;
  };
  button.onclick = async () => {
    if (converting) return;
    if (recorder) {
      if (recorder.state === 'recording') { button.disabled=true; status.textContent='正在保存…'; recorder.stop(); }
      return;
    }
    if (!window.MediaRecorder || !output.captureStream) { status.textContent='此浏览器不支持录制，请使用 Chrome'; return; }
    button.disabled=true;
    try {
      const scale = Math.min(1,3840/effect.width,2160/effect.height);
      output.width = Math.max(2, Math.floor(effect.width*scale/2)*2);
      output.height = Math.max(2, Math.floor(effect.height*scale/2)*2);
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      stream=output.captureStream(60); chunks=[];lastCapture=-Infinity;
      const soundTrack=await window.SwordMusic?.prepareRecording();if(soundTrack&&soundTrack.readyState==='live')stream.addTrack(soundTrack.clone());
      // Preserve native canvas detail. Target 0.16 bits per pixel per frame for dense moving particles.
      const videoBitsPerSecond=Math.min(60000000,Math.max(24000000,Math.round(output.width*output.height*60*0.16)));
      const mimeType=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      recorder=new MediaRecorder(stream, { ...(mimeType?{mimeType}:{}), videoBitsPerSecond,audioBitsPerSecond:192000 });
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      let failed=false;
      recorder.onerror=()=>{failed=true;status.textContent='录制出错，请重试';cleanup();};
      recorder.onstop=async ()=>{
        if(failed)return;
        const type=chunks[0]?.type || mimeType || 'video/webm';
        const blob=new Blob(chunks,{type}); chunks=[];cleanup();
        if(!blob.size){status.textContent='未录到画面，请重试';return;}
        const localConversion=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
        converting=localConversion;button.disabled=localConversion;download.style.display='none';
        status.textContent=localConversion?'正在本机转换 MP4，请勿关闭页面…':'WebM 已生成 · 本机运行可转换 MP4';
        let result=blob,extension='.webm',converted=false;
        try {
          if(localConversion){
          const response=await fetch('/export-mp4',{method:'POST',headers:{'Content-Type':type},body:blob});
          if(!response.ok)throw new Error('转换服务返回 '+response.status);
          result=await response.blob();
          if(!result.size||!result.type.includes('video/mp4'))throw new Error('转换结果无效');
          extension='.mp4';converted=true;
          }
        } catch(error) {
          status.textContent='MP4 转换失败，原始录像已保留。请通过本地 serve.py 服务打开页面后再录制。';
        } finally { converting=false;button.disabled=false; }
        if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(result);
        download.href=url;download.download='剑阵展示-'+new Date().toISOString().replace(/[:.]/g,'-')+extension;
        download.textContent=converted?'下载 MP4':'下载原始录像';download.style.display='inline';download.click();
        if(converted)status.textContent='MP4 已生成 · 可发送微信';
      };
      started=performance.now();recorder.start(1000);
      button.disabled=false;button.textContent='■ 停止并保存';status.textContent='剑阵＋摄像头 · 0:00';document.body.classList.add('recording');
    } catch(e) { cleanup();status.textContent='无法开始录制：'+e.message; }
  };
  window.addEventListener('beforeunload',e=>{if(recorder||converting){e.preventDefault();e.returnValue='';}});
})();
