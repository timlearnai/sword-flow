(function(root){
function isOpen(G,lm,aspect=4/3){if(!lm)return false;const d=(a,b)=>Math.hypot((lm[a].x-lm[b].x)*aspect,lm[a].y-lm[b].y),p=d(0,9);return p>.035&&G.fingerRaw(lm).every(v=>v<55)&&d(4,8)/p>.75&&d(8,12)/p>.16&&d(12,16)/p>.13&&d(16,20)/p>.13;}
function create(){let since=null,fired=false;return{update(now,active,left,right){if(!active){since=null;fired=false;return false;}if(!left||!right){since=null;return false;}if(since===null)since=now;if(!fired&&now-since>=180){fired=true;return true;}return false;}};}
const api={isOpen,create};if(typeof module==='object')module.exports=api;else root.SphereBurstGesture=api;
})(typeof window==='object'?window:globalThis);
