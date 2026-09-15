// Optional local audio. No tracks are bundled or uploaded.
(()=>{const panel=document.createElement('div');panel.id='musicPanel';panel.style.cssText='position:fixed;left:14px;top:80px;z-index:20;background:#101820dd;color:#efdeb1;padding:12px;border-radius:8px;font:13px sans-serif';
 const label=document.createElement('label');label.textContent='本地音乐（自备授权音频） ';const input=document.createElement('input');input.type='file';input.accept='audio/*';input.style.width='200px';label.append(input);
 const audio=document.createElement('audio');audio.controls=true;audio.loop=true;audio.style.display='none';panel.append(label,audio);document.body.append(panel);let url,gain;
 input.onchange=async()=>{audio.pause();if(url)URL.revokeObjectURL(url);const file=input.files[0];if(!file)return;url=URL.createObjectURL(file);audio.src=url;audio.style.display='block';if(!gain)gain=await SwordAudio.attachMusic(audio);};
 const style=document.createElement('style');style.textContent='.recording #musicPanel{display:none}';document.head.append(style);
})();
