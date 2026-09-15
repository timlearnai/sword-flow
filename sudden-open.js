(function(root){
function create(){let history=[],last=null,cooldown=-Infinity;
 function update(raw,open,now){
  if(raw===null||last!==null&&(now-last>220||now<last)){history=[];last=now;if(raw===null)return false;}
  last=now;history=history.filter(p=>now-p[0]<=280);
  const rapid=open&&history.some(p=>now-p[0]>=35&&p[1]-raw>50&&(p[1]-raw)/((now-p[0])/1000)>230);
  history.push([now,raw]);
  if(rapid&&now-cooldown>800){cooldown=now;history=[];return true;}return false;
 }
 return {update};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SuddenOpen=api;
})(typeof window!=='undefined'?window:globalThis);
