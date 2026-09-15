// Track palm trajectories before routing gestures. Labels only initialize a track.
(function(root){
function create({hold=250,ttl=1200,keep=350}={}){
 let tracks=[],serial=0,status='等待识别';
 const point=d=>{const p={x:0,y:0};for(const i of [0,5,9,13,17]){p.x+=d.lm[i].x/5;p.y+=d.lm[i].y/5;}return p;};
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function retain(out,now){
 for(const t of tracks)if(t.label&&t.sample&&!out.some(d=>d.trackId===t.id)&&now-t.last<=keep)out.push({...t.sample,held:true,missingMs:now-t.last});
 return out;
 }
 function update(input,now){
 tracks=tracks.filter(t=>now-t.last<=ttl);
 const ds=input.filter(d=>d.lm?.length===21&&d.lm.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).slice(0,2).map(d=>({...d,p:point(d)}));
 if(ds.length===2&&dist(ds[0].p,ds[1].p)<.075){status='双手重叠 · 保持当前动作';return retain([],now);}
 const cost=(t,d)=>{const dt=Math.min(.12,(now-t.last)/1000);const p={x:t.p.x+t.v.x*dt,y:t.p.y+t.v.y*dt};const distance=dist(p,d.p);return distance<.16+Math.min(.1,(now-t.last)/2000)?distance:Infinity;};
 const choices=[];
 function assign(i,used,map,sum){if(i===tracks.length){choices.push({map:[...map],sum});return;}assign(i+1,used,[...map,-1],sum+.3);ds.forEach((d,j)=>{if(!used.has(j)){const c=cost(tracks[i],d);if(Number.isFinite(c)){const u=new Set(used);u.add(j);assign(i+1,u,[...map,j],sum+c);}}});}
 assign(0,new Set(),[],0);choices.sort((a,b)=>a.sum-b.sum);
 if(tracks.length===2&&ds.length&&choices.length>1&&choices[1].sum-choices[0].sum<.045){status='交叉遮挡 · 保持当前动作';return retain([],now);}
 const used=new Set(),pairs=[];
 tracks.forEach((t,i)=>{const j=choices[0].map[i];if(j>=0){used.add(j);pairs.push([t,ds[j]]);}});
 ds.forEach((d,j)=>{if(used.has(j)||tracks.length>=2)return;
 // A nearby unmatched hand may be a discontinuity; do not create a second identity.
 if(tracks.some(t=>dist(t.p,d.p)<.24))return;
 const t={id:++serial,p:d.p,v:{x:0,y:0},last:now,label:null,pending:null,since:now};tracks.push(t);pairs.push([t,d]);});
 const out=[];
 for(const [t,d] of pairs){if(!t.label&&now-t.last>120){t.pending=null;t.since=now;}const dt=(now-t.last)/1000;if(dt>0){t.v.x=.5*t.v.x+.5*Math.max(-2,Math.min(2,(d.p.x-t.p.x)/dt));t.v.y=.5*t.v.y+.5*Math.max(-2,Math.min(2,(d.p.y-t.p.y)/dt));}t.p=d.p;t.last=now;
 if(!t.label){if((d.score??0)<.8||!['Left','Right'].includes(d.label)){t.pending=null;t.since=now;continue;}if(t.pending!==d.label){t.pending=d.label;t.since=now;}if(now-t.since>=hold&&!tracks.some(q=>q!==t&&q.label===d.label))t.label=d.label;}
 if(t.label){t.sample={...d,label:t.label,rawLabel:d.label,rawScore:d.score,score:1,identityTracked:true,trackId:t.id,held:false};out.push(t.sample);}
 }
 retain(out,now);
 status=out.length?out.map(d=>(d.label==='Left'?'右手':'左手')+' #'+d.trackId+(d.held?'（短暂遮挡，保持）':d.rawLabel!==d.label?'（翻面标签已稳住）':'')).join(' · '):ds.length?'确认手的身份，请展开手掌稍停':'手暂时离开镜头';return out;
 }
 return {update,reset(){tracks=[];status='请展开手掌重新识别';},get status(){return status;}};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HandIdentity=api;
})(typeof window!=='undefined'?window:globalThis);
