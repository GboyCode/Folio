import { useEffect, useId, useRef } from 'react';
import { mapViewport, projectRegion } from '../information-geography';

// An approximate provincial anchor for the decorative convergence, not a user location.
export const zhejiangPosition = projectRegion(120,29);

export function MapConnections({points,paused}:{points:readonly {x:number;y:number;key:string}[];paused:boolean}) {
  const [targetX,targetY] = zhejiangPosition;
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(()=>{
    const svg = svgRef.current;
    if (!svg) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPlayback = ()=>{
      if (paused || reducedMotion.matches) svg.pauseAnimations();
      else svg.unpauseAnimations();
    };
    syncPlayback();
    reducedMotion.addEventListener('change',syncPlayback);
    return ()=>reducedMotion.removeEventListener('change',syncPlayback);
  },[paused]);
  return <svg ref={svgRef} className="map-connections" viewBox={`0 ${mapViewport.top} ${mapViewport.width} ${mapViewport.height}`} aria-hidden="true" focusable="false">
    {points.map((point,index)=>{
      const distance = Math.hypot(targetX-point.x,targetY-point.y);
      if (distance < 3) return null;
      const lift = Math.min(115,Math.max(16,distance*.2));
      const path = `M ${point.x} ${point.y} Q ${(point.x+targetX)/2} ${Math.max(8,Math.min(point.y,targetY)-lift)} ${targetX} ${targetY}`;
      const id = `${gradientId}-${point.key}`;
      const flowX = (targetX-point.x)*.85, flowY = (targetY-point.y)*.85;
      // Translate a repeating gradient along a complete path. A full gradient period
      // produces the same image at either end of the loop, without a dash or reset gap.
      return <g key={point.key}>
        <defs><linearGradient id={id} gradientUnits="userSpaceOnUse" x1={point.x} y1={point.y} x2={point.x+flowX} y2={point.y+flowY} spreadMethod="repeat">
          <stop offset="0" stopColor="#52525b" stopOpacity="0"/>
          <stop offset=".18" stopColor="#52525b" stopOpacity=".05"/>
          <stop offset=".48" stopColor="#52525b" stopOpacity=".25"/>
          <stop offset=".72" stopColor="#3f3f46" stopOpacity=".65"/>
          <stop offset=".84" stopColor="#27272a" stopOpacity=".95"/>
          <stop offset=".93" stopColor="#52525b" stopOpacity=".25"/>
          <stop offset="1" stopColor="#52525b" stopOpacity="0"/>
          <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to={`${flowX} ${flowY}`} dur={`${Math.min(4.6,2.4+distance/300)}s`} begin={`${-index*.8-.4}s`} repeatCount="indefinite"/>
        </linearGradient></defs>
        <path className="map-connection-track" d={path}/>
        <path className="map-connection-glow" d={path} stroke={`url(#${id})`}/>
        <path className="map-connection-flow" d={path} stroke={`url(#${id})`}/>
      </g>;
    })}
  </svg>;
}
