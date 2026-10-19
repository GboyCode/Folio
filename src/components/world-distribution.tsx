import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, CreditCard, Globe2, Layers3, Map, MapPin, Pause, Play, Plus, Smartphone, X } from 'lucide-react';
import type { PointerEvent } from 'react';
import { Popover } from 'radix-ui';
import type { Entry, ItemType } from '../types';
import { clusterMapRegions, groupInformationRegions, mapViewport } from '../information-geography';
import { CountryFlag } from './country-flag';
import { EntryMiniature } from './entry-miniature';
import { Button } from './ui/button';
import { MapConnections, zhejiangPosition } from './map-connections';
import { DotGlobe } from './dot-globe';
import type { GlobeHandle } from './dot-globe';

const types: {key:ItemType;label:string;icon:typeof CreditCard}[] = [
  {key:'bank',label:'银行卡',icon:CreditCard}, {key:'crypto',label:'U 卡',icon:Layers3},
  {key:'sim',label:'SIM / eSIM',icon:Smartphone}, {key:'address',label:'地址信息',icon:MapPin},
];
const mapViewBox = `0 ${mapViewport.top} ${mapViewport.width} ${mapViewport.height}`;
const mapRatio = mapViewport.height/mapViewport.width;
const baseMap = <svg className="world-map-land" viewBox={mapViewBox} aria-hidden="true" focusable="false"><image href="/world-map.svg" width="1000" height="450"/></svg>;

