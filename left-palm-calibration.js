(function(root){
'use strict';
const defaults={on:.8,off:.6,open:.5,close:.65,enterMs:300,exitMs:350,lostMs:600};
function fit(positive,negative){
 if(positive.length<90||negative.length<90)return {error:'有效左手样本不足，请保持左手在画面内，重新采样。'};
 let best=null;
 for(let u=.35;u<=.901;u+=.025)for(let c=.35;c<=.801;c+=.025){
 const matches=s=>s.up>u&&s.closed<c;
 const recall=positive.filter(matches).length/positive.length,fpr=negative.filter(matches).length/negative.length;
 const score=recall-fpr*2;
 if(recall>=.9&&fpr<=.05&&(!best||score>best.score))best={score,recall,fpr,on:+u.toFixed(3),open:+c.toFixed(3)};
 }
 if(!best)return {error:'两种姿态的读数重叠较多，暂不应用。请把放下动作做清楚，或调整摄像头角度后重采。'};
 // Exit thresholds also checked against the negative examples.
 let off=best.on,close=best.open;
 for(const margin of [.1,.075,.05,.025,0]){const u=best.on-margin,c=best.open+margin;if(negative.filter(s=>s.up>u&&s.closed<c).length/negative.length<=.1){off=u;close=c;break;}}
 return {parameters:{...defaults,on:best.on,open:best.open,off:+off.toFixed(3),close:+close.toFixed(3)},recall:best.recall,fpr:best.fpr};
}
function create(parameters={}){const P={...defaults,...parameters};let active=false,enter=null,exit=null,lastSeen=null;
 function reset(){active=false;enter=exit=lastSeen=null;}
 function update({now,present,up=0,closed=1}){
 if(!present){enter=null;if(lastSeen===null||now-lastSeen>=P.lostMs){active=false;exit=null;}return active;}
 if(lastSeen!==null&&now-lastSeen>=P.lostMs){active=false;enter=exit=null;}lastSeen=now;
 if(!active){if(up>P.on&&closed<P.open){if(enter===null)enter=now;if(now-enter>=P.enterMs){active=true;exit=null;}}else enter=null;}
 else if(up<P.off||closed>P.close){if(exit===null)exit=now;if(now-exit>=P.exitMs){active=false;enter=null;}}else exit=null;
 return active;
 }return{P,update,reset};
}
const api={fit,create,defaults};if(typeof module==='object')module.exports=api;else root.LeftPalmCalibration=api;
})(typeof window==='object'?window:globalThis);
