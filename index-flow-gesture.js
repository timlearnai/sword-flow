(function(root){
function create(G,{hold=300,gap=120}={}){
 let since=null,lastMatch=null,lastTime=null,fired=false;
 function reset(){since=lastMatch=lastTime=null;fired=false;}
 function update(lm,now){
  if(lastTime!==null&&(now<lastTime||now-lastTime>gap))reset();
  lastTime=now;
  if(!lm){reset();return {match:false,trigger:false,progress:0};}
  const f=G.fingerRaw(lm);
  const strict=f[0]<65&&f[1]>110&&f[2]>110&&f[3]>110;
  // Hysteresis only retains an already established pose; two extended fingers
  // and an open palm always cancel immediately.
  const relaxed=since!==null&&f[0]<78&&f[1]>95&&f[2]>95&&f[3]>95;
  if(strict)lastMatch=now;
  if(!strict&&!(relaxed&&lastMatch!==null&&now-lastMatch<=gap)){
   reset();return {match:false,trigger:false,progress:0};
  }
  if(since===null)since=now;
  const trigger=strict&&!fired&&now-since>=hold;
  if(trigger)fired=true;
  return {match:true,trigger,progress:Math.min(1,(now-since)/hold)};
 }
 return {reset,update};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IndexFlowGesture=api;
})(typeof window!=='undefined'?window:globalThis);
