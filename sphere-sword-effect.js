(function(root){
function create(THREE,parent,worldCamera){
const scene=new THREE.Group();parent.add(scene);scene.visible=false;
const camera={position:new THREE.Vector3()};let strength=0;
scene.add(new THREE.HemisphereLight(0xd5e7ff,0x1a1308,.85));
const key=new THREE.DirectionalLight(0xffe1a0,2.1);key.position.set(-4,6,5);scene.add(key);
const fill=new THREE.DirectionalLight(0x77bcd0,1.4);fill.position.set(4,-1,-3);scene.add(fill);
const ballLight=new THREE.PointLight(0xffbd4c,2.8,13,2);scene.add(ballLight);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const rand=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const noiseGLSL=`float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}float fbm(vec3 p){float v=0.,a=.55;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec3(3.1);a*=.5;}return v;}`;
const orbMat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uHeat:{value:0},uPulse:{value:0}},transparent:true,depthWrite:false,
vertexShader:`varying vec3 vN,vV,vP;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-p.xyz;vP=position;gl_Position=projectionMatrix*p;}`,
fragmentShader:`varying vec3 vN,vV,vP;uniform float uTime,uHeat,uPulse;${noiseGLSL}
void main(){vec3 n=normalize(vN),v=normalize(vV);float facing=max(dot(n,v),0.),rim=pow(1.-facing,2.7);
 vec3 p=vP*1.9+vec3(uTime*.025,-uTime*.065,0.);float mist=fbm(p+fbm(p*1.4));
 float veins=pow(1.-abs(fbm(p*3.5)-.5)*2.,16.);float inner=pow(facing,3.);
 vec3 amber=mix(vec3(.12,.035,.006),vec3(.78,.31,.038),smoothstep(.25,.78,mist));
 vec3 c=amber*(.6+inner*.5)+vec3(1.,.57,.14)*rim*(1.3+uHeat*.5)+vec3(.60,.24,.018)*veins*.12;
 c+=vec3(1.,.72,.24)*uPulse*(rim*.50+veins*.18);
 gl_FragColor=vec4(c,.035+rim*.34);}`});
const R=1.35,orb=new THREE.Mesh(new THREE.SphereGeometry(R,80,56),orbMat);orb.renderOrder=4;scene.add(orb);
// A restrained atmospheric halo, with the surface left readable.
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=256;const gx=glowCanvas.getContext('2d'),gr=gx.createRadialGradient(128,128,45,128,128,128);gr.addColorStop(0,'rgba(255,178,50,0)');gr.addColorStop(.38,'rgba(255,145,25,.11)');gr.addColorStop(.7,'rgba(255,95,8,.035)');gr.addColorStop(1,'rgba(255,80,0,0)');gx.fillStyle=gr;gx.fillRect(0,0,256,256);
const haloMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending});const halo=new THREE.Sprite(haloMat);halo.scale.set(6,6,1);halo.renderOrder=3;scene.add(halo);
const model=OPEN_MODELS.fly,geo=new THREE.BufferGeometry(),pos=new Float32Array(model.pos.length),nrm=new Float32Array(model.nrm.length);
const L=4.66;
for(let i=0;i<pos.length;i+=3){pos[i]=model.pos[i]/L;pos[i+1]=(1.06-model.pos[i+2])/L-.5;pos[i+2]=-model.pos[i+1]/L;nrm[i]=model.nrm[i];nrm[i+1]=-model.nrm[i+2];nrm[i+2]=-model.nrm[i+1];}
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nrm,3));
const indices=[];for(let m=0;m<model.mats.length;m++){const start=indices.length;for(let j=0;j<model.idx.length;j+=3)if(model.mat[model.idx[j]]===m)indices.push(model.idx[j],model.idx[j+1],model.idx[j+2]);if(indices.length>start)geo.addGroup(start,indices.length-start,m);}geo.setIndex(indices);
const materials=model.mats.map(m=>{const c=new THREE.Color(...m.color).convertSRGBToLinear(),e=new THREE.Color(...m.emis).convertSRGBToLinear();return new THREE.MeshStandardMaterial({color:c,metalness:Math.min(.85,m.metal),roughness:Math.max(.28,m.rough),emissive:e,emissiveIntensity:Math.min(m.emisK,.5),side:THREE.DoubleSide});});
const COUNT=600,PER=58,mesh=new THREE.InstancedMesh(geo,materials,COUNT);mesh.frustumCulled=false;scene.add(mesh);

