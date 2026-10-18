import{a as e,n as t,r as n}from"./createLucideIcon-ChhPh1Qd.js";import"./backendBase-CCbq34k7.js";import{n as r}from"./AuthContext-CgseGgpY.js";import{C as i,Dt as a,I as o,S as s,T as c,q as l,w as u}from"./index-DZwTg1E9.js";var d=e(n(),1),f=`
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`,p=`
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uEnergy;
uniform float uGray;
uniform float uHue;
uniform float uPx;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.62;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 1.9 + vec2(1.7, 9.2); a *= 0.38; }
  return v;
}
vec3 pal(float t) {
  vec3 a = vec3(0.0, 0.72, 1.0), b = vec3(0.12, 0.3, 1.0), c = vec3(0.58, 0.2, 1.0), d = vec3(1.0, 0.16, 0.66), e = vec3(1.0, 0.44, 0.1);
  t = (1.0 - abs(fract(t * 0.5) * 2.0 - 1.0)) * 4.0; // triangle wave: loops with no hard seam
  t = min(t, 3.999);
  if (t < 1.0) return mix(a, b, t);
  if (t < 2.0) return mix(b, c, t - 1.0);
  if (t < 3.0) return mix(c, d, t - 2.0);
  return mix(d, e, t - 3.0);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float r = length(uv);
  float edge = 1.0 - smoothstep(1.0 - uPx, 1.0, r);
  if (edge <= 0.0) { gl_FragColor = vec4(0.0); return; }

  float z = sqrt(max(1.0 - r * r, 0.0));
  vec3 n = vec3(uv, z);
  float t = uTime;

  // Slowly turn the sphere so the pattern wraps around it instead of sliding across a flat disc.
  float c = cos(t * 0.22), s = sin(t * 0.22);
  vec3 p = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);

  float amp = 1.0 + uEnergy * 1.1;
  // Sample the flow field through a skewed 3D-ish projection (not centred on the origin) so the pattern isn't
  // mirrored left/right and reads as wrapping around the sphere.
  vec2 q = vec2(p.x * 1.1 + p.z * 0.8, p.y * 1.1 - p.z * 0.6) + vec2(0.7, -1.3);
  vec2 w = vec2(fbm(q + vec2(0.0, t * 0.4)), fbm(q + vec2(5.2, 1.3) - t * 0.3));
  float f = fbm(q + w * 1.6 * amp);

  // Broad flowing bands: a smooth sine over a warped, slightly diagonal coordinate.
  float k = (p.y * 1.3 + p.x * 0.35) * 2.6 + f * 2.5 * amp + t * 0.35;
  float sw = sin(k);
  float fill = smoothstep(-0.3, 0.95, sw);
  float crest = pow(smoothstep(0.6, 1.0, sw), 5.0);
  float trough = smoothstep(0.05, -0.9, sw);

  // A second, finer set of wavy highlight lines riding the same flow.
  float k2 = k * 1.9 + 1.7 + f * 1.6;
  float fine = pow(smoothstep(0.09, 0.0, abs(sin(k2))), 1.5);

  vec3 deep = vec3(0.01, 0.025, 0.17);
  vec3 royal = vec3(0.05, 0.13, 0.78);
  vec3 base = mix(royal, deep, trough * 0.85);
  // While it talks the whole body drifts through the palette: the dark water takes on the colour of the moment too.
  float live = clamp(uEnergy * 2.2, 0.0, 1.0);
  base = mix(base, pal(uHue * 0.8 + 0.3 + f * 0.4) * 0.5, live * 0.65);
  // Mostly cyan -> blue -> violet; pink and orange only toward the lower right, like the rim light.
  vec3 bandCol = pal(0.05 + f * 0.55 + (p.x - p.y) * 0.34 + t * 0.02 + uHue);
  vec3 col = base;
  col = mix(col, bandCol * 1.0, fill * 0.78); // blend (not add) so the band keeps its saturated colour
  col += mix(vec3(0.9, 0.97, 1.0), bandCol, 0.45) * crest * (0.7 + uEnergy * 0.3);
  col += mix(vec3(1.0), pal(f + 0.45), 0.6) * fine * 0.2;

  float fres = pow(1.0 - z, 2.4);
  float side = smoothstep(-0.7, 0.9, uv.x - uv.y * 0.55);
  vec3 rim = mix(vec3(0.1, 0.8, 1.0), vec3(1.0, 0.55, 0.28), side);
  rim = mix(rim, mix(pal(uHue + 0.1), pal(uHue + 0.65), side), live * 0.8);
  col += rim * fres * (1.1 + uEnergy * 0.35);
  col += vec3(0.92, 0.25, 0.8) * smoothstep(0.1, -0.95, uv.y) * fres * 0.55;

  float gloss = pow(max(dot(n, normalize(vec3(-0.45, 0.6, 0.65))), 0.0), 22.0);
  col += vec3(1.0) * gloss * 0.2;
  col *= 0.86 + 0.34 * fres;

  col = col / (1.0 + col * (0.26 + uEnergy * 0.3)); // soft tone-map: keeps highlights luminous without clipping to white
  col = pow(col, vec3(1.0));
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), uGray);
  gl_FragColor = vec4(col * edge, edge);
}
`,m=t(),h=`M-20 130 C 40 70, 90 70, 140 120 S 240 185, 320 120`,g=`M-20 190 C 50 130, 110 135, 160 175 S 260 235, 320 175`,_=`M-20 95 C 50 40, 110 45, 165 85 S 255 125, 320 70`,v={idle:{speed:.45,energy:.05},listening:{speed:.9,energy:.12},thinking:{speed:2.6,energy:.55},speaking:{speed:1.5,energy:.5},error:{speed:.3,energy:0}},y={idle:.008,listening:.07,thinking:.5,speaking:.32,error:0};function b(e,t,n,r,i){let[a,o]=(0,d.useState)(!0),s=(0,d.useRef)(t),c=(0,d.useRef)(i);return(0,d.useEffect)(()=>{s.current=t},[t]),(0,d.useEffect)(()=>{c.current=i},[i]),(0,d.useEffect)(()=>{let t=e.current;if(!t)return;let i=t.getContext(`webgl`,{premultipliedAlpha:!0,alpha:!0,antialias:!0});if(!i){console.warn(`Voice orb: WebGL unavailable, using the CSS orb.`),o(!1);return}let a=(e,t)=>{let n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),i.getShaderParameter(n,i.COMPILE_STATUS)?n:(console.warn(`Voice orb shader failed to compile:`,i.getShaderInfoLog(n)),null)},l=a(i.VERTEX_SHADER,f),u=a(i.FRAGMENT_SHADER,p),d=i.createProgram();if(!l||!u){o(!1);return}if(i.attachShader(d,l),i.attachShader(d,u),i.linkProgram(d),!i.getProgramParameter(d,i.LINK_STATUS)){o(!1);return}i.useProgram(d);let m=i.createBuffer();i.bindBuffer(i.ARRAY_BUFFER,m),i.bufferData(i.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),i.STATIC_DRAW);let h=i.getAttribLocation(d,`aPos`);i.enableVertexAttribArray(h),i.vertexAttribPointer(h,2,i.FLOAT,!1,0,0),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA);let g=i.getUniformLocation(d,`uTime`),_=i.getUniformLocation(d,`uEnergy`),b=i.getUniformLocation(d,`uGray`),x=i.getUniformLocation(d,`uHue`),S=i.getUniformLocation(d,`uPx`),C=Math.min(window.devicePixelRatio||1,2);t.width=t.height=Math.round(r*C),i.viewport(0,0,t.width,t.height),i.uniform1f(S,2/t.width);let w=window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches,T=4,E=0,D=0,O=0,k=performance.now(),A=0,j=e=>{let t=Math.min((e-k)/1e3,.05);k=e;let r=s.current,a=v[r],o=a.energy;r===`listening`&&(o+=(n?.current??0)*1.1),r===`speaking`&&(o+=.28*(.5+.5*Math.sin(e/130))*(.6+.4*Math.sin(e/410))),E+=(o-E)*Math.min(1,t*7),D+=((r===`error`?.9:c.current?.88:0)-D)*Math.min(1,t*(c.current?4:3)),T+=t*a.speed*(1+E*.6),O+=t*(y[r]+E*1.1),i.clearColor(0,0,0,0),i.clear(i.COLOR_BUFFER_BIT),i.uniform1f(g,T),i.uniform1f(_,E),i.uniform1f(b,D),i.uniform1f(x,O),i.drawArrays(i.TRIANGLE_STRIP,0,4),w||(A=requestAnimationFrame(j))};return A=requestAnimationFrame(j),()=>cancelAnimationFrame(A)},[e,n,r]),a}function x({state:e,size:t=260,level:n,floor:r=!0,muted:i=!1}){let a=(0,d.useRef)(null),o=b(a,e,n,t,i);return(0,m.jsxs)(`div`,{className:`vorb`,"data-state":e,"data-muted":i||void 0,style:{"--vorb-size":`${t}px`},"aria-hidden":`true`,children:[(0,m.jsx)(`div`,{className:`vorb-halo`}),o?(0,m.jsx)(`canvas`,{ref:a,className:`vorb-canvas`}):(0,m.jsxs)(`div`,{className:`vorb-sphere`,children:[(0,m.jsx)(`span`,{className:`vorb-blob b0`}),(0,m.jsx)(`span`,{className:`vorb-blob b1`}),(0,m.jsx)(`span`,{className:`vorb-blob b2`}),(0,m.jsx)(`span`,{className:`vorb-blob b3`}),(0,m.jsx)(`span`,{className:`vorb-blob b4`}),(0,m.jsxs)(`svg`,{className:`vorb-ribbons`,viewBox:`0 0 300 300`,fill:`none`,children:[(0,m.jsx)(`path`,{d:h,stroke:`rgba(235,248,255,0.95)`,strokeWidth:`4`,strokeLinecap:`round`}),(0,m.jsx)(`path`,{d:g,stroke:`rgba(120,190,255,0.85)`,strokeWidth:`16`,strokeLinecap:`round`,opacity:`0.55`})]}),(0,m.jsxs)(`svg`,{className:`vorb-ribbons r2`,viewBox:`0 0 300 300`,fill:`none`,children:[(0,m.jsx)(`path`,{d:_,stroke:`rgba(255,225,195,0.95)`,strokeWidth:`4`,strokeLinecap:`round`}),(0,m.jsx)(`path`,{d:g,stroke:`rgba(255,140,200,0.85)`,strokeWidth:`14`,strokeLinecap:`round`,opacity:`0.5`})]}),(0,m.jsx)(`div`,{className:`vorb-gloss`})]}),r&&(0,m.jsx)(`div`,{className:`vorb-floor`})]})}var S=[`Hi {name}, how can I help you today?`,`Hey {name}! What can I do for you?`,`Hi {name}, I'm listening — what do you need?`];function C(e){let t=e.trim().split(/\s+/)[0]||`there`;return S[Math.floor(Math.random()*S.length)].replace(`{name}`,t)}function w(e,t){if(typeof window>`u`||!window.speechSynthesis){t();return}window.speechSynthesis.cancel();let n=new SpeechSynthesisUtterance(e);n.rate=1,n.onend=t,n.onerror=t,window.speechSynthesis.speak(n)}function T(e,t){let{currentUser:n}=a(),[r,i]=(0,d.useState)(`idle`),[o,s]=(0,d.useState)(``),[c,u]=(0,d.useState)(``),f=(0,d.useRef)(!1),p=(0,d.useRef)(null),m=(0,d.useRef)(e),h=(0,d.useRef)(t),g=(0,d.useRef)(()=>{});(0,d.useEffect)(()=>{m.current=e},[e]),(0,d.useEffect)(()=>{h.current=t},[t]);let _=(0,d.useCallback)(()=>{if(!f.current)return;let e=l();if(!e){i(`error`),u(`Voice isn't supported in this browser — try Chrome or Edge.`),f.current=!1;return}let t=new e;t.lang=`en-US`,t.interimResults=!1,t.continuous=!1,t.onresult=async e=>{if(!f.current)return;let t=e.results[0]?.[0]?.transcript;if(!t)return;i(`thinking`),s(t);let n=await m.current(t);f.current&&(h.current?.(t,n),i(`speaking`),s(n),w(n,()=>{window.setTimeout(()=>f.current&&g.current(),300)}))},t.onerror=e=>{if(f.current){if(e.error===`not-allowed`){i(`error`),u(`Microphone access was blocked — allow it in your browser settings to talk.`),f.current=!1;return}window.setTimeout(()=>f.current&&g.current(),400)}},p.current=t,i(`listening`),s(`Listening…`),u(``),t.start()},[]);(0,d.useEffect)(()=>{g.current=_},[_]);let v=(0,d.useCallback)(()=>{f.current=!0,i(`speaking`);let e=C(n.name);s(e),w(e,()=>{window.setTimeout(()=>f.current&&g.current(),200)})},[n.name]),y=(0,d.useCallback)(()=>{f.current=!1,p.current?.stop(),window.speechSynthesis?.cancel(),i(`idle`)},[]);return(0,d.useEffect)(()=>()=>{f.current=!1,p.current?.stop(),window.speechSynthesis?.cancel()},[]),{state:r,caption:o,errorText:c,start:v,stop:y}}var E=.02,D=1200,O=2e4;function k(e,t){let{token:n}=r(),{currentUser:o}=a(),[s,c]=(0,d.useState)(`idle`),[l,f]=(0,d.useState)(``),[p,m]=(0,d.useState)(``),h=(0,d.useRef)(!1),g=(0,d.useRef)(e),_=(0,d.useRef)(t),v=(0,d.useRef)(n);(0,d.useEffect)(()=>{v.current=n},[n]);let y=(0,d.useRef)(null),b=(0,d.useRef)(null),x=(0,d.useRef)(null),S=(0,d.useRef)(null),w=(0,d.useRef)(()=>{});(0,d.useEffect)(()=>{g.current=e},[e]),(0,d.useEffect)(()=>{_.current=t},[t]);let T=(0,d.useCallback)(()=>{x.current?.stream.getTracks().forEach(e=>e.stop()),x.current=null,y.current?.getTracks().forEach(e=>e.stop()),y.current=null,b.current?.close().catch(()=>{}),b.current=null},[]),k=(0,d.useCallback)(async()=>{if(!h.current)return;let e;try{e=await navigator.mediaDevices.getUserMedia({audio:!0})}catch{c(`error`),m(`Microphone access was blocked — allow it in your browser settings to talk.`),h.current=!1;return}if(!h.current){e.getTracks().forEach(e=>e.stop());return}y.current=e,c(`listening`),f(`Listening…`),m(``);let t=new AudioContext;b.current=t;let n=t.createMediaStreamSource(e),r=t.createAnalyser();r.fftSize=2048,n.connect(r);let a=new Uint8Array(r.fftSize),o=[],s=new MediaRecorder(e);x.current=s,s.ondataavailable=e=>{e.data.size>0&&o.push(e.data)};let l=window.setTimeout(()=>s.state===`recording`&&s.stop(),O),d=!1,p=null;function C(){if(!h.current||s.state!==`recording`)return;r.getByteTimeDomainData(a);let e=0;for(let t=0;t<a.length;t++){let n=(a[t]-128)/128;e+=n*n}let t=Math.sqrt(e/a.length),n=performance.now();if(t>E)d=!0,p=null;else if(d){if(p===null)p=n;else if(n-p>D){s.stop();return}}requestAnimationFrame(C)}s.onstop=async()=>{if(window.clearTimeout(l),T(),!h.current)return;let e=new Blob(o,{type:s.mimeType||`audio/webm`});if(!d||e.size<2e3){w.current();return}c(`thinking`),f(`Thinking…`);try{if(!v.current)throw Error(`You've been signed out — please log in again.`);let t=await u(e,v.current);if(!h.current)return;if(!t.trim()){w.current();return}f(t);let n=await g.current(t);if(!h.current)return;if(_.current?.(t,n),c(`speaking`),f(n),!v.current)throw Error(`You've been signed out — please log in again.`);let r=await i(n,v.current);if(!h.current)return;let a=URL.createObjectURL(r),o=new Audio(a);S.current=o,o.onended=()=>{URL.revokeObjectURL(a),window.setTimeout(()=>h.current&&w.current(),250)},o.onerror=()=>{URL.revokeObjectURL(a),window.setTimeout(()=>h.current&&w.current(),250)},await o.play()}catch(e){if(!h.current)return;c(`error`),m(e instanceof Error?e.message:`Voice request failed.`),h.current=!1}},s.start(),requestAnimationFrame(C)},[T]);(0,d.useEffect)(()=>{w.current=k},[k]);let A=(0,d.useCallback)(async()=>{h.current=!0;let e=C(o.name);c(`speaking`),f(e);try{if(!v.current)throw Error(`You've been signed out — please log in again.`);let t=await i(e,v.current);if(!h.current)return;let n=URL.createObjectURL(t),r=new Audio(n);S.current=r;let a=()=>{URL.revokeObjectURL(n),window.setTimeout(()=>h.current&&w.current(),200)};r.onended=a,r.onerror=a,await r.play()}catch{h.current&&k()}},[o.name,k]),j=(0,d.useCallback)(()=>{h.current=!1,x.current?.state===`recording`&&x.current.stop(),T(),S.current?.pause(),S.current=null,c(`idle`)},[T]);return(0,d.useEffect)(()=>()=>{h.current=!1,T(),S.current?.pause()},[T]),{state:s,caption:l,errorText:p,start:A,stop:j}}var A=`(The voice assistant was just opened. Greet me by name in one short, warm sentence and ask how you can help — don't wait for me to speak first.)`,j=16e3,M=24e3;function N(){let e=new URL(`http://localhost:8787`);return`${e.protocol===`https:`?`wss:`:`ws:`}//${e.host}/api/assistant/gemini-live`}function P(e,t){if(t===j)return e;let n=t/j,r=Math.floor(e.length/n),i=new Float32Array(r);for(let t=0;t<r;t++){let r=Math.floor(t*n),a=Math.min(e.length,Math.floor((t+1)*n)),o=0;for(let t=r;t<a;t++)o+=e[t];i[t]=a>r?o/(a-r):e[r]}return i}function F(e){let t=new Int16Array(e.length);for(let n=0;n<e.length;n++){let r=Math.max(-1,Math.min(1,e[n]));t[n]=r<0?r*32768:r*32767}return t}function I(e){let t=new Uint8Array(e.buffer),n=``,r=32768;for(let e=0;e<t.length;e+=r)n+=String.fromCharCode(...t.subarray(e,e+r));return btoa(n)}function L(e){let t=atob(e),n=new Uint8Array(t.length);for(let e=0;e<t.length;e++)n[e]=t.charCodeAt(e);return new Int16Array(n.buffer)}function R(e){let{role:t,currentUser:n}=a(),{token:i}=r(),[s,l]=(0,d.useState)(`idle`),[u,f]=(0,d.useState)(``),[p,m]=(0,d.useState)(``),h=(0,d.useRef)(!1),g=(0,d.useRef)(null),_=(0,d.useRef)(null),v=(0,d.useRef)(null),y=(0,d.useRef)(0),b=(0,d.useRef)(null),x=(0,d.useRef)(null),S=(0,d.useRef)(e);(0,d.useEffect)(()=>{S.current=e},[e]);let C=(0,d.useRef)(``),w=(0,d.useRef)(``),T=(0,d.useRef)(!1),E=(0,d.useCallback)(()=>{x.current?.disconnect(),x.current=null,b.current?.getTracks().forEach(e=>e.stop()),b.current=null,_.current?.close().catch(()=>{}),_.current=null,v.current?.close().catch(()=>{}),v.current=null,y.current=0},[]),D=(0,d.useCallback)(e=>{v.current||=new AudioContext({sampleRate:M});let t=v.current,n=L(e),r=new Float32Array(n.length);for(let e=0;e<n.length;e++)r[e]=n[e]/32768;let i=t.createBuffer(1,r.length,M);i.copyToChannel(r,0);let a=t.createBufferSource();a.buffer=i,a.connect(t.destination);let o=Math.max(t.currentTime,y.current);a.start(o),y.current=o+i.duration},[]),O=(0,d.useCallback)(()=>{h.current=!1,g.current?.send(JSON.stringify({type:`stop`})),g.current?.close(),g.current=null,E(),l(`idle`),f(``)},[E]),k=(0,d.useCallback)(async()=>{if(!i){l(`error`),m(`You've been signed out — please log in again.`);return}h.current=!0,l(`listening`),f(`Connecting…`),m(``);let e;try{e=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1}})}catch{l(`error`),m(`Microphone access was blocked — allow it in your browser settings to talk.`),h.current=!1;return}if(!h.current){e.getTracks().forEach(e=>e.stop());return}b.current=e;let r=c[t],a={userId:n.id,userName:n.name},s=r.tools(a),u=new Map(s.map(e=>[e.spec.name,e])),d;try{d=new WebSocket(N())}catch(t){l(`error`),m(t instanceof Error?t.message:`Couldn't start the voice connection.`),e.getTracks().forEach(e=>e.stop()),h.current=!1;return}g.current=d,d.onopen=()=>{d.send(JSON.stringify({type:`init`,token:i,systemPrompt:`${r.systemPrompt(a)}\n\n${o}`,tools:s.map(e=>e.spec)}))},d.onmessage=async t=>{if(!h.current)return;let n;try{n=JSON.parse(t.data)}catch{return}if(n.type===`ready`){f(`Listening…`);let t=new AudioContext;_.current=t;let n=t.createMediaStreamSource(e),r=t.createScriptProcessor(4096,1,1);x.current=r,r.onaudioprocess=e=>{if(!h.current||d.readyState!==WebSocket.OPEN)return;let n=F(P(e.inputBuffer.getChannelData(0),t.sampleRate));d.send(JSON.stringify({type:`audio`,data:I(n)}))};let i=t.createGain();i.gain.value=0,n.connect(r),r.connect(i),i.connect(t.destination),T.current=!0,d.send(JSON.stringify({type:`greet`,text:A}));return}if(n.type===`audio`&&typeof n.data==`string`){l(`speaking`),D(n.data);return}if(n.type===`input_text`&&typeof n.text==`string`){C.current+=n.text,f(C.current);return}if(n.type===`text`&&typeof n.text==`string`){w.current+=n.text,f(w.current);return}if(n.type===`turn_complete`){T.current?T.current=!1:(C.current||w.current)&&S.current?.(C.current,w.current),C.current=``,w.current=``,l(`listening`);return}if(n.type===`tool_call`&&typeof n.name==`string`){let e=u.get(n.name),t;try{t=e?.requiresApproval?{error:`This action needs the counsellor's approval — ask them to request it in the typed AI chat instead.`}:e?await e.execute(n.arguments||{}):{error:`Unknown tool "${n.name}"`}}catch(e){t={error:e instanceof Error?e.message:String(e)}}d.send(JSON.stringify({type:`tool_result`,id:n.id,name:n.name,result:t}));return}n.type===`error`&&typeof n.message==`string`&&(l(`error`),m(n.message),h.current=!1,E())},d.onerror=()=>{h.current&&(l(`error`),m(`Gemini Live connection failed.`),h.current=!1,E())},d.onclose=()=>{h.current&&(h.current=!1,E(),l(`idle`))}},[t,n,i,D,E]);return(0,d.useEffect)(()=>()=>{h.current=!1,g.current?.close(),E()},[E]),{state:s,caption:u,errorText:p,start:k,stop:O}}function z(e,t){let{voiceEngine:n}=s(),r=T(e,t),i=k(e,t),a=R(t);return n===`openai`?i:n===`gemini-live`?a:r}export{x as n,z as t};