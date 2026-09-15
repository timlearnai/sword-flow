(function(root){
function create(){
 let points=[],travel=0;
 function reset(x,y){points=[[x,y]];travel=0;}
 function push(x,y){const a=points[points.length-1];if(!a){reset(x,y);return;}const d=Math.hypot(x-a[0],y-a[1]);if(d<.045)return;travel+=d;points.push([x,y]);if(points.length>1200)points.shift();}
 function sample(u){let remaining=Math.min(12,travel)*u;for(let i=points.length-1;i>0;i--){const b=points[i],a=points[i-1],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(remaining<=d){const f=remaining/d;return [b[0]+(a[0]-b[0])*f,b[1]+(a[1]-b[1])*f];}remaining-=d;}return points[0]||[0,0];}
 return {reset,push,sample,get batch(){return Math.min(6,Math.floor(travel/.65));},get count(){const n=Math.floor(travel/.65);return Math.min(60,3*n*(n+1)/2);}};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PalmTrail=api;
})(typeof window!=='undefined'?window:globalThis);
