// A decorative globe built from the same bundled public-domain coastline as Folio.
const canvas=document.querySelector('#globe');
const context=canvas.getContext('2d');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let points=[],size={width:0,height:0},frame=0,visible=true,last=0,angle=-1.2;
const vector=([x,y])=>{const lng=(x/1000*360-180)*Math.PI/180,lat=(90-y/1000*360)*Math.PI/180;return [Math.cos(lat)*Math.sin(lng),Math.sin(lat),Math.cos(lat)*Math.cos(lng)];};
const places=[[-.002,51.5],[103.8,1.35],[-74,40.7],[139.7,35.7]].map(([lng,lat])=>vector([(lng+180)/360*1000,(90-lat)/360*1000]));
function project([x,y,z]){const cy=Math.cos(angle),sy=Math.sin(angle),depth=x*sy+z*cy;return [x*cy-z*sy,y*.978-depth*.208,y*.208+depth*.978];}
function draw(time){const dt=Math.min(time-last,32);last=time;if(!reduced.matches)angle+=dt*.000055;const {width:w,height:h}=size,r=Math.min(w,h)*.405,cx=w*.51,cy=h*.49;context.clearRect(0,0,w,h);context.beginPath();context.arc(cx,cy,r,0,Math.PI*2);context.fillStyle='#f0f2ec';context.fill();context.strokeStyle='#e1e5d9';context.lineWidth=.65;context.stroke();for(const point of points){const [x,y,z]=project(point);context.beginPath();context.arc(cx+x*r,cy-y*r,z>0?1:.65,0,Math.PI*2);context.fillStyle=z>0?`rgba(111,126,95,${.25+z*.36})`:'rgba(144,156,128,.09)';context.fill();}for(let i=0;i<places.length;i++){const a=places[i],b=places[(i+1)%places.length];let open=false;context.beginPath();for(let step=0;step<=70;step++){const t=step/70;const v=a.map((n,j)=>n*(1-t)+b[j]*t);const length=Math.hypot(...v);const p=project(v.map(n=>n/length*(1+Math.sin(t*Math.PI)*.13)));if(p[2]<0&&p[0]*p[0]+p[1]*p[1]<1){open=false;continue;}const px=cx+p[0]*r,py=cy-p[1]*r;if(open)context.lineTo(px,py);else context.moveTo(px,py);open=true;}context.strokeStyle='rgba(116,137,99,.28)';context.lineWidth=.7;context.stroke();const [x,y,z]=project(a);if(z>0){context.beginPath();context.arc(cx+x*r,cy-y*r,3,0,Math.PI*2);context.fillStyle='#839573';context.fill();}}if(visible&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(draw);}
function restart(){cancelAnimationFrame(frame);last=performance.now();draw(last);}
new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();size={width:rect.width,height:rect.height};const dpr=Math.min(devicePixelRatio||1,2);canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;context.setTransform(dpr,0,0,dpr,0,0);restart();}).observe(canvas);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)restart();else cancelAnimationFrame(frame);}).observe(canvas);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(frame);else if(visible)restart();});
reduced.addEventListener('change',restart);
fetch('/assets/world-dots.json').then(r=>{if(!r.ok)throw Error('globe unavailable');return r.json();}).then(data=>{points=data.map(vector);restart();}).catch(()=>{});