export function WorldDistribution({entries,onOpen,onAdd,initialGlobe=false}:{entries:Entry[];onOpen:(entry:Entry)=>void;onAdd:()=>void;initialGlobe?:boolean}) {
  const regions = useMemo(()=>groupInformationRegions(entries),[entries]);
  const [selection,setSelection] = useState<string | null>(null);
  const [mapWidth,setMapWidth] = useState(0);
  const [flowPaused,setFlowPaused] = useState(false);
  const [globe,setGlobe] = useState(initialGlobe);
  const [rotationPaused,setRotationPaused] = useState(false);
  const [activeRegion,setActiveRegion] = useState<string|null>(null);
  const featuredRegion=regions.find(region=>region.key===activeRegion)||regions[0];
  const panelRef = useRef<HTMLElement>(null);
  const flatRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeHandle>(null);
  const regionListRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{id:number;x:number;y:number;lastX:number;lastY:number;moved:boolean}|null>(null);
  const openingDetail = useRef(false);
  const changeView = (next:boolean)=>{setSelection(null);setGlobe(next);};
  const selectRegion = (key:string)=>{
    setActiveRegion(key);
    const region=regions.find(region=>region.key===key);
    if (region?.position) globeRef.current?.focus(region.position);
  };
  const startDrag = (event:PointerEvent<HTMLElement>)=>{
    if (!event.isPrimary||event.button!==0 || !(event.target instanceof Element) || event.target.closest('button,a,input,[data-region]') || !event.target.closest('.world-map-canvas,.globe-stage')) return;
    gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);
    globeRef.current?.setDragging(true);
  };
  const moveDrag = (event:PointerEvent<HTMLElement>)=>{
    const drag=gesture.current;
    if (!drag||drag.id!==event.pointerId) return;
    if (!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8) return;
    if (!drag.moved) {drag.moved=true;changeView(true);event.currentTarget.dataset.dragging='true';}
    globeRef.current?.drag(event.clientX-drag.lastX,event.clientY-drag.lastY);
    drag.lastX=event.clientX;drag.lastY=event.clientY;
  };
  const endDrag = (event:PointerEvent<HTMLElement>)=>{
    if (gesture.current?.id!==event.pointerId) return;
    gesture.current=null;globeRef.current?.setDragging(false);delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  useEffect(()=>{
    const element = panelRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry])=>{
      // Fit the image and its markers into the remaining viewport using the same projection.
      setMapWidth(Math.min(entry.contentRect.width,entry.contentRect.height / mapRatio));
    });
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  const clusters = clusterMapRegions(regions,mapWidth).map(cluster=>({...cluster,
    key:cluster.regions.map(region=>region.key).join('-'),
    x:Math.max(40,Math.min(960,cluster.x)),y:Math.max(27,Math.min(mapViewport.top+mapViewport.height-12,cluster.y)),
  }));

  return <section className="world-distribution" ref={panelRef} aria-label="信息地区地图" data-view={globe?'globe':'flat'} data-flow-paused={flowPaused}
    onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
    <div ref={flatRef} className="world-map-canvas" inert={globe} style={{width:mapWidth,height:mapWidth*mapRatio}}>
      <div className="world-map-grid" aria-hidden="true"/>
      {baseMap}
      {clusters.length>0 && <>
        <MapConnections points={clusters} paused={flowPaused||globe}/>
        <div className="map-destination" style={{left:`${zhejiangPosition[0]/10}%`,top:`${(zhejiangPosition[1]-mapViewport.top)/mapViewport.height*100}%`}} aria-label="连线汇聚点：浙江">
          <span className="map-destination-dot" aria-hidden="true"/>
        </div>
      </>}
      {clusters.map(cluster=>{
        const key = cluster.key;
        const label = cluster.regions.map(region=>region.label).join('、');
        const total = cluster.regions.reduce((sum,region)=>sum+region.entries.length,0);
        return <Popover.Root key={key} open={selection===key} onOpenChange={open=>setSelection(open?key:null)}>
          <Popover.Trigger asChild>
            <button type="button" data-slot="map-marker" className="world-map-marker"
              style={{left:`${cluster.x/10}%`,top:`${(cluster.y-mapViewport.top)/mapViewport.height*100}%`}}
              aria-label={`查看${label}，${total} 条信息`} title={`${label} · ${total} 条信息`}>
              <span className="map-marker-dot"/><span className="map-marker-label">{cluster.regions.length===1?cluster.regions[0].code:`${cluster.regions.length} 地区`}<b>{total}</b></span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="map-popover" side="top" sideOffset={8} collisionPadding={16}
              aria-label={`${label}的信息`} onCloseAutoFocus={event=>{
                // The detail dialog takes over focus when a record is opened.
                if (openingDetail.current) {event.preventDefault();openingDetail.current=false;}
              }}>
              <div className="map-popover-heading"><strong>{cluster.regions.length===1?label:'地区信息'}</strong><span>{total} 条信息</span>
                <Popover.Close asChild><button type="button" className="icon-button" aria-label="关闭地区信息"><X size={16}/></button></Popover.Close>
              </div>
              <div className="map-popover-records">
                {cluster.regions.map(region=><div className="map-popover-region" key={region.key}>
                  {cluster.regions.length>1 && <div className="map-popover-region-label"><CountryFlag country={region.label}/>{region.label}<span>{region.entries.length}</span></div>}
                  {[...region.entries].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(entry=>{
                    const type = types.find(type=>type.key===entry.type)!;
                    return <button type="button" data-slot="region-record" className="map-popover-record" key={entry.id} aria-label={`查看 ${entry.name}`}
                      onClick={()=>{openingDetail.current=true;setSelection(null);onOpen(entry);}}>
                      <EntryMiniature entry={entry}/>
                      <span className="map-record-name"><strong>{entry.name}</strong><small>{type.label}{entry.issuer?` · ${entry.issuer}`:''}</small></span>
                      <ArrowUpRight size={14}/>
                    </button>;
                  })}
                </div>)}
              </div>
              <Popover.Arrow className="map-popover-arrow" width={12} height={6}/>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>;
      })}
    </div>
    <div ref={stageRef} className="globe-stage" aria-hidden="true"/>
    <DotGlobe ref={globeRef} active={globe} paused={rotationPaused} regions={regions} selected={activeRegion} flatRef={flatRef} stageRef={stageRef} onSelect={selectRegion} onFacing={setActiveRegion}/>
    <div className="map-view-controls">
      <button type="button" data-slot="map-view-toggle" className="map-view-toggle" aria-label={globe?'切回平铺地图':'切换为地球'} onClick={()=>changeView(!globe)}>
        {globe?<Map size={14}/>:<Globe2 size={14}/>}<span>{globe?'平铺地图':'地球视图'}</span>
      </button>
      {globe?<button type="button" data-slot="globe-pause" className="map-flow-toggle" aria-label={rotationPaused?'播放自动旋转':'暂停自动旋转'} title={rotationPaused?'播放自动旋转':'暂停自动旋转'} onClick={()=>setRotationPaused(paused=>!paused)}>
        {rotationPaused?<Play size={14}/>:<Pause size={14}/>}</button>:
        clusters.length>0&&<button type="button" data-slot="map-flow-toggle" className="map-flow-toggle" aria-label={flowPaused?'播放连线动效':'暂停连线动效'} title={flowPaused?'播放连线动效':'暂停连线动效'} onClick={()=>setFlowPaused(paused=>!paused)}>
          {flowPaused?<Play size={14}/>:<Pause size={14}/>}</button>}
    </div>
    <span className="map-drag-hint" aria-hidden="true">{globe?'拖动旋转':'拖动地图，探索地球'}</span>
    <aside className="globe-regions" aria-label="地区信息" inert={!globe}>
      <div className="globe-regions-heading"><strong>地区信息</strong><span>{regions.length}</span><small>{rotationPaused?'已暂停':'跟随地球旋转'}</small></div>
      <div className="globe-region-tabs" aria-label="选择地区">
        {regions.map(region=><button type="button" data-slot="region-tab" key={region.key} aria-pressed={featuredRegion?.key===region.key} onClick={()=>selectRegion(region.key)}>{region.label}</button>)}
      </div>
      <div className="globe-region-list" ref={regionListRef}>
        {featuredRegion&&<section className="globe-region-card" data-region={featuredRegion.key} key={featuredRegion.key}>
          <div className="globe-region-heading"><CountryFlag country={featuredRegion.label}/><strong>{featuredRegion.label}</strong><span>{featuredRegion.entries.length} 条信息</span></div>
          <div className="globe-region-entries">{featuredRegion.entries.map(entry=>{
            const type=types.find(type=>type.key===entry.type)!;
            return <button type="button" data-slot="globe-record" className="globe-region-record" key={entry.id} aria-label={`查看 ${entry.name}`} onClick={()=>onOpen(entry)}>
              <EntryMiniature entry={entry}/><span className="globe-record-name"><strong>{entry.name}</strong><small>{type.label}{entry.issuer?` · ${entry.issuer}`:''}</small></span><ArrowUpRight size={13}/>
            </button>;
          })}</div>
        </section>}
        {!regions.length&&<p className="globe-no-regions">添加信息后，地区会显示在这里。</p>}
      </div>
    </aside>
    {!clusters.length && !globe && <div className="map-empty">
      <p>{entries.length?'暂无可定位的地区':'添加信息，点亮你的地图'}</p>
      {!entries.length && <Button variant="outline" onClick={onAdd}><Plus size={15}/>添加信息</Button>}
    </div>}
  </section>;
}
