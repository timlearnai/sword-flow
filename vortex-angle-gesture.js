(function(root){
function create(){let samples=[],last=null,cooldown=-Infinity;
 function reset(){samples=[];last=null;}
 function update(lm,now,enabled=true){
  if(!enabled||!lm){reset();return null;}
  if(last!==null&&(now-last>180||now<last))reset();last=now;
  const palm=(lm[0].x+lm[5].x+lm[9].x+lm[17].x)/4;
  const x=palm-lm[8].x; // mirrored fingertip relative to palm; translation cancels.
  samples.push({x,now});while(samples.length&&now-samples[0].now>260)samples.shift();
  if(now<cooldown||samples.length<3)return null;
  const first=samples[0],dt=now-first.now,dx=x-first.x;
  if(dt>=70&&Math.abs(dx)>.075&&Math.abs(dx)/(dt/1000)>.38){
   cooldown=now+900;samples=[];return dx<0?'left':'right';
  }return null;
 }
 return {update,reset};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VortexAngleGesture=api;
})(typeof window!=='undefined'?window:globalThis);
