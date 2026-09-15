(function(root){
function create(){
 let phase='idle',openSince=null,indexSince=null,fistSince=null,lastSeen=null,lastNow=null,formedAt=0,flyAt=0;
 function reset(){phase='idle';openSince=indexSince=fistSince=lastSeen=lastNow=null;}
 function begin(now){phase='forming';formedAt=now;lastSeen=lastNow=now;openSince=indexSince=fistSince=null;}
 function fly(now){if(phase!=='ready')return false;phase='flying';flyAt=now;return true;}
 function tick(now){if(phase==='forming'&&now-formedAt>=2000)phase='ready';}
 function update({present,open=false,index=false,fist=false},now){
  tick(now);const active=phase!=='idle';
  if(lastNow!==null&&(now<lastNow||now-lastNow>250)){openSince=indexSince=fistSince=null;}lastNow=now;
  if(!present){openSince=indexSince=fistSince=null;if(active&&lastSeen!==null&&now-lastSeen>=650){reset();return 'exit';}return null;}lastSeen=now;
  if(!active){if(open){if(openSince===null)openSince=now;if(now-openSince>=2000){begin(now);return 'enter';}}else openSince=null;return null;}
  if(fist){if(fistSince===null)fistSince=now;if(now-fistSince>=250){reset();return 'exit';}}else fistSince=null;
  if(phase==='ready'&&index){if(indexSince===null)indexSince=now;if(now-indexSince>=180&&fly(now))return 'fly';}else indexSince=null;
  return null;
 }
 return {reset,begin,fly,tick,update,get phase(){return phase;},get formedAt(){return formedAt;},get flyAt(){return flyAt;},get released(){return phase==='flying'?Math.min(60,3*(1+Math.floor(Math.max(0,lastNow-flyAt)/350))):0;}};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PalmFormation=api;
})(typeof window!=='undefined'?window:globalThis);
