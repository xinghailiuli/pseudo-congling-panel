window.__ModuleLoader__.load({
  id: 'dsh-whale-status',
  factory: (require) => {
    const React = require('react');
    let assetOrigin='dsh-app://app';
    try { const url=new URL(window.location.href);if(['http:','https:','dsh-app:'].includes(url.protocol))assetOrigin=url.protocol+'//'+url.host; } catch {}
    const panelHtml = __PANEL_HTML__.replaceAll('__LIULI_ASSET_ORIGIN__',()=>assetOrigin);
    let roomAssets;
    const allowedActions = new Set(__ALLOWED_ACTIONS__);
    __FRAME_BRIDGE__
    const PANEL_ID = 'whale-status';
    function StatusPanel() {
      const frame = React.useRef(null);
      React.useEffect(() => attachFrameBridge(window, () => frame.current?.contentWindow, allowedActions), []);
      const sendRoomAssets=async()=>{try{roomAssets??=require.async('./client.room-art-v7.js');const assets=await roomAssets;frame.current?.contentWindow?.postMessage({channel:'liuli-companion',type:'room-assets',assets},'*');}catch{roomAssets=null;}};
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