// Eight visible miniature swords converge into each medium sword (4,640 total).
const MINI=8,miniGeo=new THREE.BufferGeometry();
const silhouette=[0,.5, -.07,.30, -.055,-.22, -.17,-.25, -.17,-.30, -.035,-.30, -.035,-.48, .035,-.48, .035,-.30, .17,-.30, .17,-.25, .055,-.22, .07,.30];
const miniVertices=[];for(let j=0;j<silhouette.length/2;j++){const k=(j+1)%(silhouette.length/2);miniVertices.push(0,0,0,silhouette[j*2],silhouette[j*2+1],0,silhouette[k*2],silhouette[k*2+1],0);}
miniGeo.setAttribute('position',new THREE.Float32BufferAttribute(miniVertices,3));
const minis=new THREE.InstancedMesh(miniGeo,new THREE.MeshBasicMaterial({color:0x67ddcc,side:THREE.DoubleSide}),COUNT*MINI);minis.frustumCulled=false;scene.add(minis);
const miniMatrix=new THREE.Matrix4(),miniP=new THREE.Vector3(),miniScale=new THREE.Vector3();

const axes=Array.from({length:5},(_,i)=>{const a=i*Math.PI/5;return new THREE.Vector3(Math.sin(a),.15,Math.cos(a)).normalize();});
const rings=axes.map(n=>{const u=new THREE.Vector3().crossVectors(n,new THREE.Vector3(0,0,1)).normalize();return{n,u,v:new THREE.Vector3().crossVectors(n,u).normalize()};});
const centers=Array.from({length:COUNT},()=>new THREE.Vector3()),tips=centers.map(()=>new THREE.Vector3());
const matrix=new THREE.Matrix4(),side=new THREE.Vector3(),front=new THREE.Vector3(),dir=new THREE.Vector3(),view=new THREE.Vector3(),q=new THREE.Quaternion(),swordScale=new THREE.Vector3();
// Dynamic ribbon geometry gives narrow electric cores and a softer amber fringe.
const MAX_SEG=5000,corePos=new Float32Array(MAX_SEG*18),haloPos=new Float32Array(MAX_SEG*18),coreCol=new Float32Array(MAX_SEG*18),haloCol=new Float32Array(MAX_SEG*18);
function ribbons(p,c){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.BufferAttribute(c,3).setUsage(THREE.DynamicDrawUsage));const m=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});const o=new THREE.Mesh(g,m);o.frustumCulled=false;scene.add(o);return o;}
const electricPalettes={
 gold:{core:[1.8,1.24,.52],glow:[.17,.062,.008],light:0xffbd4c},
 purple:{core:[1.35,.48,2.3],glow:[.12,.018,.23],light:0xb866ff},
 green:{core:[.52,1.85,.85],glow:[.016,.18,.052],light:0x55ff99},
 blue:{core:[.5,1.18,2.4],glow:[.012,.075,.24],light:0x55aaff}
};
let electricPalette=electricPalettes.gold,electricMode="mixed",boltColorIndex=0;
const electricKeys=["gold","gold","purple","gold","gold","green","gold","gold","blue","gold"];
const arcGlow=ribbons(haloPos,haloCol),arcs=ribbons(corePos,coreCol);arcGlow.renderOrder=5;arcs.renderOrder=6;let segmentCount=0;
function segment(a,b,energy,width){if(segmentCount>=MAX_SEG)return;if(electricMode==="mixed"){const main=electricPalette===electricPalettes.gold;energy*=main?1.15:.60;width*=main?1.35:.65;}const tangent=new THREE.Vector3().subVectors(b,a),mid=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5),toward=new THREE.Vector3().subVectors(camera.position,mid),s=new THREE.Vector3().crossVectors(tangent,toward).normalize();
 for(let layer=0;layer<2;layer++){const data=layer?haloPos:corePos,colors=layer?haloCol:coreCol,w=width*(layer?4.5:1),rgb=(layer?electricPalette.glow:electricPalette.core).map(c=>c*energy),o=segmentCount*18;
 const pts=[[a,1],[a,-1],[b,1],[b,1],[a,-1],[b,-1]];for(let j=0;j<6;j++){const p=pts[j][0],sign=pts[j][1];data[o+j*3]=p.x+s.x*w*sign;data[o+j*3+1]=p.y+s.y*w*sign;data[o+j*3+2]=p.z+s.z*w*sign;colors.set(rgb,o+j*3);}}
 segmentCount++;
}
function bolt(a,b,seed,t,energy,bend=.15,branch=true,surface=false,inherited=false){if(energy<.03)return;if(electricMode==="mixed"&&!inherited)electricPalette=electricPalettes[electricKeys[(boltColorIndex++)%electricKeys.length]];const d=new THREE.Vector3().subVectors(b,a),axis=d.clone().normalize(),u=new THREE.Vector3().crossVectors(axis,new THREE.Vector3(.2,1,.3)).normalize(),v=new THREE.Vector3().crossVectors(axis,u),steps=22;let prev=a.clone(),fork;
 const tick=Math.floor(t*23);for(let j=1;j<=steps;j++){const f=j/steps,p=a.clone().addScaledVector(d,f),amp=Math.sin(f*Math.PI)*bend;
 p.addScaledVector(u,(rand(seed+j*1.7+tick*.23)-.5)*amp*2).addScaledVector(v,(rand(seed+j*2.9+tick*.17)-.5)*amp*2);
 if(surface)p.normalize().multiplyScalar(R*1.013);segment(prev,p,energy,.0045+energy*.0015);prev=p;if(j===12)fork=p.clone();}
 if(branch&&fork){const target=fork.clone().addScaledVector(u,.22+rand(seed)*.25).addScaledVector(d,.22);bolt(fork,target,seed+80,t,energy*.6,bend*.6,false,surface,true);}
}
// Fine charged motes are local to the sphere, rather than a busy full-screen star field.
const moteCount=200,moteGeo=new THREE.BufferGeometry(),motePos=new Float32Array(moteCount*3);moteGeo.setAttribute('position',new THREE.BufferAttribute(motePos,3));const motes=new THREE.Points(moteGeo,new THREE.PointsMaterial({color:0xeabb69,size:.018,transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(motes);
function draw(t){
 const gather=smooth(0,3,t),heat=smooth(3,3.3,t)*Math.pow(strength,1.65),expand=1-strength,radius=2.12+(1-strength)*2.02;
 const rotation=t*.25;let visibleCount=0;
 for(let i=0;i<COUNT;i++){
  const ringIndex=Math.floor(i/PER),j=i%PER,batch=Math.floor(i/3);
  const born=batch/(Math.ceil(COUNT/3)-1)*2.1,merge=smooth(born,born+.90,t),show=smooth(born+.55,born+.90,t);
  if(t>=born+.90)visibleCount++;
  const angle=j/PER*Math.PI*2+rotation,p=centers[i];
  const ringDir=new THREE.Vector3(Math.cos(angle),Math.sin(angle),0);
  const y=1-2*(i+.5)/COUNT,phi=i*2.399963229728653+rotation;
  const sphereDir=new THREE.Vector3(Math.cos(phi)*Math.sqrt(1-y*y),y,Math.sin(phi)*Math.sqrt(1-y*y));
  const unfold=smooth(.55,3,t);
  p.copy(ringDir).lerp(sphereDir,unfold).normalize().multiplyScalar(radius);
  dir.copy(p).normalize().negate();view.copy(camera.position).sub(p).normalize();side.crossVectors(dir,view).normalize();front.crossVectors(side,dir).normalize();matrix.makeBasis(side,dir,front);q.setFromRotationMatrix(matrix);
  const scale=.84*show;swordScale.set(scale,scale,scale);matrix.compose(p,q,swordScale);mesh.setMatrixAt(i,matrix);tips[i].copy(p).addScaledVector(dir,scale*.5);
  for(let k=0;k<MINI;k++){
   const a=k/MINI*Math.PI*2+i*.63,spread=(1-merge)*(1.2+rand(i*8+k)*1.5);
   miniP.copy(p).addScaledVector(side,Math.cos(a)*spread).addScaledVector(front,Math.sin(a)*spread).addScaledVector(dir,-(1-merge)*(1.2+rand(i+k)*2.8));
   miniP.addScaledVector(dir,(k/(MINI-1)-.5)*.64*merge);
   const size=t>=born&&merge<1?.19*(1-smooth(.72,1,merge)):0;
   miniScale.setScalar(size);miniMatrix.compose(miniP,q,miniScale);minis.setMatrixAt(i*MINI+k,miniMatrix);
  }

 }

 mesh.instanceMatrix.needsUpdate=true;minis.instanceMatrix.needsUpdate=true;
 segmentCount=0;boltColorIndex=0;let pulse=0;
 // Quiet sphere flashes: long rest intervals and short, asymmetric bursts.
 for(let event=0;event<3;event++){const start=[1.1,4.3,7.1][event],age=t-start,e=age>=0&&age<.42?Math.exp(-age*9)*(0.6+0.4*Math.sin(age*95)**2):0;pulse=Math.max(pulse,e);if(e>.025){for(let j=0;j<3;j++){const ring=rings[(event+j)%5],a=ring.u.clone().multiplyScalar(R),b=ring.u.clone().multiplyScalar(Math.cos(1.5+j*.4)).addScaledVector(ring.v,Math.sin(1.5+j*.4)).multiplyScalar(R);bolt(a,b,event*91+j*23,t,e*.70,.20,true,true);}}}
 if(heat>.005){const activity=.08+.68*heat;
  for(let i=0;i<48;i++){const cycle=t*(1.6+heat*.9)+i*.713,local=cycle-Math.floor(cycle);if(local>activity)continue;const envelope=Math.sin(Math.PI*local/activity)**.65,energy=envelope*heat*(.7+strength*.65),index=(i*17+Math.floor(cycle)*13)%COUNT;
   const a=tips[index],b=i%3===0?tips[(index+1)%COUNT]:a.clone().normalize().multiplyScalar(R*1.01);bolt(a,b,i*47+Math.floor(cycle)*23,t,energy,.10+strength*.13,strength>.4);
  }
 }
 for(const obj of [arcs,arcGlow]){obj.geometry.setDrawRange(0,segmentCount*6);obj.geometry.attributes.position.needsUpdate=true;obj.geometry.attributes.color.needsUpdate=true;}
 orbMat.uniforms.uTime.value=t;orbMat.uniforms.uHeat.value=heat;orbMat.uniforms.uPulse.value=pulse;haloMat.opacity=.16+heat*.15+pulse*.07;ballLight.intensity=2.8+heat*1.6+pulse*.5;
 for(let i=0;i<moteCount;i++){const a=rand(i+8)*Math.PI*2+t*(.08+heat*.35),y=(rand(i+2)*2-1)*1.2,r=R+.15+rand(i+90)*(.4+heat*.7);motePos[i*3]=Math.cos(a)*Math.sqrt(Math.max(.1,r*r-y*y));motePos[i*3+1]=y;motePos[i*3+2]=Math.sin(a)*Math.sqrt(Math.max(.1,r*r-y*y));}moteGeo.attributes.position.needsUpdate=true;motes.material.opacity=.16+heat*.24;
}

let burstStart=-Infinity,lastDrawT=0;
const burstCenters=centers.map(()=>new THREE.Vector3());
const waveMat=new THREE.MeshBasicMaterial({color:0xffcc66,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0,side:THREE.DoubleSide});
const wave=new THREE.Mesh(new THREE.TorusGeometry(1,.025,6,160),waveMat);scene.add(wave);wave.visible=false;
const shardGeometry=new THREE.BufferGeometry();shardGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.1,-.1,0,.12,-.08,0,0,.16,0],3));
const shardMat=new THREE.MeshBasicMaterial({color:0xffd780,transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
const shards=new THREE.InstancedMesh(shardGeometry,shardMat,240);shards.frustumCulled=false;shards.visible=false;scene.add(shards);
function renderBurst(age){
 const fade=1-smooth(.7,1.8,age);orb.visible=false;minis.visible=false;mesh.visible=true;wave.visible=true;shards.visible=true;
 segmentCount=0;boltColorIndex=0;
 for(let i=0;i<COUNT;i++){
  const outward=burstCenters[i].clone().normalize(),p=burstCenters[i].clone().addScaledVector(outward,age*(5+rand(i)*5));
  dir.copy(outward);view.copy(camera.position).sub(p).normalize();side.crossVectors(dir,view).normalize();front.crossVectors(side,dir).normalize();matrix.makeBasis(side,dir,front);q.setFromRotationMatrix(matrix);q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),age*(rand(i+31)-.5)*8));swordScale.setScalar(.84*fade);matrix.compose(p,q,swordScale);mesh.setMatrixAt(i,matrix);
  if(i%15===0&&age<1.25){const a=outward.clone().multiplyScalar(R+age*4),b=outward.clone().multiplyScalar(R+age*10+1);bolt(a,b,i*37,age,(1-age/1.25)*1.8,.45,true);}
 }
 mesh.instanceMatrix.needsUpdate=true;
 for(let i=0;i<240;i++){const y=1-2*(i+.5)/240,a=i*2.39996,p=new THREE.Vector3(Math.cos(a)*Math.sqrt(1-y*y),y,Math.sin(a)*Math.sqrt(1-y*y)).multiplyScalar(R+age*(3+rand(i+67)*5));q.setFromAxisAngle(p.clone().normalize(),age*7+i);swordScale.setScalar((.4+rand(i))*fade);matrix.compose(p,q,swordScale);shards.setMatrixAt(i,matrix);}shards.instanceMatrix.needsUpdate=true;shardMat.opacity=fade*.8;
 wave.scale.setScalar(R+age*10);waveMat.opacity=Math.exp(-age*3)*.8;
 halo.scale.setScalar(6+age*10);haloMat.opacity=Math.exp(-age*5)*.7;
 for(const obj of [arcs,arcGlow]){obj.geometry.setDrawRange(0,segmentCount*6);obj.geometry.attributes.position.needsUpdate=true;obj.geometry.attributes.color.needsUpdate=true;}
}
return {group:scene,explode(){burstStart=performance.now();for(let i=0;i<COUNT;i++)burstCenters[i].copy(centers[i]);},update({active,phase,time,strength:power,position,radius}){
const age=(performance.now()-burstStart)/1000;
if(age<1.8){scene.visible=true;camera.position.copy(worldCamera.position);scene.worldToLocal(camera.position);renderBurst(age);return;}
scene.visible=active;if(!active)return;
wave.visible=shards.visible=false;orb.visible=true;halo.scale.set(6,6,1);
scene.position.copy(position);scene.scale.setScalar(radius/R);scene.updateMatrixWorld(true);
camera.position.copy(worldCamera.position);scene.worldToLocal(camera.position);strength=power;
mesh.visible=phase!=='waiting';minis.visible=false;
lastDrawT=phase==='waiting'?0:phase==='forming'?Math.min(3,time):3.3+(time%5);draw(lastDrawT);
}};
}root.SphereSwordEffect={create};
})(window);
