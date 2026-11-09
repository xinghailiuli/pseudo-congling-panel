import {roomDom} from './room-dom.mjs';
export function mountRoomUi(root,context) {
 const {document,night,show,toggleBottomPopover,toggleDrawerTab,getButtons}=context;
 const {node,div,svg:makeVectorIcon}=roomDom(document);
 const LIULI_CARD_AVATAR_DATA_URL=context.avatarUrl;let disposed=false;
 const toggle=(kind)=>toggleBottomPopover(kind,getButtons()[kind]);
 const btnBottomCompanion=null,btnBottomChat=null,btnNavWardrobe=null;
  const makeSvgEl = (tag, attrs = {}) => {
    if (typeof document?.createElementNS !== 'function') return null;
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  };

  function updateRecentActivityText(actText, timeText = '刚刚') {
    const actEl = typeof document !== 'undefined' ? document.getElementById('hud-recent-act-text') : null;
    const timeEl = typeof document !== 'undefined' ? document.getElementById('hud-recent-act-time') : null;
    if (actEl && actText) actEl.textContent = actText;
    if (timeEl && timeText) timeEl.textContent = timeText;
  }

  const makeCardCornerStarsSvg = (variant = 'top') => {
    const s = makeSvgEl('svg', { viewBox: '0 0 56 44', class: 'right-card-stars-svg', 'aria-hidden': 'true' });
    if (!s) return node('span', '', 'right-stars-fallback');
    const starMain = makeSvgEl('path', {
      d: 'M42 6 L44.4 13.6 L52 16 L44.4 18.4 L42 26 L39.6 18.4 L32 16 L39.6 13.6 Z',
      fill: '#ffffff',
      opacity: '0.94'
    });
    s.append(starMain);
    if (variant !== 'single') {
      const starSub = makeSvgEl('path', {
        d: 'M22 22 L23.3 26.2 L27.5 27.5 L23.3 28.8 L22 33 L20.7 28.8 L16.5 27.5 L20.7 26.2 Z',
        fill: '#dff8ff',
        opacity: '0.82'
      });
      s.append(starSub);
    }
    return s;
  };

  const makeRemindHeaderIconSvg = () => {
    const s = makeSvgEl('svg', { viewBox: '0 0 24 24', class: 'right-header-outline-svg', 'aria-hidden': 'true' });
    if (!s) return node('span', '☑', 'right-bell-fallback');
    const box = makeSvgEl('rect', {
      x: '3', y: '3', width: '18', height: '18', rx: '4.5',
      fill: 'none', stroke: '#e6f8ff', 'stroke-width': '2.0'
    });
    const tick = makeSvgEl('path', {
      d: 'M7.5 12.2 L10.6 15.3 L16.8 8.8',
      fill: 'none', stroke: '#ffffff', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });
    s.append(box, tick);
    return s;
  };

  const makeCheckboxSvg = () => {
    const s = makeSvgEl('svg', { viewBox: '0 0 24 24', class: 'right-check-svg', 'aria-hidden': 'true' });
    if (!s) return node('span', '☐', 'right-check-fallback');
    const rect = makeSvgEl('rect', {
      x: '3', y: '3', width: '18', height: '18', rx: '4.2',
      fill: 'rgba(8, 30, 66, 0.45)', stroke: '#bfe8ff', 'stroke-width': '1.9'
    });
    const check = makeSvgEl('path', {
      d: 'M7.4 12.3 L10.5 15.4 L16.8 8.8',
      fill: 'none', stroke: '#6cf4ff', 'stroke-width': '2.3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      class: 'right-check-tick'
    });
    s.append(rect, check);
    return s;
  };

  const makeCalendarHeaderIconSvg = () => {
    const s = makeSvgEl('svg', { viewBox: '0 0 24 24', class: 'right-header-outline-svg', 'aria-hidden': 'true' });
    if (!s) return node('span', '📅', 'right-gamepad-fallback');
    const frame = makeSvgEl('rect', {
      x: '3', y: '4.5', width: '18', height: '16.5', rx: '3.8',
      fill: 'none', stroke: '#e6f8ff', 'stroke-width': '1.9'
    });
    const topLine = makeSvgEl('path', {
      d: 'M3 9.5 H21 M8 2.6 V6.2 M16 2.6 V6.2',
      fill: 'none', stroke: '#e6f8ff', 'stroke-width': '1.9', 'stroke-linecap': 'round'
    });
    const dots = [
      [7.8, 13.2], [12, 13.2], [16.2, 13.2],
      [7.8, 17.0], [12, 17.0], [16.2, 17.0]
    ].map(([cx, cy]) => makeSvgEl('circle', { cx: String(cx), cy: String(cy), r: '1.05', fill: '#dff8ff' }));
    s.append(frame, topLine, ...dots);
    return s;
  };

  const makeFeatherIconSvg = () => {
    const s = makeSvgEl('svg', { viewBox: '0 0 24 24', class: 'right-feather-svg', 'aria-hidden': 'true' });
    if (!s) return node('span', '🪶', 'right-feather-fallback');
    const plume = makeSvgEl('path', {
      d: 'M20.4 3.6 C15.2 3.8 10.6 6.8 7.8 11.4 L11.4 11.1 L6.6 13.6 C5.8 15.1 5.3 16.7 5.1 18.2 L10.2 17.9 C14.8 15.2 18.6 10.8 20.4 3.6 Z',
      fill: '#ecfbff'
    });
    const quill = makeSvgEl('path', {
      d: 'M3.6 20.4 L14.6 9.4',
      fill: 'none', stroke: '#b8f2ff', 'stroke-width': '1.8', 'stroke-linecap': 'round'
    });
    s.append(plume, quill);
    return s;
  };

  const approvedCardIcon = (name) => {
    const paths = {
      bell: ['M7 9a5 5 0 0 1 10 0c0 6 2 5 2 7H5c0-2 2-1 2-7Z','M10 20h4M12 2v2'],
      shield: ['M12 3 20 6v6c0 5-8 9-8 9S4 17 4 12V6Z','m8 12 3 3 5-6'],
      recent: ['M7 5h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3V7a2 2 0 0 1 2-2Z','M2 15V4a2 2 0 0 1 2-2h12'],
      heart: ['M12 21C8 17 2 13 2 7.8 2 1.8 9 .8 12 5.5 15 .8 22 1.8 22 7.8 22 13 16 17 12 21Z']
    };
    const icon = makeVectorIcon(paths[name]);
    if (icon) icon.setAttribute('class', name === 'heart' ? 'level-heart' : name === 'shield' ? 'row-mark' : 'right-header-icon ' + name);
    return icon || node('span', '');
  };
  const approvedCardStars = () => { const stars=node('span', '✦ ·', 'card-stars');stars.setAttribute('aria-hidden','true');return stars; };
  const avatarImg = typeof document?.createElement === 'function' ? document.createElement('img') : node('span', '');
  if (avatarImg && avatarImg.tagName === 'IMG') {
    avatarImg.className = 'right-avatar-img';
    avatarImg.alt = '琉璃';
    if (typeof LIULI_CARD_AVATAR_DATA_URL === 'string' && LIULI_CARD_AVATAR_DATA_URL) {
      avatarImg.src = LIULI_CARD_AVATAR_DATA_URL;
    }
  }

  const onlineDotNode = node('span', '', 'right-online-dot');
  onlineDotNode.id = 'hud-right-online-dot';
  onlineDotNode.dataset.sleeping = night?.sleeping ? '1' : '0';

  const profileStatusNode = node('span', night?.sleeping ? '熟睡 · 梦境中' : '在线 · 陪伴中', 'right-profile-status');
  profileStatusNode.id = 'hud-right-online-status';

  const rightProfileCard = div('right-info-card profile-card',
    approvedCardStars(),
    div('right-avatar-wrap', avatarImg),
    div('right-profile-meta',
      node('div', '大肥鱼', 'right-profile-name'),
      div('right-profile-level-row',
        node('span', 'Lv.73', 'right-level-text'), approvedCardIcon('heart')
      ),
      div('right-profile-status-row', onlineDotNode, profileStatusNode)
    )
  );
  rightProfileCard.addEventListener?.('click', () => { if(disposed)return;
    toggle('companion');
  });

  const remindRow1 = div('right-remind-row',
    node('span', '✦', 'row-mark'),
    node('span', '今日签到奖励', 'right-remind-text')
  );
  remindRow1.addEventListener?.('click', () => { if(disposed)return;
    remindRow1.classList?.toggle('checked');
    updateRecentActivityText('领取了今日陪伴签到');
    show('✨ 今日陪伴签到已完成，琉璃朝你开心地挥了挥手~');
  });

  const remindRow2 = div('right-remind-row',
    approvedCardIcon('shield'),
    node('span', '整理衣橱', 'right-remind-text')
  );
  remindRow2.addEventListener?.('click', () => { if(disposed)return;
    remindRow2.classList?.toggle('checked');
    updateRecentActivityText('整理了装扮衣橱');
    toggleDrawerTab('wardrobe', getButtons().wardrobe);
  });

  const remindCountNum = node('span', '2', 'right-remind-num');
  const rightRemindCard = div('right-info-card remind-card',
    approvedCardStars(),
    div('right-card-header',
      approvedCardIcon('bell'),
      div('right-card-title', node('span', '提醒 · '), remindCountNum)
    ),
    div('right-remind-list', remindRow1, remindRow2)
  );

  const recentSubNode = node('span', '刚刚', 'right-recent-sub');
  recentSubNode.id = 'hud-recent-act-time';
  const recentMainNode = node('span', '和你聊了会天', 'right-recent-main');
  recentMainNode.id = 'hud-recent-act-text';

  const bottomRightSparkle = makeSvgEl('svg', { viewBox: '0 0 20 20', class: 'right-card-br-sparkle', 'aria-hidden': 'true' });
  if (bottomRightSparkle) {
    bottomRightSparkle.append(makeSvgEl('path', {
      d: 'M10 2 L11.5 8.5 L18 10 L11.5 11.5 L10 18 L8.5 11.5 L2 10 L8.5 8.5 Z',
      fill: '#e6f9ff',
      opacity: '0.85'
    }));
  }

  const rightRecentCard = div('right-info-card recent-card',
    approvedCardStars(),
    div('right-card-header',
      approvedCardIcon('recent'),
      node('div', '最近活动', 'right-card-title')
    ),
    div('right-recent-copy', recentMainNode, recentSubNode)
  );
  rightRecentCard.addEventListener?.('click', () => { if(disposed)return;
    toggle('chat');
  });

  const rightInfoSidebar = div('star-echo-right-sidebar',
    rightProfileCard,
    rightRemindCard,
    rightRecentCard
  );


 root?.append(rightInfoSidebar);
 return {element:rightInfoSidebar,update(snapshot){if(disposed||!snapshot)return;profileStatusNode.textContent=snapshot.sleeping?'熟睡 · 梦境中':'在线 · 陪伴中';onlineDotNode.dataset.sleeping=snapshot.sleeping?'1':'0';},dispose(){if(disposed)return;disposed=true;rightInfoSidebar.remove();}};
}
