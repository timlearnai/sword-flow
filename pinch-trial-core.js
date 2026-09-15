(function(root){
'use strict';
function create(options={}){
 const P={close:.28,open:.48,far:1.25,hold:500,formation:2500,lost:900,...options};
 let s;function reset(){s={phase:'waiting',armed:false,since:null,formedAt:null,lastSeen:null,ratio:null,strength:0,progress:0,ready:false};return s;}reset();
 function update({now,lm,leftReady=false,aspect=4/3}){
  s.ready=leftReady;
  if(!leftReady){reset();return s;}
  if(!lm){s.since=null;s.progress=0;s.armed=false;if(s.lastSeen!==null&&now-s.lastSeen>P.lost)reset();return s;}
  if(s.lastSeen!==null&&now-s.lastSeen>P.lost)reset();s.lastSeen=now;s.ready=true;
  const dist=(a,b)=>Math.hypot((lm[a].x-lm[b].x)*aspect,lm[a].y-lm[b].y);
  const size=dist(0,9);if(size<.035){s.since=null;s.armed=false;return s;}
  const raw=dist(4,8)/size;s.ratio=s.ratio===null?raw:s.ratio*.65+raw*.35;
  if(s.phase==='waiting'){
   if(raw>P.open)s.armed=true;
   if(s.armed&&raw<P.close){if(s.since===null)s.since=now;s.progress=Math.min(1,(now-s.since)/P.hold);if(s.progress===1){s.phase='forming';s.formedAt=now;s.since=null;s.progress=0;}}
   else{s.since=null;s.progress=0;}
  }else{
   s.progress=Math.min(1,(now-s.formedAt)/P.formation);
   if(s.progress===1)s.phase='control';
   const target=1-Math.max(0,Math.min(1,(s.ratio-P.close)/(P.far-P.close)));s.strength+=.2*(target-s.strength);
  }
  return s;
 }
 return {P,update,reset,get s(){return s;}};
}
const api={create};if(typeof module==='object')module.exports=api;else root.PinchTrial=api;
})(typeof window==='object'?window:globalThis);
