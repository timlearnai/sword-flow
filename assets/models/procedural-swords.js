/* Independently generated primitives; no imported model, texture or reference image. */
(function(root){
 const mats=[
 {color:[.28,.62,.8],metal:.65,rough:.32,emis:[.1,.3,.45],emisK:.18,alpha:1},
 {color:[.8,.69,.38],metal:.8,rough:.4,emis:[0,0,0],emisK:0,alpha:1},
 {color:[.12,.16,.22],metal:.15,rough:.65,emis:[0,0,0],emisK:0,alpha:1}];
 function build(big){const m={pos:[],nrm:[],mat:[],idx:[],mats};
  function convert(p){return big?[p[0]/.7,-p[2]/.7,2.81-p[1]/.7]:[p[0],-p[2],1.06-p[1]];}
  function tri(a,b,c,material){a=convert(a);b=convert(b);c=convert(c);const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
   const start=m.mat.length;for(const p of [a,b,c]){m.pos.push(...p);m.nrm.push(...n.map(x=>x/l));m.mat.push(material);}m.idx.push(start,start+1,start+2);}
  function prism(poly,depth,material){const front=poly.map(p=>[p[0],p[1],depth/2]),back=poly.map(p=>[p[0],p[1],-depth/2]);
   for(let i=1;i<poly.length-1;i++){tri(front[0],front[i],front[i+1],material);tri(back[0],back[i+1],back[i],material);}
   for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;tri(front[i],back[i],back[j],material);tri(front[i],back[j],front[j],material);}}
  const guard=big?.92:1.05,tip=big?6:4.66,w=big?.27:.16;
  prism([[-w,guard],[w,guard],[w*.85,tip-.65],[0,tip],[-w*.85,tip-.65]],big?.1:.075,0);
  const span=big?.72:.4;prism([[-span,guard-.12],[span,guard-.12],[span,guard+.08],[-span,guard+.08]],big?.22:.13,1);
  const low=big?-.42:.16,grip=big?.095:.075;prism([[-grip,low],[grip,low],[grip,guard-.13],[-grip,guard-.13]],grip*2,2);
  const pom=big?.15:.12;prism([[-pom,low-.22],[pom,low-.22],[pom,low],[-pom,low]],pom*2,1);
  return m;}
 const big=build(true),fly=build(false);root.OPEN_MODELS={big,fly,flyLo:fly};
})(typeof window==='undefined'?globalThis:window);
