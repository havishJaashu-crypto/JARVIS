(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const storeKey = 'jarvis.web.v1';
  let data = loadData(), wakeEnabled = false, mode = 'stopped', recognizer = null, autoLanguage = 'en-IN', commandTimeout = null, voices = [], stream = null, micStream = null, micAudioContext = null, micAnalyser = null, micMeterFrame = 0, micTestActive = false, selectedMicId = localStorage.getItem('jarvis.web.microphone.v1') || '', wakeStartPending = false;

  function loadData(){ try { return Object.assign({messages:[],memories:[]},JSON.parse(localStorage.getItem(storeKey)||'{}')); } catch { return {messages:[],memories:[]}; } }
  function saveData(){ try { localStorage.setItem(storeKey,JSON.stringify(data)); } catch { setStatus('LOCAL STORAGE FULL'); } }
  function setMicrophoneStatus(text){ $('microphoneStatus').textContent=text; }
  function microphoneErrorMessage(error){
    const name=error?.name||'';
    if(name==='NotAllowedError'||name==='PermissionDeniedError')return 'Microphone permission was denied. Allow Microphone for this site in your browser settings, then try again.';
    if(name==='NotFoundError'||name==='DevicesNotFoundError')return 'No microphone was found. Connect or enable one in Windows Sound settings, then refresh this list.';
    if(name==='NotReadableError'||name==='TrackStartError')return 'The microphone is busy or unavailable. Close other apps using it and try again.';
    if(name==='OverconstrainedError'||name==='ConstraintNotSatisfiedError')return 'That microphone is no longer available. Choose another input or System default.';
    if(!window.isSecureContext)return 'Microphone access needs the secure HTTPS website. Open the JARVIS link beginning with https://.';
    if(!navigator.mediaDevices?.getUserMedia)return 'This browser does not provide microphone capture. Open JARVIS in current Chrome or Edge.';
    return 'Microphone could not start'+(error?.message?': '+error.message:'.');
  }
  async function refreshMicrophoneList(quiet=false){
    const select=$('microphoneSelect'), wanted=selectedMicId||select.value;
    if(!navigator.mediaDevices?.enumerateDevices){
      select.disabled=true;
      if(!quiet)setMicrophoneStatus(microphoneErrorMessage({name:'NotSupportedError'}));
      return;
    }
    try{
      const devices=await navigator.mediaDevices.enumerateDevices();
      const inputs=devices.filter(d=>d.kind==='audioinput');
      select.replaceChildren(new Option('System default microphone',''));
      inputs.forEach((device,i)=>select.add(new Option(device.label||('Microphone '+(i+1)+' · allow access to identify'),device.deviceId)));
      if(wanted&&!Array.from(select.options).some(o=>o.value===wanted))select.add(new Option('Saved microphone unavailable · choose another',wanted));
      select.value=wanted||'';
      if(!quiet&&!inputs.length)setMicrophoneStatus('No microphone is visible yet. Click Test selected mic, allow access, then refresh.');
      else if(!quiet)setMicrophoneStatus(inputs.some(d=>d.label)?'Microphones found. Choose one, then test it.':'Only default inputs are visible until microphone permission is granted.');
    }catch(error){
      if(!quiet)setMicrophoneStatus('Could not list microphones: '+(error.message||error.name));
    }
  }
  async function captureSelectedMicrophone(){
    if(micStream?.getAudioTracks().some(track=>track.readyState==='live'))return micStream.getAudioTracks().find(track=>track.readyState==='live');
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error(microphoneErrorMessage({name:!window.isSecureContext?'SecurityError':'NotSupportedError'}));
    const audio={echoCancellation:true,noiseSuppression:true,autoGainControl:true};
    if(selectedMicId)audio.deviceId={exact:selectedMicId};
    micStream=await navigator.mediaDevices.getUserMedia({audio,video:false});
    const track=micStream.getAudioTracks().find(item=>item.readyState==='live');
    if(!track){stopMicrophoneCapture();throw new Error('The selected device opened without a live audio track. Choose another microphone.');}
    track.addEventListener('ended',()=>{if(micStream?.getAudioTracks().includes(track)){setMicrophoneStatus('The microphone disconnected. Reconnect it and refresh the list.');if(wakeEnabled)disableWake();}});
    const actual=track.getSettings?.().deviceId;
    if(actual&&selectedMicId&&actual!==selectedMicId){setMicrophoneStatus('The browser opened a different input than requested. Check microphone selection in browser settings.');}
    else setMicrophoneStatus('Microphone connected: '+(track.label||$('microphoneSelect').selectedOptions[0]?.text||'System default')+'.');
    await refreshMicrophoneList(true);
    return track;
  }
  function stopMicrophoneMeter(){
    micTestActive=false;
    if(micMeterFrame)cancelAnimationFrame(micMeterFrame);
    micMeterFrame=0;
    if(micAudioContext){micAudioContext.close().catch(()=>{});micAudioContext=null;micAnalyser=null;}
    $('testMicrophone').textContent='TEST SELECTED MIC';
    $('micMeterFill').style.width='0%';
    $('micMeter').setAttribute('aria-valuenow','0');
  }
  function stopMicrophoneCapture(){
    stopMicrophoneMeter();
    if(micStream){micStream.getTracks().forEach(track=>track.stop());micStream=null;}
  }
  function startMicrophoneMeter(){
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass){setMicrophoneStatus('Microphone is connected, but this browser cannot show an input level meter.');return;}
    micAudioContext=new AudioContextClass();
    micAnalyser=micAudioContext.createAnalyser();
    micAnalyser.fftSize=512;
    micAudioContext.createMediaStreamSource(micStream).connect(micAnalyser);
    micAudioContext.resume().catch(()=>{});
    const samples=new Uint8Array(micAnalyser.fftSize);
    const draw=()=>{
      if(!micTestActive||!micAnalyser)return;
      micAnalyser.getByteTimeDomainData(samples);
      let sum=0;for(const sample of samples){const value=(sample-128)/128;sum+=value*value;}
      const level=Math.min(100,Math.round(Math.sqrt(sum/samples.length)*420));
      $('micMeterFill').style.width=level+'%';
      $('micMeter').setAttribute('aria-valuenow',String(level));
      setMicrophoneStatus(level>2?'Input detected · live level '+level+'%. Speak now.':'Microphone is active. Speak toward it to see the level.');
      micMeterFrame=requestAnimationFrame(draw);
    };
    draw();
  }
  async function testSelectedMicrophone(){
    if(micTestActive){
      stopMicrophoneMeter();
      if(!wakeEnabled&&mode==='stopped')stopMicrophoneCapture();
      setMicrophoneStatus('Microphone test stopped. Capture is off.');
      return;
    }
    $('testMicrophone').disabled=true;
    try{
      await captureSelectedMicrophone();
      micTestActive=true;
      $('testMicrophone').textContent='STOP MIC TEST';
      setMicrophoneStatus('Microphone is active. Speak now to check the input level.');
      startMicrophoneMeter();
    }catch(error){
      setMicrophoneStatus(microphoneErrorMessage(error));
    }finally{$('testMicrophone').disabled=false;}
  }
  function handleMicrophoneStartError(error){
    const message=error instanceof TypeError||error?.name==='NotSupportedError'
      ?'This browser could not start speech recognition with the selected microphone. Mic test can still confirm capture; try current Chrome or choose System default.'
      :microphoneErrorMessage(error);
    wakeEnabled=false;mode='stopped';wakeStartPending=false;setStatus('MICROPHONE UNAVAILABLE');$('voiceState').textContent='CHECK INPUT';setMicrophoneStatus(message);logMessage('SYSTEM',message,false);
    if(!micTestActive)stopMicrophoneCapture();
  }
  function setStatus(text, listening=false){ $('statusText').textContent=text; $('orbState').textContent=text; $('statusLed').classList.toggle('active',listening); $('orbStage').classList.toggle('listening',listening); $('wakeLabel').textContent=wakeEnabled?'WAKE WORD ACTIVE':'ENABLE WAKE WORD'; $('wakeToggle').setAttribute('aria-pressed',String(wakeEnabled)); $('micButton').classList.toggle('active',listening); }
  function logMessage(who,text,save=true,link=null){
    const article=document.createElement('article'); article.className='message '+(who==='YOU'?'user-message':'jarvis-message');
    const tag=document.createElement('span'); tag.className='message-tag'; tag.textContent=who==='YOU'?'YOU':(who==='SYSTEM'?'SYSTEM':'JARVIS'); article.append(tag);
    const p=document.createElement('p'); p.textContent=text; article.append(p);
    if(link){const a=document.createElement('a');a.className='search-result';a.href=link.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=link.label;article.append(a);}
    $('transcript').append(article); $('transcript').scrollTop=$('transcript').scrollHeight;
    if(save && (who==='YOU'||who==='JARVIS')){data.messages.push({who,text,at:Date.now()});data.messages=data.messages.slice(-80);saveData();}
  }
  function renderHistory(){ for(const m of data.messages.slice(-30)) logMessage(m.who,m.text,false); }
  function refreshMemory(){ $('memoryCount').textContent=`${data.memories.length} ITEM${data.memories.length===1?'':'S'}`; const list=$('memoryList');list.replaceChildren(); if(!data.memories.length){const p=document.createElement('p');p.className='hint';p.textContent='No saved memories yet.';list.append(p);return;} data.memories.forEach((m,i)=>{const row=document.createElement('div');row.className='memory-item';const text=document.createElement('span');text.textContent=m.text;const del=document.createElement('button');del.type='button';del.textContent='DELETE';del.onclick=()=>{data.memories.splice(i,1);saveData();refreshMemory();};row.append(text,del);list.append(row);}); }
  function matchingVoice(lang){const chosen=$('voiceSelect').value; if(chosen) return voices.find(v=>v.voiceURI===chosen); const target=lang||'en-IN'; return voices.find(v=>v.lang.toLowerCase()===target.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(target.slice(0,2).toLowerCase()))||null;}
  function speak(text,lang,done){ if(!$('speakEnabled').checked){done?.();return;}if(!('speechSynthesis'in window)||typeof SpeechSynthesisUtterance==='undefined'){logMessage('SYSTEM','This browser has no speech output. Text replies are still available.',false);done?.();return;} speechSynthesis.cancel(); speechSynthesis.resume(); const u=new SpeechSynthesisUtterance(text); u.lang=lang||'en-IN'; const v=matchingVoice(u.lang);if(v)u.voice=v;u.rate=.94;u.pitch=.9; document.body.classList.add('speaking');u.onend=()=>{document.body.classList.remove('speaking');done?.();};u.onerror=()=>{document.body.classList.remove('speaking');logMessage('SYSTEM','The selected browser voice could not speak. Check the device volume and installed voices.',false);done?.();}; speechSynthesis.speak(u); }
  function inferredLang(text){if(/[\u0c00-\u0c7f]/.test(text))return 'te-IN';const t=text.toLowerCase();if(/\b(ela|unnav|unnav|cheppu|cheppu|bagunn|ledu|ra|andi|meeru|naku|naaku|emiti|enti|chala|baagund|enduku|ekkada)\b/.test(t))return 'en-IN';return $('language').value==='te-IN'?'te-IN':'en-IN';}
  function isTanglish(text){return /\b(ela|unnav|cheppu|bagunn|ledu|andi|naku|naaku|enti|chala|baagund|enduku|ekkada|sare|avunu|kaadu)\b/i.test(text)&&!/[\u0c00-\u0c7f]/.test(text);}
  function respond(text,opts={}){logMessage('JARVIS',text,true,opts.link);if(opts.speak!==false){const lang=opts.lang||inferredLang(text);speak(text,lang);} }
  function addMemory(text){const clean=text.trim();if(!clean)return;data.memories.unshift({text:clean,at:Date.now()});data.memories=data.memories.slice(0,100);saveData();refreshMemory();}
  function searchLink(query){return {href:'https://www.google.com/search?q='+encodeURIComponent(query),label:'SEARCH THE WEB ↗'};}
  function handleCommand(raw,source='text'){
    const text=raw.trim();if(!text)return;logMessage('YOU',text);const t=text.toLowerCase();const te=/[\u0c00-\u0c7f]/.test(text), tanglish=isTanglish(text), lang=te?'te-IN':'en-IN';
    if(/^(remember|save this|memory|gurtu|gurthu|gurthupettuko|gurthunchuko|జ్ఞాపకం|గుర్తుంచుకో)/i.test(t)||/^(గుర్తుంచుకో|జ్ఞాపకం)/.test(text)){
      const note=text.replace(/^(remember|save this|memory|gurtu|gurthu|gurthupettuko|gurthunchuko|జ్ఞాపకం|గుర్తుంచుకో)[:, ]*/i,'');if(note){addMemory(note);respond(te?'సరే, దీన్ని మెమరీ వాల్ట్‌లో సేవ్ చేశాను.':tanglish?'Sare, idi memory vault lo save chesanu.':'Got it. I saved that in your memory vault.',{lang});}else{$('memoryDialog').showModal();respond(te?'ఏమి గుర్తుంచుకోవాలి?':tanglish?'Em gurthupettukovali?':'What should I remember?',{lang});}return;
    }
    if(/show.*memor|what.*remember|memory vault|నా జ్ఞాపకాలు|గుర్తున్నాయా/.test(t)){const m=data.memories.slice(0,8).map(x=>x.text);respond(m.length?(te?'మీరు చెప్పిన జ్ఞాపకాలు: ':tanglish?'Nuvvu cheppina memories: ':'Here’s what I remember: ')+m.join('. '):(te?'ఇంకా ఏమీ సేవ్ చేయలేదు.':tanglish?'Inka emi save cheyyaledu.':'Your memory vault is empty.'),{lang});return;}
    if(/\b(time|samayam|టైమ్|సమయం)\b/.test(t)){const now=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});respond(te?`ఇప్పుడు సమయం ${now}.`:tanglish?`Ippudu time ${now}.`:`It’s ${now}.`,{lang});return;}
    if(/\b(date|today|రోజు|తేదీ)\b/.test(t)){const day=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});respond(te?`ఈ రోజు ${day}.`:tanglish?`Ivala ${day}.`:`Today is ${day}.`,{lang});return;}
    if(/\b(open|search|find|look up|వెతుకు|చూపించు)\b/.test(t)||/\b(youtube|google|maps|restaurants|restaurants near|near me)\b/.test(t)){let q=text.replace(/^(jarvis[, ]*)?(open|search|find|look up|వెతుకు|చూపించు)\s*/i,'').trim();if(!q)q=text;const lower=q.toLowerCase();let url,label;if(/youtube/.test(lower)){url='https://www.youtube.com/results?search_query='+encodeURIComponent(q.replace(/youtube/i,'').trim());label='OPEN YOUTUBE RESULTS ↗';}else if(/near me|nearby|restaurant|restaurants|coffee|cafe|చుట్టుపక్కల|దగ్గర/.test(lower)){const place=q.replace(/near me|nearby/ig,'').trim()||'restaurants';url='https://www.google.com/maps/search/'+encodeURIComponent(place+' near me');label='OPEN NEARBY PLACES ↗';}else{url=searchLink(q).href;label='SEARCH THE WEB ↗';}respond(te?'వెబ్‌లో వెతకడానికి లింక్ సిద్ధంగా ఉంది.':tanglish?'Web lo search link ready.':'I found a web search for that. Open it when you’re ready.',{lang,link:{href:url,label}});return;}
    if(/\b(camera|చిత్రం|కెమెరా)\b/.test(t)){ $('cameraDialog').showModal();respond(te?'కెమెరా ప్రివ్యూ తెరిచాను.':tanglish?'Camera preview open chesanu.':'I opened the camera preview. Start it when you’re ready.',{lang});return;}
    if(/\b(location|places near|near me|రెస్టారెంట్|దగ్గర)\b/.test(t)){ $('locationDialog').showModal();respond(te?'మీ దగ్గర ప్రదేశాలు కనుగొనడానికి లొకేషన్ అనుమతి ఇవ్వండి.':tanglish?'Nearby places kosam location allow cheyyi.':'Share your location to find nearby places.',{lang});return;}
    if(/\b(sad|lonely|upset|bad day|depressed|బాధ|దుఃఖం|ఒంటరిగా)\b/.test(t)){respond(te?'అలా అనిపించడం కష్టంగా ఉంటుంది. నువ్వు చెప్పాలనుకుంటే నేను వింటాను. ఇప్పుడే నీకు ఏది ఎక్కువగా సహాయపడుతుంది?':tanglish?'Ala feel avvadam kastam. Cheppalanipiste nenu vintanu. Ippudu neeku em help avvali?':'I’m sorry this feels heavy. I’m here to listen. What would help most right now?',{lang});return;}
    if(/\b(hello|hi|hey|నమస్కారం|హాయ్)\b/i.test(t)||/^(ela unn(a|av)|bagunn(a|av)|em chestunnav|sare|namaskaram)\b/i.test(t)){respond(te?'నమస్కారం! ఎలా సహాయం చేయాలి?':tanglish?'Hey! Ela help cheyyali?':'Hey. What can I help with?',{lang});return;}
    if(/\b(what can you do|help|సహాయం)\b/.test(t)){respond(te?'నేను సమయం, తేదీ, వెబ్ సెర్చ్, దగ్గర ప్రదేశాలు, కెమెరా ప్రివ్యూ, మెమరీ వాల్ట్‌తో సహాయం చేయగలను. పెద్ద ప్రశ్నలకు వెబ్ సెర్చ్ లింక్ ఇస్తాను.':tanglish?'Time, date, web search, nearby places, camera preview, memory vault help chestanu. Pedda questions ki web search link isthanu.':'I can tell the time and date, search the web, find nearby places, open a camera preview, and save memories. For broad questions I can open a web search.',{lang});return;}
    const mood=/\b(sad|lonely|upset|angry|worried|బాధ|కోపం|భయం)\b/.test(t);if(mood){respond(te?'నువ్వు కొంచెం బాధగా లేదా ఆందోళనగా ఉన్నట్టు అనిపిస్తోంది. నేను తప్పుగా అర్థం చేసుకుంటే చెప్పు.':tanglish?'Nuvvu konchem low ga or worried ga unnav anipistondi. Nenu wrong aithe cheppu.':'You sound a little low or worried. I may be reading that wrong—want to tell me what’s going on?',{lang});return;}
    const phr=te?'ఈ ప్రశ్నకు సరైన సమాధానం ఇవ్వడానికి వెబ్‌లో వెతుకుతున్నాను.':tanglish?'Daaniki correct answer kosam web lo search chestanu.':'I don’t have a connected AI knowledge service in this zero-cost browser build, so I don’t want to make up an answer. Here’s a web search instead.';
    respond(phr,{lang,link:searchLink(text)});
  }
  function showRecognitionError(error){
    if(error==='no-speech'||error==='aborted')return;
    const messages={
      'not-allowed':'Microphone permission is blocked. In your browser site settings, allow Microphone for this website, then reload and tap Enable Wake Word.',
      'service-not-allowed':'This browser does not provide a speech-recognition service. Open the website in Chrome, or use the text box.',
      'audio-capture':'The browser could not access a microphone. Check the device microphone and browser site permissions.',
      'network':'The browser speech service could not connect. Check your internet connection and try again.',
      'language-not-supported':'The speech service does not support the selected language. Try English or Telugu in the Voice menu.'
    };
    wakeEnabled=false;mode='stopped';setStatus('VOICE INPUT ERROR');$('voiceState').textContent='CHECK BROWSER';if(error==='not-allowed'||error==='audio-capture')stopMicrophoneCapture();
    logMessage('SYSTEM',messages[error]||`Speech recognition failed (${error}). Check microphone permission and try Chrome.`,false);
  }
  function currentRecognitionLanguage(){const val=$('language').value;if(val==='auto')return autoLanguage;return val;}
  function makeRecognizer(continuous){if(!SpeechRecognition){$('supportNote').textContent='SPEECH RECOGNITION NOT AVAILABLE';$('voiceState').textContent='UNAVAILABLE';return null;}const r=new SpeechRecognition();r.lang=currentRecognitionLanguage();r.continuous=continuous;r.interimResults=true;r.maxAlternatives=3;return r;}
  function toggleAutoLanguage(){if($('language').value==='auto')autoLanguage=autoLanguage==='en-IN'?'te-IN':'en-IN';}
  async function startWakeRecognition(){
    if(!wakeEnabled||mode!=='wake'||wakeStartPending)return;
    if(!SpeechRecognition){wakeEnabled=false;setStatus('VOICE UNAVAILABLE');return;}
    wakeStartPending=true;
    try{
      const track=await captureSelectedMicrophone();
      if(!wakeEnabled||mode!=='wake')return;
      const r=makeRecognizer(true);if(!r){wakeEnabled=false;mode='stopped';stopMicrophoneCapture();setStatus('VOICE UNAVAILABLE');return;}
      recognizer=r;
      r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal)continue;const text=e.results[i][0].transcript.trim();if(!text)continue;const match=text.match(/(?:\\bjarvis\\b|జార్విస్)/i);if(match){const tail=text.slice(match.index+match[0].length).replace(/^[,\\s.!?]+/,'').trim();mode='command';r.stop();if(tail){handleCommand(tail,'voice');mode='wake';setTimeout(startWakeRecognition,700);}else{speak($('language').value==='te-IN'?'చెప్పండి, వింటున్నాను.':'Yes? I’m listening.',currentRecognitionLanguage(),startCommandRecognition);} }else if($('language').value==='auto'&&text.length>2){/* keep current locale; browser transcript may already be Tanglish */}}};
      r.onerror=e=>{if(e.error==='language-not-supported'&&$('language').value==='auto'){toggleAutoLanguage();return;}showRecognitionError(e.error);};
      r.onend=()=>{if(mode==='command'){startCommandRecognition();return;}if(wakeEnabled&&mode==='wake'){if($('language').value==='auto')toggleAutoLanguage();setTimeout(startWakeRecognition,350);}};
      r.start(track);setStatus('LISTENING FOR “JARVIS”',true);$('voiceState').textContent='LISTENING';$('orbSubstate').textContent='Say “Jarvis” followed by your request';setMicrophoneStatus('Listening from '+(track.label||'the selected microphone')+'.');
    }catch(error){handleMicrophoneStartError(error);}
    finally{wakeStartPending=false;}
  }
  async function startCommandRecognition(){
    if(!wakeEnabled&&mode!=='command')return;
    if(!SpeechRecognition){wakeEnabled=false;mode='stopped';setStatus('VOICE UNAVAILABLE');return;}
    try{
      const track=await captureSelectedMicrophone();
      if(!wakeEnabled&&mode!=='command')return;
      const r=makeRecognizer(false);if(!r){mode='stopped';return;}
      recognizer=r;let got=false;
      r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal){got=true;clearTimeout(commandTimeout);handleCommand(e.results[i][0].transcript,'voice');mode=wakeEnabled?'wake':'stopped';}}};
      r.onerror=e=>showRecognitionError(e.error);
      r.onend=()=>{clearTimeout(commandTimeout);if(!got&&wakeEnabled)logMessage('SYSTEM','I didn’t catch that. Say “Jarvis” to try again.',false);if(wakeEnabled){mode='wake';const resume=()=>{if(speechSynthesis?.speaking){setTimeout(resume,250);return;}startWakeRecognition();};setTimeout(resume,350);}else{mode='stopped';if($('statusText').textContent==='LISTENING TO YOU')setStatus('STANDBY');}};
      mode='command';setStatus('LISTENING TO YOU',true);$('orbSubstate').textContent='Speak now · English / Telugu / Tanglish';setMicrophoneStatus('Listening from '+(track.label||'the selected microphone')+'.');
      r.start(track);commandTimeout=setTimeout(()=>{try{r.stop();}catch{}},12000);
    }catch(error){handleMicrophoneStartError(error);}
  }
  function enableWake(){
    if(!window.isSecureContext){logMessage('SYSTEM','Microphone access requires HTTPS. Open the secure JARVIS website to enable wake listening.',false);setStatus('SECURE SITE NEEDED');return;}
    if(!SpeechRecognition){logMessage('SYSTEM','This browser does not provide speech recognition. Use Test selected mic to check hardware, or try current Chrome.',false);setStatus('TEXT + SPEECH MODE');speak('JARVIS is ready. This browser has no speech recognition, but I can speak replies to typed messages.',currentRecognitionLanguage());return;}
    wakeEnabled=true;mode='wake';setStatus('STARTING VOICE');logMessage('SYSTEM','Requesting the selected microphone. Allow access if your browser asks, then say “Jarvis” followed by your request.',false);startWakeRecognition();
  }
  function disableWake(){wakeEnabled=false;mode='stopped';wakeStartPending=false;if(recognizer){try{recognizer.onend=null;recognizer.stop();}catch{}}speechSynthesis?.cancel();stopMicrophoneCapture();setStatus('STANDBY');$('voiceState').textContent='READY';$('orbSubstate').textContent='Say “Jarvis” or tap the microphone';setMicrophoneStatus('Microphone capture is off.');}
  $('wakeToggle').addEventListener('click',()=>wakeEnabled?disableWake():enableWake());
  $('micButton').addEventListener('click',()=>{if(mode!=='stopped'){disableWake();return;}if(!SpeechRecognition){enableWake();return;}wakeEnabled=true;mode='command';$('orbSubstate').textContent='Speak now · English / Telugu / Tanglish';logMessage('SYSTEM','Requesting the selected microphone. Speak after the listening indicator appears.',false);startCommandRecognition();});
  $('microphoneSelect').addEventListener('change',()=>{if(wakeEnabled||mode!=='stopped')disableWake();else stopMicrophoneCapture();selectedMicId=$('microphoneSelect').value;try{if(selectedMicId)localStorage.setItem('jarvis.web.microphone.v1',selectedMicId);else localStorage.removeItem('jarvis.web.microphone.v1');}catch{}const label=$('microphoneSelect').selectedOptions[0]?.text||'System default microphone';setMicrophoneStatus('Selected: '+label+'. Test it to confirm capture.');});
  $('refreshMicrophones').addEventListener('click',()=>refreshMicrophoneList());
  $('testMicrophone').addEventListener('click',testSelectedMicrophone);
  $('language').addEventListener('change',()=>{if(wakeEnabled){disableWake();enableWake();}logMessage('SYSTEM','Voice language set to '+$('language').selectedOptions[0].text+'.',false);});
  $('chatForm').addEventListener('submit',e=>{e.preventDefault();const v=$('messageInput').value.trim();if(v){$('messageInput').value='';handleCommand(v);}});
  $('clearChat').addEventListener('click',()=>{data.messages=[];saveData();$('transcript').replaceChildren();logMessage('JARVIS','Conversation cleared. Your saved memories remain in the vault.',false);});
  $('memoryOpen').onclick=()=>$('memoryDialog').showModal();$('privacyDetails').onclick=()=>$('memoryDialog').showModal();
  $('memoryForm').addEventListener('submit',e=>{e.preventDefault();const v=$('memoryInput').value.trim();if(v){addMemory(v);$('memoryInput').value='';}});
  $('exportMemory').onclick=()=>{const blob=new Blob([JSON.stringify(data.memories,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jarvis-memories.json';a.click();URL.revokeObjectURL(a.href);};
  $('deleteMemory').onclick=()=>{data.memories=[];saveData();refreshMemory();};
  let gestureController=null;
  document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>{const d=b.closest('dialog');d.close();if(d.id==='cameraDialog')stopCamera();}));
  $('cameraOpen').onclick=()=>$('cameraDialog').showModal();
  async function startCamera(){if(stream)return stream;if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access needs HTTPS and a browser with camera support.');stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});$('cameraVideo').srcObject=stream;await $('cameraVideo').play();$('cameraStart').textContent='CAMERA ACTIVE';$('cameraStatus').textContent='Camera preview is active on this device.';return stream;}
  $('cameraStart').onclick=async()=>{try{await startCamera();}catch(e){$('cameraStatus').textContent='Camera could not start: '+e.message;}};
  $('gestureToggle').onclick=async()=>{if(gestureController){gestureController.stop();gestureController=null;$('gestureToggle').textContent='ENABLE HAND GESTURES';$('cameraStatus').textContent='Hand gestures paused. Camera preview remains active.';return;}const button=$('gestureToggle');button.disabled=true;button.textContent='LOADING HAND TRACKER…';try{await startCamera();const mod=await import('./jarvis-gestures.js');gestureController=await mod.startHandControl($('cameraVideo'),$('gestureOverlay'),label=>{$('cameraStatus').textContent=label;});button.textContent='STOP HAND GESTURES';}catch(e){button.textContent='ENABLE HAND GESTURES';$('cameraStatus').textContent='Gesture control could not start: '+e.message;}finally{button.disabled=false;}};
  function stopCamera(){if(gestureController){gestureController.stop();gestureController=null;}$('gestureToggle').disabled=false;$('gestureToggle').textContent='ENABLE HAND GESTURES';if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}$('cameraVideo').srcObject=null;$('cameraStatus').textContent='Camera is off.';$('cameraStart').textContent='START CAMERA PREVIEW';}
  $('cameraDialog').addEventListener('close',stopCamera);
  $('locationOpen').onclick=()=>$('locationDialog').showModal();
  $('locationStart').onclick=()=>{if(!navigator.geolocation){$('locationStatus').textContent='Location is not available in this browser.';return;}$('locationStatus').textContent='Waiting for browser location permission…';navigator.geolocation.getCurrentPosition(pos=>{const {latitude:lat,longitude:lon}=pos.coords;$('locationStatus').textContent=`Location found (${lat.toFixed(4)}, ${lon.toFixed(4)}). Choose a nearby search:`;const links=$('placeLinks');links.replaceChildren();[['Restaurants','restaurant'],['Coffee','cafe'],['Attractions','tourist_attraction'],['Pharmacies','pharmacy']].forEach(([label,term])=>{const a=document.createElement('a');a.href=`https://www.google.com/maps/search/${encodeURIComponent(term)}/@${lat},${lon},14z`;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label+' ↗';links.append(a);});},error=>{$('locationStatus').textContent='Location unavailable: '+error.message;},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});};
  $('webOpen').onclick=()=>{const q=prompt('What should I search for?');if(q)window.open(searchLink(q).href,'_blank','noopener');};
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){d.close();if(d.id==='cameraDialog')stopCamera();}}));
  if('speechSynthesis'in window){const loadVoices=()=>{voices=speechSynthesis.getVoices();const sel=$('voiceSelect'),old=sel.value;sel.replaceChildren(new Option('System default',''));voices.forEach(v=>{const o=new Option(`${v.name} · ${v.lang}`,v.voiceURI);sel.add(o);});if(old)sel.value=old;};loadVoices();speechSynthesis.onvoiceschanged=loadVoices;}else{$('speakEnabled').checked=false;$('speakEnabled').disabled=true;}
  $('clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});setInterval(()=>$('clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),30000);
  if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
  refreshMicrophoneList(true);if(navigator.mediaDevices?.addEventListener)navigator.mediaDevices.addEventListener('devicechange',()=>refreshMicrophoneList(true));
  refreshMemory();if(data.messages.length){$('transcript').replaceChildren();renderHistory();}if(SpeechRecognition){$('supportNote').textContent='SPEECH API FOUND · PERMISSION REQUIRED';}else{$('supportNote').textContent='USE CHROME FOR VOICE · TEXT STILL WORKS';}
  document.addEventListener('visibilitychange',()=>{if(wakeEnabled&&document.hidden){$('orbSubstate').textContent='Background listening depends on browser and device power policy';}});
  window.addEventListener('beforeunload',()=>{if(stream)stream.getTracks().forEach(t=>t.stop());stopMicrophoneCapture();});
})();
