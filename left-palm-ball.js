(function(root){
  function createTracker(G){
    const core=G.create({HAND:'left'});
    let state={active:false,seen:false,lm:null,updatedAt:-Infinity};
    return {core,get state(){return state;},update(dets,now){
      const left=dets.filter(d=>d.label==='Right');
      const hand=left.length===1?left[0]:null;
      if(hand?.held){core.suspend();state={...state,seen:false,updatedAt:now};return state;}
      if(hand)core.update(hand.lm,now,hand.world,hand.label);else core.lost(now);
      state={active:!!hand&&core.s.palmUp,seen:!!hand,lm:hand?.lm||null,updatedAt:now};return state;
    }};
  }
  function create(THREE,G,scene){
    const tracker=createTracker(G),group=new THREE.Group();scene.add(group);group.visible=false;
    const radius=1.7,material=new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0},uOpacity:{value:0}},transparent:true,depthWrite:false,depthTest:true,side:THREE.FrontSide,
      vertexShader:`varying vec3 vNormal,vView,vLocal;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=-p.xyz;vLocal=position;gl_Position=projectionMatrix*p;}`,
      fragmentShader:`uniform float uTime,uOpacity;varying vec3 vNormal,vView,vLocal;
      void main(){vec3 n=normalize(vNormal),v=normalize(vView);float rim=pow(1.-max(dot(n,v),0.),2.1);
        float cloud=.5+.5*sin(vLocal.x*5.+sin(vLocal.y*7.+uTime*.7)+vLocal.z*4.);
        float veins=pow(.5+.5*sin(vLocal.y*17.+sin(vLocal.x*9.+uTime)*1.3-uTime*.8),20.);
        float light=pow(max(dot(n,normalize(vec3(-.5,.7,1.))),0.),28.);
        vec3 color=mix(vec3(.32,.12,.015),vec3(1.,.72,.19),rim);
        color+=vec3(1.,.62,.10)*(veins*.14+cloud*.07)+vec3(1.,.9,.55)*light*.28;
        gl_FragColor=vec4(color,(.12+rim*.58+cloud*.035+veins*.06)*uOpacity);
      }`
    });
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(radius,48,32),material);sphere.renderOrder=4;group.add(sphere);
    // Branching lightning ribbons on the sphere; broad amber glow plus a thin gold-white core.
    const segments=[],arcCount=16,steps=38;
    const rand=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
    const arcs=Array.from({length:arcCount},(_,i)=>{
      const normal=new THREE.Vector3(rand(i+1)*2-1,rand(i+31)*2-1,rand(i+71)*2-1).normalize();
      const u=new THREE.Vector3().crossVectors(normal,new THREE.Vector3(0,1,0));if(u.lengthSq()<.01)u.set(1,0,0);u.normalize();
      return {u,v:new THREE.Vector3().crossVectors(normal,u).normalize(),normal,start:rand(i+91)*Math.PI*2,length:1.0+rand(i+111)*1.8,seed:i*19.7};
    });
    // Main bolts plus a short fork off each bolt.
    const count=arcCount*(steps+10),positions=new Float32Array(count*18),glowPositions=new Float32Array(count*18);
    const geo=new THREE.BufferGeometry(),glowGeo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    glowGeo.setAttribute('position',new THREE.BufferAttribute(glowPositions,3).setUsage(THREE.DynamicDrawUsage));
    const boltMat=new THREE.MeshBasicMaterial({color:0xffe5a0,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const glowMat=new THREE.MeshBasicMaterial({color:0xffa51f,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const bolts=new THREE.Mesh(geo,boltMat),boltGlow=new THREE.Mesh(glowGeo,glowMat);bolts.frustumCulled=boltGlow.frustumCulled=false;bolts.renderOrder=6;boltGlow.renderOrder=5;group.add(boltGlow,bolts);
    function updateBolts(t){
      let offset=0;
      const write=(out,a,b,width)=>{const tangent=new THREE.Vector3().subVectors(b,a),mid=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5),view=new THREE.Vector3(-group.position.x-mid.x,-group.position.y-mid.y,10-mid.z).normalize();
        const side=new THREE.Vector3().crossVectors(tangent,view).normalize().multiplyScalar(width);
        const vs=[a.clone().add(side),a.clone().sub(side),b.clone().add(side),b.clone().add(side),a.clone().sub(side),b.clone().sub(side)];
        for(let j=0;j<6;j++)vs[j].toArray(out,offset+j*3);
      };
      const emit=(a,b)=>{write(positions,a,b,.009);write(glowPositions,a,b,.035);offset+=18;};
      for(const arc of arcs){let prev=null,fork=null;
        for(let j=0;j<=steps;j++){const f=j/steps,phase=arc.start+arc.length*f+t*.07;
          const jag=(rand(j+arc.seed+Math.floor(t*9)*.137)-.5)*.10*Math.sin(Math.PI*f);
          const point=arc.u.clone().multiplyScalar(Math.cos(phase)).addScaledVector(arc.v,Math.sin(phase)).addScaledVector(arc.normal,jag).normalize().multiplyScalar(radius*1.014);
          if(prev)emit(prev,point);prev=point;if(j===Math.floor(steps*.55))fork=point.clone();}
        prev=fork;for(let j=1;j<=10;j++){const point=fork.clone().addScaledVector(arc.normal,j*.036).addScaledVector(arc.u,(rand(j+arc.seed+Math.floor(t*9))-.5)*.07).normalize().multiplyScalar(radius*1.018);emit(prev,point);prev=point;}
      }
      geo.attributes.position.needsUpdate=true;glowGeo.attributes.position.needsUpdate=true;
    }
    const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;const hx=haloCanvas.getContext('2d'),gradient=hx.createRadialGradient(64,64,30,64,64,64);
    gradient.addColorStop(0,'rgba(255,185,40,0)');gradient.addColorStop(.36,'rgba(255,177,30,.16)');gradient.addColorStop(.65,'rgba(255,143,15,.055)');gradient.addColorStop(1,'rgba(255,120,0,0)');hx.fillStyle=gradient;hx.fillRect(0,0,128,128);
    const haloMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(haloCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0});
    const halo=new THREE.Sprite(haloMat);halo.scale.set(radius*3.2,radius*3.2,1);halo.renderOrder=3;group.add(halo);
    let boltTick=-1;
    let visibility=0,elapsed=0,placed=false;
    return {tracker,group,radius,update(dets,now){tracker.update(dets,now);},tick(dt,halfW,halfH){
      elapsed+=dt;const s=tracker.state,on=s.active&&performance.now()-s.updatedAt<600;
      visibility+=((on?1:0)-visibility)*(1-Math.exp(-dt*(on?9:7)));
      if(s.seen&&s.lm){const ids=[0,5,9,13,17];let x=0,y=0;for(const i of ids){x+=s.lm[i].x/5;y+=s.lm[i].y/5;}
        // The base of the sphere rests just above the mirrored palm center.
        const tx=(1-2*x)*halfW,ty=(1-2*y)*halfH+radius+.12;
        if(on&&!placed){group.position.set(tx,ty,0);placed=true;}
        if(placed){const k=1-Math.exp(-dt*12);group.position.x+=(tx-group.position.x)*k;group.position.y+=(ty-group.position.y)*k;}
      }
      if(visibility<.005&&!on)placed=false;
      group.visible=visibility>.005;group.scale.setScalar(.85+.15*visibility);
      material.uniforms.uOpacity.value=visibility;material.uniforms.uTime.value=elapsed;
      boltMat.opacity=visibility*(.70+.20*Math.sin(elapsed*13.));glowMat.opacity=visibility*.14;haloMat.opacity=visibility;
      if(group.visible&&Math.floor(elapsed*18)!==boltTick){boltTick=Math.floor(elapsed*18);updateBolts(elapsed);}
      return {active:on,visible:group.visible,seen:s.seen};
    }};
  }
  // A close approach is held briefly to reject one-frame position noise; latch until either action ends.
  function createEnclosure(){let held=0,attached=false,blend=0;return {step(dt,options){
    const eligible=options.ballActive&&options.vortexActive&&options.rightPresent&&!options.arrayActive;
    if(!eligible){held=0;attached=false;}
    else if(!attached){held=options.distance<options.radius+1.0?held+dt:0;if(held>=.25)attached=true;}
    blend+=((attached?1:0)-blend)*(1-Math.exp(-dt*(attached?2.8:4.5)));
    return {attached,blend};
  }};}
  const api={createTracker,create,createEnclosure};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LeftPalmBall=api;
})(this);
