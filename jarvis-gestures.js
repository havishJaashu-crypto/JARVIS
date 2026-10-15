const VISION_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs';
const WASM_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export async function startHandControl(video,overlay,onStatus=()=>{}){
  const {FilesetResolver,HandLandmarker}=await import(VISION_URL);
  const fileset=await FilesetResolver.forVisionTasks(WASM_URL);
  const options={baseOptions:{modelAssetPath:MODEL_URL,delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6};
  let landmarker;
  try{landmarker=await HandLandmarker.createFromOptions(fileset,options);}catch{landmarker=await HandLandmarker.createFromOptions(fileset,{...options,baseOptions:{modelAssetPath:MODEL_URL,delegate:'CPU'}});}
  const ctx=overlay.getContext('2d');let running=true,raf=0,lastTime=-1,prevMode='idle',prevGrab=null,prevDistance=null;
  const states=new Map();
  const loop=()=>{
    if(!running)return;raf=requestAnimationFrame(loop);
    if(video.readyState<2||video.currentTime===lastTime)return;lastTime=video.currentTime;
    const result=landmarker.detectForVideo(video,performance.now()),hands=result.landmarks||[],labels=result.handedness?.map(h=>h[0]?.categoryName||'?')||[],grabs=[],seen=new Set();
    hands.forEach((lm,i)=>{
      const label=labels[i];seen.add(label);const scale=distance(lm[0],lm[9]);if(scale<1e-6)return;
      const ratio=distance(lm[4],lm[8])/scale;let s=states.get(label)||{pinching:false,grab:{x:1-(lm[4].x+lm[8].x)/2,y:(lm[4].y+lm[8].y)/2}};
      if(s.pinching&&ratio>.45)s.pinching=false;else if(!s.pinching&&ratio<.32)s.pinching=true;
      const raw={x:1-(lm[4].x+lm[8].x)/2,y:(lm[4].y+lm[8].y)/2};s.grab={x:s.grab.x+(raw.x-s.grab.x)*.4,y:s.grab.y+(raw.y-s.grab.y)*.4};states.set(label,s);if(s.pinching)grabs.push(s.grab);
    });
    for(const key of states.keys())if(!seen.has(key))states.delete(key);
    const mode=grabs.length>1?'zoom':grabs.length===1?'spin':'idle';
    if(mode!==prevMode){prevGrab=null;prevDistance=null;prevMode=mode;}
    if(mode==='spin'){if(prevGrab)window.jarvisOrb3d?.rotateBy((grabs[0].x-prevGrab.x)*5,(grabs[0].y-prevGrab.y)*5);prevGrab=grabs[0];}
    if(mode==='zoom'){const d=distance(grabs[0],grabs[1]);if(prevDistance&&d>1e-4)window.jarvisOrb3d?.zoomBy(Math.max(.85,Math.min(1.18,prevDistance/d)));prevDistance=d;}
    if(ctx){ctx.clearRect(0,0,overlay.width,overlay.height);hands.forEach(lm=>{const a={x:(1-lm[4].x)*overlay.width,y:lm[4].y*overlay.height},b={x:(1-lm[8].x)*overlay.width,y:lm[8].y*overlay.height},pinch=distance(lm[4],lm[8])/Math.max(1e-6,distance(lm[0],lm[9]))<.32;ctx.strokeStyle=pinch?'#51ffc6':'rgba(37,213,255,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();[a,b].forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,pinch?5:3,0,Math.PI*2);ctx.fillStyle=pinch?'#51ffc6':'#25d5ff';ctx.fill();});});}
    onStatus(hands.length?`${hands.length} hand${hands.length>1?'s':''} detected · ${mode.toUpperCase()}`:'Show your hand to the camera');
  };
  loop();
  return{stop(){running=false;cancelAnimationFrame(raf);landmarker.close();states.clear();ctx?.clearRect(0,0,overlay.width,overlay.height);onStatus('Hand gestures paused.');}};
}
