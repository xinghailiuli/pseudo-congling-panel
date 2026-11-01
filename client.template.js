window.__ModuleLoader__.load({
  id: 'dsh-whale-status',
  factory: (require) => {
    const React = require('react');
    let assetOrigin='dsh-app://app';
    try { const url=new URL(window.location.href);if(['http:','https:','dsh-app:'].includes(url.protocol))assetOrigin=url.protocol+'//'+url.host; } catch {}
    const panelHtml = __PANEL_HTML__.replaceAll('__LIULI_ASSET_ORIGIN__',()=>assetOrigin);
    let roomAssets,lifeAssets,roomRuntime;
    const roomRuntimeKey='liuli-companion:room-runtime:v1';
    try{roomRuntime=JSON.parse(localStorage.getItem(roomRuntimeKey)||'null');}catch{}
    const wardrobeIds=new Set(__WARDROBE_IDS__),wardrobeLoads=new Map(),wardrobeKey='liuli-companion:wardrobe:v1';
    const allowedActions = new Set(__ALLOWED_ACTIONS__);
    __FRAME_BRIDGE__
    const PANEL_ID = 'whale-status';
    function StatusPanel() {
      const frame = React.useRef(null);
      React.useEffect(() => attachFrameBridge(window, () => frame.current?.contentWindow, allowedActions), []);
      React.useEffect(()=>{
        let active=true;
        const receive=async event=>{
          const target=frame.current?.contentWindow,d=event.data;
          if(!target||event.source!==target||d?.channel!=='liuli-companion')return;
          if(d.type==='room-runtime-request'){target.postMessage({channel:'liuli-companion',type:'room-runtime',value:roomRuntime},'*');return;}
          if(d.type==='room-runtime-save'){
            if(d.value?.version===1&&Number.isFinite(d.value.savedAt)){try{const json=JSON.stringify(d.value);if(json.length<131072){roomRuntime=JSON.parse(json);localStorage.setItem(roomRuntimeKey,json);}}catch{}}return;
          }
          if(d.type==='wardrobe-selected'&&(d.id==='original'||wardrobeIds.has(d.id))){try{localStorage.setItem(wardrobeKey,d.id);}catch{}return;}
          if(d.type!=='wardrobe-request'||typeof d.requestId!=='string')return;
          let id=d.id;if(id===undefined){try{id=localStorage.getItem(wardrobeKey);}catch{}id=wardrobeIds.has(id)?id:'original';}
          if(id!=='original'&&!wardrobeIds.has(id))return;
          try{
            let assets=null;if(id!=='original'){if(!wardrobeLoads.has(id))wardrobeLoads.set(id,require.async('./client.wardrobe-'+id+'-v19.js'));assets=await wardrobeLoads.get(id);}
            if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'wardrobe-assets',id,requestId:d.requestId,assets},'*');
          }catch{wardrobeLoads.delete(id);if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'wardrobe-error',requestId:d.requestId},'*');}
        };
        window.addEventListener('message',receive);return()=>{active=false;window.removeEventListener('message',receive);};
      },[]);
      React.useEffect(()=>{
        let active=true;
        const receive=async event=>{
          const target=frame.current?.contentWindow;
          if(!target||event.source!==target||event.data?.channel!=='liuli-companion'||event.data.type!=='room-life-request')return;
          try{lifeAssets??=require.async('./client.room-life-v19.js');const assets=await lifeAssets;if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'room-life-assets',assets},'*');}catch{lifeAssets=null;}
        };
        window.addEventListener('message',receive);return()=>{active=false;window.removeEventListener('message',receive);};
      },[]);
      const sendRoomAssets=async()=>{frame.current?.contentWindow?.postMessage({channel:"liuli-companion",type:"room-runtime",value:roomRuntime},"*");try{roomAssets??=require.async('./client.room-art-v12.js');const assets=await roomAssets;frame.current?.contentWindow?.postMessage({channel:'liuli-companion',type:'room-assets',assets},'*');}catch{roomAssets=null;}};
      return React.createElement('iframe', {
        ref: frame,
        title: '琉璃陪伴中心',
        srcDoc: panelHtml,
        onLoad:sendRoomAssets,
        sandbox: 'allow-scripts',
        style: { display: 'block', width: '100%', height: '100%', border: 0, minHeight: 0, background: '#0b171b' },
      });
    }
    function PanelIcon() {
      return React.createElement('svg', {
        width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, React.createElement('path', { d: 'M3 12a7 7 0 0 0 14 0c2 0 4-2 4-4-2 0-3 1-4 2a7 7 0 0 0-14 2Z' }),
      React.createElement('path', { d: 'M8 5V3m0 1L6 3m2 1 2-1' }),
      React.createElement('circle', { cx: 6.5, cy: 10.5, r: .6, fill: 'currentColor', stroke: 'none' }));
    }
    function apply(ctx) {
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, StatusPanel));
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: PANEL_ID, order: 30, label: '琉璃陪伴中心',
      }, PanelIcon));
    }
    return { name: 'dsh-whale-status', inject: ['slots', 'layout'], apply };
  },
});


