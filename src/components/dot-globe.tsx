import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { RefObject } from 'react';
import type { InformationRegion } from '../information-geography';
import { mapViewport } from '../information-geography';
import { facingRegion, globeArc, globePointVisible, globeRotation, globeVector } from '../globe-projection';
import { zhejiangPosition } from './map-connections';
import dots from '../world-dots.json';

const land = dots.map(([x,y])=>({x,y,vector:globeVector([x,y])}));
const destination = globeVector(zhejiangPosition);
const clamp = (value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export interface GlobeHandle {
  drag: (dx:number,dy:number)=>void;
  setDragging: (dragging:boolean)=>void;
  focus: (position:readonly [number,number])=>void;
}
interface Props {
  active:boolean;
  paused:boolean;
  regions:InformationRegion[];
  selected:string|null;
  flatRef:RefObject<HTMLDivElement|null>;
  stageRef:RefObject<HTMLDivElement|null>;
  onSelect:(key:string)=>void;
  onFacing:(key:string)=>void;
}

export const DotGlobe = forwardRef<GlobeHandle,Props>(function DotGlobe({active,paused,regions,selected,flatRef,stageRef,onSelect,onFacing},ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markersRef = useRef(new Map<string,HTMLButtonElement>());
  const state = useRef({progress:0,yaw:110*Math.PI/180,tilt:18*Math.PI/180,dragging:false});
  const focusTarget = useRef<{yaw:number;tilt:number}|null>(null);
  const config = useRef({active,paused,selected,onFacing});
  const invalidate = useRef(()=>{});
  config.current = {active,paused,selected,onFacing};
  useImperativeHandle(ref,()=>({
    drag(dx,dy) {focusTarget.current=null;state.current.yaw-=dx*.006;state.current.tilt=clamp(state.current.tilt+dy*.005,-1,1);invalidate.current();},
    setDragging(dragging) {state.current.dragging=dragging;invalidate.current();},
    focus(position) {focusTarget.current={yaw:(position[0]/1000*360-180)*Math.PI/180,tilt:clamp((90-position[1]/1000*360)*Math.PI/180,-1,1)};invalidate.current();},
  }),[]);
  useEffect(()=>invalidate.current(),[active,paused,selected]);

  useEffect(()=>{
    const canvas = canvasRef.current, stage = stageRef.current, flat = flatRef.current;
    if (!canvas || !stage || !flat) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const points = regions.filter(region=>region.position).map(region=>({region,vector:globeVector(region.position!)}));
    const routes = points.map(({vector})=>globeArc(vector,destination)).filter(route=>route.length);
    let flowTime = 0;
    let frame = 0, last = 0, lastFacing = 0, width = 0, height = 0, dpr = 1;
    let centerX = 0, centerY = 0, radius = 0;
    const schedule = ()=>{if (!frame && !document.hidden) frame=requestAnimationFrame(draw);};
    const measure = ()=>{
      const parent = canvas.parentElement!.getBoundingClientRect(), bounds = stage.getBoundingClientRect();
      width=parent.width;height=parent.height;dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      centerX=bounds.left-parent.left+bounds.width/2;centerY=bounds.top-parent.top+bounds.height/2;
      radius=Math.max(0,Math.min(bounds.width,bounds.height)*.48);
      schedule();
    };
    function draw(now:number) {
      frame=0;
      const dt=last?Math.min((now-last)/1000,.05):0;last=now;
      const current=state.current, settings=config.current, target=settings.active?1:0;
      if (media.matches) current.progress=target;
      else current.progress=clamp(current.progress+Math.sign(target-current.progress)*dt/.85,0,1);
      const moving=current.progress!==target;
      const goal=focusTarget.current;
      if (goal) {
        const angle=Math.atan2(Math.sin(goal.yaw-current.yaw),Math.cos(goal.yaw-current.yaw));
        const amount=media.matches?1:Math.min(1,dt*7);
        current.yaw+=angle*amount;current.tilt+=(goal.tilt-current.tilt)*amount;
        if (Math.abs(angle)<.003&&Math.abs(goal.tilt-current.tilt)<.003 || media.matches) focusTarget.current=null;
      }
      const rotating=settings.active&&!settings.paused&&!media.matches&&!current.dragging&&!focusTarget.current;
      const flowing=settings.active&&!settings.paused&&!media.matches&&routes.length>0;
      if (flowing) flowTime+=dt;
      if (current.progress===1&&rotating) current.yaw+=dt*.085;
      const p=current.progress, ease=p*p*(3-2*p), rotate=globeRotation(current.yaw,current.tilt);
      const flatWidth=Math.min(width,height/(mapViewport.height/mapViewport.width));
      const flatLeft=(width-flatWidth)/2;
      context!.setTransform(dpr,0,0,dpr,0,0);context!.clearRect(0,0,width,height);
      canvas!.style.opacity=p>0?'1':'0';
      canvas!.dataset.progress=p.toFixed(3);canvas!.dataset.rotation=current.yaw.toFixed(4);
      flat!.style.opacity=String(1-clamp(p*6,0,1));
      flat!.style.visibility=p>=.18?'hidden':'visible';
      if (p>0) {
        context!.globalAlpha=ease;
        const shade=context!.createRadialGradient(centerX-radius*.3,centerY-radius*.35,0,centerX,centerY,radius||1);
        shade.addColorStop(0,'#ffffff');shade.addColorStop(1,'#f6f6f8');
        context!.fillStyle=shade;context!.strokeStyle='#e8e8ed';context!.lineWidth=1;
        context!.beginPath();context!.arc(centerX,centerY,radius,0,Math.PI*2);context!.fill();context!.stroke();
        const projected=land.map(point=>({point,sphere:rotate(point.vector)}));
        // Paint the far hemisphere first, so the near dots remain crisp while rotating.
        for (const front of [false,true]) {
          context!.fillStyle=front?'#71717e':'#b9b9c3';
          context!.beginPath();
          for (const {point,sphere:[sx,sy,depth]} of projected) {
            if ((depth>=0)!==front) continue;
            const x=(flatLeft+point.x/1000*flatWidth)*(1-ease)+(centerX+sx*radius)*ease;
            const y=((point.y-mapViewport.top)/1000*flatWidth)*(1-ease)+(centerY-sy*radius)*ease;
            const size=.8*flatWidth/1000*(1-ease)+clamp(radius/200,.7,1.5)*(front?.7+depth*.3:.6)*ease;
            context!.moveTo(x+size,y);context!.arc(x,y,size,0,Math.PI*2);
          }
          context!.globalAlpha=front?.7:.7*(1-ease)+.16*ease;context!.fill();
        }
        if (p>.85) {
          const opacity=clamp((p-.85)/.15,0,1);
          context!.lineCap='round';
          for (const [routeIndex,route] of routes.entries()) {
            const projectedRoute=route.map(rotate);
            // Draw the entire visible track first, then a soft moving pulse on top.
            context!.globalAlpha=opacity*.38;context!.strokeStyle='#71717a';context!.lineWidth=1.1;
            context!.beginPath();
            let connected=false;
            for (const vector of projectedRoute) {
              if (!globePointVisible(vector)) {connected=false;continue;}
              const x=centerX+vector[0]*radius,y=centerY-vector[1]*radius;
              if (connected) context!.lineTo(x,y); else context!.moveTo(x,y);
              connected=true;
            }
            context!.stroke();
            const phase=(flowTime/(3.2+routeIndex*.22)+routeIndex*.27)%1;
            for (let i=1;i<projectedRoute.length;i++) {
              const a=projectedRoute[i-1],b=projectedRoute[i];
              if (!globePointVisible(a)||!globePointVisible(b)) continue;
              const trailing=(phase-i/(projectedRoute.length-1)+1)%1;
              if (trailing>.24) continue;
              const strength=Math.pow(1-trailing/.24,1.8);
              context!.globalAlpha=opacity*strength*.9;context!.strokeStyle='#3f3f46';context!.lineWidth=1.8;
              context!.beginPath();context!.moveTo(centerX+a[0]*radius,centerY-a[1]*radius);context!.lineTo(centerX+b[0]*radius,centerY-b[1]*radius);context!.stroke();
            }
          }
          const [x,y,depth]=rotate(destination);
          if (routes.length&&depth>.02) {
            context!.globalAlpha=opacity*clamp(depth*5,0,1);
            context!.fillStyle='#ffffff';context!.strokeStyle='#d4d4d8';context!.lineWidth=1;
            context!.beginPath();context!.arc(centerX+x*radius,centerY-y*radius,6,0,Math.PI*2);context!.fill();context!.stroke();
            context!.fillStyle='#27272a';context!.beginPath();context!.arc(centerX+x*radius,centerY-y*radius,3,0,Math.PI*2);context!.fill();
          }
          context!.globalAlpha=1;
        }
      }
      for (const {region,vector} of points) {
        const marker=markersRef.current.get(region.key);
        if (!marker) continue;
        const [x,y,depth]=rotate(vector);
        marker.style.transform=`translate(${centerX+x*radius}px,${centerY-y*radius}px) translate(-50%,-50%)`;
        marker.style.visibility=p>.96&&depth>.06?'visible':'hidden';
        marker.style.opacity=String(clamp(depth*4,0,1));
      }
      let pendingFacing=false;
      if (settings.active && p===1 && !goal) {
        const key=facingRegion(points.map(({region,vector})=>({key:region.key,depth:rotate(vector)[2]})),settings.selected);
        if (key && key!==settings.selected) {
          if (current.dragging||now-lastFacing>240) {lastFacing=now;settings.onFacing(key);}
          else pendingFacing=true;
        }
      }
      if (moving||rotating||flowing||focusTarget.current||pendingFacing) schedule();
    }
    invalidate.current=()=>{last=performance.now();schedule();};
    const observer=new ResizeObserver(measure);observer.observe(canvas.parentElement!);observer.observe(stage);
    const motionChange=()=>{last=performance.now();schedule();};
    const visibilityChange=()=>{if (document.hidden) {cancelAnimationFrame(frame);frame=0;} else motionChange();};
    media.addEventListener('change',motionChange);document.addEventListener('visibilitychange',visibilityChange);
    measure();
    return ()=>{
      cancelAnimationFrame(frame);observer.disconnect();invalidate.current=()=>{};
      media.removeEventListener('change',motionChange);document.removeEventListener('visibilitychange',visibilityChange);
    };
  },[regions,flatRef,stageRef]);

  return <>
    <canvas ref={canvasRef} className="dot-globe" aria-hidden="true"/>
    {regions.filter(region=>region.position).map(region=><button key={region.key} type="button" data-slot="globe-marker" className="globe-marker"
      ref={element=>{if(element)markersRef.current.set(region.key,element);else markersRef.current.delete(region.key);}}
      aria-label={`查看${region.label}，${region.entries.length} 条信息`} aria-pressed={selected===region.key}
      tabIndex={active?0:-1} onClick={()=>onSelect(region.key)}>
      <span className="map-marker-dot"/><span className="map-marker-label">{region.code}<b>{region.entries.length}</b></span>
    </button>)}
  </>;
});
