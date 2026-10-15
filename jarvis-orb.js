import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

const stage=document.getElementById('orbStage');
const mount=document.getElementById('orb3d');
if(stage&&mount){
  try{
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(38,1,.1,40);
    camera.position.set(0,0,4.2);
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));
    renderer.setSize(420,420,false);
    renderer.setClearColor(0x000000,0);
    renderer.domElement.setAttribute('aria-label','Rotating three-dimensional JARVIS energy orb. Drag or use touch to rotate; scroll or pinch to zoom.');
    renderer.domElement.style.touchAction='none';
    mount.append(renderer.domElement);

    const orb=new THREE.Group();scene.add(orb);
    const shellColors=[0x1bbfff,0x68edff,0x078bff];
    [1.04,.88,.70].forEach((radius,i)=>{
      const geometry=new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(radius,i===0?2:1));
      const material=new THREE.LineBasicMaterial({color:shellColors[i],transparent:true,opacity:[.34,.24,.2][i],depthWrite:false,blending:THREE.AdditiveBlending});
      const shell=new THREE.LineSegments(geometry,material);shell.rotation.set(i*.63,i*.81,i*.37);shell.userData.base=i;orb.add(shell);
    });
    [1.18,.99,.78].forEach((r,i)=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.006,6,144),new THREE.MeshBasicMaterial({color:i===1?0xa4f7ff:0x20caff,transparent:true,opacity:.3-i*.035,depthWrite:false,blending:THREE.AdditiveBlending}));
      ring.rotation.set(Math.PI/2+i*.52,.3+i*.68,.2+i*.42);orb.add(ring);
    });
    const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
    const gctx=glowCanvas.getContext('2d');const gradient=gctx.createRadialGradient(64,64,1,64,64,64);
    gradient.addColorStop(0,'rgba(235,255,255,1)');gradient.addColorStop(.12,'rgba(111,245,255,.95)');gradient.addColorStop(.34,'rgba(18,183,255,.74)');gradient.addColorStop(.7,'rgba(0,112,255,.2)');gradient.addColorStop(1,'rgba(0,70,180,0)');gctx.fillStyle=gradient;gctx.fillRect(0,0,128,128);
    const glowTexture=new THREE.CanvasTexture(glowCanvas);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0x65eaff,transparent:true,opacity:.94,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.set(2.1,2.1,1);orb.add(glow);
    const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.42,2),new THREE.MeshBasicMaterial({color:0x8af8ff,wireframe:true,transparent:true,opacity:.78,blending:THREE.AdditiveBlending}));orb.add(core);
    const particleCount=520,positions=new Float32Array(particleCount*3);
    for(let i=0;i<particleCount;i++){const u=Math.random()*2-1,a=Math.random()*Math.PI*2,r=1.22+Math.random()*.76,s=Math.sqrt(1-u*u);positions[i*3]=r*s*Math.cos(a);positions[i*3+1]=r*u;positions[i*3+2]=r*s*Math.sin(a);}
    const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const particles=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:0x65dfff,size:.018,transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending}));orb.add(particles);

    let zoom=4.2,dragging=false,lastX=0,lastY=0,frame=0;
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const resize=()=>{const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
    const observer=new ResizeObserver(resize);observer.observe(mount);resize();
    const rotateBy=(theta,phi)=>{orb.rotation.y+=theta;orb.rotation.x=clamp(orb.rotation.x+phi,-1.25,1.25);};
    const zoomBy=factor=>{zoom=clamp(zoom*factor,2.45,6);camera.position.z=zoom;};
    const resetView=()=>{orb.rotation.set(0,0,0);zoom=4.2;camera.position.set(0,0,zoom);};
    renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
    renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;rotateBy(dx*.008,dy*.008);});
    const stopDrag=()=>dragging=false;renderer.domElement.addEventListener('pointerup',stopDrag);renderer.domElement.addEventListener('pointercancel',stopDrag);
    renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();zoomBy(e.deltaY>0?1.08:.92);},{passive:false});
    const animate=()=>{frame=requestAnimationFrame(animate);if(document.hidden)return;const t=performance.now()*.001;orb.rotation.y+=.0012;core.rotation.x+=.006;core.rotation.y-=.009;glow.material.opacity=.78+Math.sin(t*1.7)*.12;renderer.render(scene,camera);};animate();
    window.jarvisOrb3d={rotateBy,zoomBy,resetView,dispose(){cancelAnimationFrame(frame);observer.disconnect();renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});glowTexture.dispose();mount.replaceChildren();stage.classList.remove('has-3d');}};
    stage.classList.add('has-3d');
    window.addEventListener('beforeunload',()=>window.jarvisOrb3d?.dispose(),{once:true});
  }catch(error){console.warn('JARVIS 3D orb unavailable; using the built-in orb.',error);mount.replaceChildren();}
}
