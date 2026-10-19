import { useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import App from './App';
import { demoWallet } from './data';
import { blankEntry, type Entry } from './types';
import './demo.css';

// Entirely fictional records. Never load a wallet, account, or API in this entry point.
function exhibitionWallet() {
  const wallet = demoWallet();
  const example = (values: Partial<Entry>): Entry => ({
    ...blankEntry(), ...values, demo: true, holder: 'DEMO USER',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    notes: '虚构演示资料。卡面仅供识别，国家分组不代表产品实际发行或服务范围。地址和图片均为示意。',
  });
  wallet.entries = wallet.entries.map(entry => example({
    ...entry, country: entry.id === 'demo-redotpay' ? '中国香港' : entry.id === 'demo-etherfi' ? '美国' : entry.country,
    renewal: '',
  }));
  const neighborhoods = [
    ['sg', '新加坡', '新加坡', 'Garden Court · 示例花园住宅'],
    ['jp', '日本', '东京', 'Sakura Lane · 示例樱花小街'],
    ['de', '德国', '柏林', 'Linden Quarter · 示例林荫街区'],
    ['fr', '法国', '巴黎', 'Maison Demo · 示例庭院'],
    ['ca', '加拿大', '温哥华', 'Maple Avenue · 示例枫叶街区'],
    ['au', '澳大利亚', '悉尼', 'Coastal Walk · 示例海岸住宅'],
    ['nz', '新西兰', '奥克兰', 'Fern Grove · 示例花园住宅'],
    ['br', '巴西', '圣保罗', 'Jardim Demo · 示例花园街区'],
    ['ae', '阿联酋', '迪拜', 'Palm Court · 示例庭院住宅'],
  ];
  wallet.entries.push(...neighborhoods.map(([code, country, city, line1]) => example({
    id: `exhibition-address-${code}`, type: 'address', name: `${city}生活地址`, country, city, line1,
    tags: '虚构示例,生活地址', favorite: code === 'jp' || code === 'sg',
  })));
  wallet.entries.push(...[
    {id:'exhibition-n26',type:'bank',name:'N26 日常消费卡',issuer:'N26',country:'德国',artId:'n26-standard-mastercard',number:'0001',currency:'EUR',network:'Mastercard'},
    {id:'exhibition-wise',type:'bank',name:'Wise 旅行卡',issuer:'Wise',country:'新加坡',artId:'wise',number:'0002',currency:'SGD / USD',network:'Mastercard'},
    {id:'exhibition-savo',type:'crypto',name:'SAVO 日常订阅',issuer:'SAVO',country:'新加坡',artId:'savo-nova-ii-green',number:'0003',currency:'USDT'},
    {id:'exhibition-infini',type:'crypto',name:'Infini Pro',issuer:'Infini',country:'美国',artId:'infini-pro',number:'0004',currency:'USDC'},
    {id:'exhibition-sim-jp',type:'sim',name:'日本旅行 eSIM',issuer:'演示运营商',country:'日本',phone:'+81 •• •••• 0000',plan:'旅行流量 · 示例',simType:'eSIM'},
    {id:'exhibition-sim-ca',type:'sim',name:'加拿大备用号码',issuer:'演示运营商',country:'加拿大',phone:'+1 416 555 0142',plan:'按需使用 · 示例',simType:'eSIM'},
    {id:'exhibition-sim-de',type:'sim',name:'德国日常号码',issuer:'演示运营商',country:'德国',phone:'+49 ••• ••• 0000',plan:'月度套餐 · 示例',simType:'实体 SIM'},
    {id:'exhibition-sim-au',type:'sim',name:'澳大利亚旅行 eSIM',issuer:'演示运营商',country:'澳大利亚',phone:'+61 ••• ••• 000',plan:'旅行流量 · 示例',simType:'eSIM'},
  ].map(values => example(values as Partial<Entry>)));
  return wallet;
}

export default function Demo() {
  const [initialRaw] = useState(() => JSON.stringify(exhibitionWallet()));
  const reset = () => window.location.reload();
  return <App initialRaw={initialRaw} initialRevision={0} username="演示空间" storageKind="demo"
    onPersist={async (_payload, revision) => ({ revision: revision + 1 })}
    onLogout={async () => { window.location.assign('/'); }}
    notice={<div className="demo-notice" role="note">
      <div className="demo-notice-copy"><strong>在线体验</strong><span>虚构数据 · 修改不上传，刷新即重置</span></div>
      <div className="demo-notice-actions"><button type="button" onClick={reset}><RotateCcw size={13}/>重置演示</button><a href="/"><ArrowLeft size={13}/>返回官网</a></div>
    </div>}
    settingsPanel={<section className="settings-panel"><h3>当前为演示空间</h3><p>可体验添加、编辑、收藏与地图交互。全部修改仅在当前页面中生效，不会上传或保存到浏览器。刷新页面即可恢复示例，请勿填写真实资料。</p></section>}/>
}
