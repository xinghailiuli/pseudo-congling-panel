// 模块 B-6：二楼卧室睡眠区（Bedroom Sleep Area）
// 职责：拥有二楼床铺（bed / sleep）、被褥、网格被面（quilt-mesh）、折叠被、睡眠微动作（踢被/翻身 roomSleepVariation）、长夜与梦境工作台入口、姿态序列及方块屋绘制。

export const BEDROOM_SLEEP_FEATURES = [
  {
    id: 'bed',
    level: 2,
    label: '床：长夜与梦境',
    short: '床铺 · 长夜与梦境',
    title: '床：长夜与梦境',
    rect: [282, 554, 266, 195],
    mark: [521, 736],
    symbol: '梦',
    pages: ['night', 'dreams'],
  },
];

export const BEDROOM_SLEEP_CAMERA_CENTERS = {
  sleep: [420, 640],
};

export const BEDROOM_SLEEP_WORKSPACE_GROUPS = {
  bed: { title: '床：长夜与梦境', pages: ['night', 'dreams'] },
};

export const BEDROOM_SLEEP_OCCLUDERS = [
  {
    name: 'wardrobe-quilt',
    level: 2,
    polygons: ['331,653 370,636 416,623 463,618 504,628 534,664 548,705 545,731 535,728 527,714 358,741 350,724'],
    when: () => false,
    useRepair: true,
    mountOnSvg: true,
  },
];

export function roomSleepVariation(elapsed, seed = 0) {
  if (elapsed < 60000) return null;
  const index = Math.floor((elapsed - 60000) / 90000), local = (elapsed - 60000) % 90000;
  if (local >= 6500) return null;
  const n = ((Math.imul((seed | 0) + index + 1, 1103515245) + 12345) >>> 0) % 100;
  if (n >= 80) return null;
  return { kind: n < 25 ? 'kick' : 'turn', progress: local / 6500, index };
}

export function drawBedroomSleepScenery(ctx) {
  const { scenery, rug } = ctx;
  scenery(2, '床边地毯', g => rug(g, .8, 6, 5.1, 3.25));
}

export function createBedroomBlanketDrawer(ctx) {
  const { el, box, top, point, blue, cream } = ctx;
  return (g, occupied = false) => {
    const q = el('g', { 'data-room-prop': 'quilt' });
    g.append(q);
    box(q, 1.05, 7.2, .95, 2.85, 1.9, occupied ? .23 : .1, blue);
    box(q, 1.05, 7.18, 1.08, 2.85, .3, .08, cream);
    for (let x = 1.22; x < 3.8; x += .68) {
      for (let y = 7.65; y < 9; y += .55) {
        top(q, x, y, occupied ? 1.19 : 1.06, .3, .3, '#84a4d7');
      }
    }
    const [p, qy] = point(2.4, 8.2, occupied ? 1.2 : 1.08);
    q.append(el('path', { d: `M ${p - 15} ${qy} q -4 -10 9 -11 q 16 -2 21 8 l 8 -6 l -1 12 l -10 -1 q -17 10 -27 -2`, fill: '#eaf0ef' }));
    return q;
  };
}

export function drawBedroomSleepItem(item, ctx, blanket) {
  const { draw, box, face, lantern, plant, wood, dark, cream } = ctx;
  switch (item.name) {
    case '床':
      draw(item, 2, 9, g => {
        box(g, .9, 5.95, .25, 3.15, 3.3, .4, wood);
        box(g, .9, 5.9, .4, 3.15, .22, 1.1, dark);
        box(g, 1.02, 6.18, .65, 2.91, 2.94, .3, cream);
        box(g, 1.3, 6.25, .95, 2.3, .75, .18, ['#d9e2f5', '#b0c0df', '#879bc2']);
        blanket(g);
      });
      return true;
    case '床头柜':
      draw(item, 2, 9.1, g => {
        box(g, .7, 8.8, 0, 1, 1, 1.1, wood);
        face(g, .8, 9.81, .25, .8, .55, '#bd864b');
        face(g, 1.1, 9.82, .49, .18, .08, cream[0]);
        lantern(g, .95, 9, 1.12);
      });
      return true;
    case '盆栽':
      draw(item, 2, 16, g => {
        plant(g, 4.7, 8.65, 0, 1);
        plant(g, .55, 4.95, 0, .8);
      });
      return true;
    case '挂画':
      draw(item, 2, 0, g => {
        box(g, 6.35, .24, 2.2, .75, .13, 1, dark);
        face(g, 6.43, .38, 2.29, .59, .82, '#74a4ba');
        face(g, 6.44, .39, 2.3, .57, .27, '#abc388');
        face(g, 6.76, .4, 2.87, .13, .13, '#f6e3a8');
      });
      return true;
    default:
      return false;
  }
}

export function createBedroomSleepArt({ doc, el, defs, clip, image, floor2, instance, quiltLayer, house, createRoomQuilt }) {
  const bedSurface = el('g', { 'data-bed-surface': 'v20', display: 'none', 'clip-path': clip('bed-surface-v20', '263,594 464,555 555,689 553,738 342,756 297,665') });
  const bedSurfaceImage = image();
  bedSurface.append(bedSurfaceImage);
  floor2.append(bedSurface);

  const bedSheet = el('g', { 'data-bed-sheet': 'v20', display: 'none', 'clip-path': clip('bed-sheet-v20', '263,594 464,555 555,689 553,738 342,756 297,665') });
  const bedSheetImage = image();
  bedSheet.append(bedSheetImage);
  floor2.append(bedSheet);

  const quiltPull = el('clipPath', { id: 'quilt-pull-v16', clipPathUnits: 'userSpaceOnUse' });
  const quiltRect = el('rect', { x: 330, y: 550, width: 250, height: 220 });
  quiltPull.append(quiltRect);
  defs.append(quiltPull);

  quiltLayer.picture.setAttribute('clip-path', 'url(#' + instance + 'room-front-wardrobe-quilt)');
  const paintQuilt = createRoomQuilt({ document: doc, root: quiltLayer.g, picture: quiltLayer.picture, id: instance + 'quilt-mesh' });

  const foldedQuilt = el('g', { display: 'none', 'data-folded-quilt': true, 'pointer-events': 'none' });
  const foldedQuiltViewport = el('svg', { x: 400, y: 620, width: 120, height: 78, viewBox: '365 260 830 580' });
  const foldedQuiltImage = el('image', { width: 1536, height: 1024 });
  foldedQuiltImage.setAttribute('clip-path', clip('folded-quilt-body', '369,469 394,439 815,269 868,276 1155,545 1181,585 1180,680 1149,713 685,830 649,829 423,620 406,551 377,514'));
  foldedQuiltViewport.append(foldedQuiltImage);
  foldedQuilt.append(foldedQuiltViewport);
  floor2.append(foldedQuilt);

  return {
    bedSurface,
    bedSurfaceImage,
    bedSheet,
    bedSheetImage,
    paintQuilt,
    foldedQuilt,
    foldedQuiltImage,
    applySleepVariation({ lifeSample, lifeAssets, motionTime, sleepStarted, sleepSeed, reduced, svg }) {
      let nextSample = lifeSample;
      if (!reduced && nextSample?.mode === 'sleep' && nextSample.phase === 'perform' && lifeAssets?.geometry.transition && !lifeAssets?.geometry.bedBody) {
        const e = roomSleepVariation(motionTime - sleepStarted, sleepSeed);
        svg.setAttribute('data-sleep-event', e?.kind || '');
        if (e) {
          const p = e.progress, wave = Math.sin(Math.PI * p), reference = Boolean(lifeAssets.geometry.sleepReference), g = lifeAssets.geometry.sleepReference || lifeAssets.geometry.sleepMotion;
          if (g) {
            const restPosition = [...nextSample.position], p0 = nextSample.frame, restHead = restPosition.map((v, i) => v + (p0.head[i] - p0.pivot[i]) * p0.scale);
            const cell = (e.kind === 'kick' ? 8 : 0) + Math.min(7, Math.floor(p * 8)), f = g.frames[cell];
            nextSample = {
              ...nextSample,
              pose: 'sleep-' + e.kind,
              restPosition,
              position: restHead,
              frame: {
                ...nextSample.frame,
                atlas: reference ? 'sleepReference' : 'sleepMotion',
                cell,
                sleepCell: reference ? undefined : cell,
                sleepReferenceCell: reference ? cell : undefined,
                transitionCell: undefined,
                bedReferenceCell: undefined,
                compositeQuilt: reference,
                pivot: [...f.head],
                head: [...f.head],
                scale: 188 / g.referenceHeight,
                rotation: 0,
              },
              cover: reference ? 1 : e.kind === 'kick' ? 1 - Math.sin(Math.PI * p) * .65 : 1,
              quiltLift: reference ? 0 : e.kind === 'kick' ? Math.sin(Math.PI * p * 2) ** 2 * 8 : wave * 3,
              variation: e.kind === 'kick' ? '蜷起腿，轻轻踢开被角，再拉回来' : '轻轻侧过身，继续睡觉',
            };
          }
        }
      } else {
        svg.setAttribute('data-sleep-event', '');
      }
      if (!reduced && nextSample?.mode === 'sleep' && nextSample.phase === 'perform' && lifeAssets?.geometry.bedBody) {
        const event = roomSleepVariation(motionTime - sleepStarted, sleepSeed);
        if (event) {
          const stages = event.kind === 'kick' ? [8, 10, 10, 8] : [8, 9, 9, 8], at = Math.min(3, Math.floor(event.progress * 4)), cell = stages[at], next = stages[Math.min(3, at + 1)], g = lifeAssets.geometry.bedBody;
          const pose = c => ({ ...nextSample.frame, cell: c, bedBodyCell: c, pivot: g.frames[c].head, head: g.frames[c].head });
          nextSample = {
            ...nextSample,
            pose: 'sleep-' + event.kind,
            frame: pose(cell),
            nextFrame: pose(next),
            duration: 1625,
            progress: event.progress * 4 - at,
            cover: event.kind === 'kick' ? 1 - Math.sin(Math.PI * event.progress) * .35 : 1,
            variation: event.kind === 'kick' ? '轻轻踢开被角，再拉回来' : '翻个身，继续睡觉',
          };
        }
      }
      return nextSample;
    },
    syncVisibility({ crossing, floor, panning, lifeAssets, lifeSample, quiltCover, setAttr }) {
      if (lifeAssets?.mattress) {
        setAttr(quiltLayer.g, 'display', !crossing && !lifeSample?.frame?.compositeQuilt && !(lifeAssets.foldedQuilt && quiltCover === 0) && (floor === 'all' || floor === '2' || panning) ? 'inline' : 'none');
      }
      setAttr(foldedQuilt, 'display', lifeAssets?.foldedQuilt && quiltCover < .25 && !lifeSample?.frame?.compositeQuilt && !crossing && (floor === 'all' || floor === '2' || panning) ? 'inline' : 'none');
    },
    updateQuilt({ lifeSample, lifeAssets, quiltCover, transition, floor }) {
      const nextCover = lifeSample?.mode === 'sleep' ? (lifeSample.cover ?? quiltCover) : quiltCover;
      paintQuilt(nextCover, lifeSample?.quiltLift || 0);
      bedSheet.setAttribute('opacity', Math.max(0, (nextCover - .6) / .4));
      foldedQuilt.setAttribute('opacity', Math.max(0, 1 - nextCover / .25));
      quiltLayer.g.setAttribute('opacity', lifeAssets?.foldedQuilt ? Math.min(1, nextCover / .25) : 1);
      foldedQuilt.setAttribute('display', lifeAssets?.foldedQuilt && nextCover < .25 && !lifeSample?.frame?.compositeQuilt && !transition && (floor === 'all' || floor === '2') ? 'inline' : 'none');
      return nextCover;
    },
    applyAssets(assets) {
      if (assets.bedding) {
        bedSheetImage.setAttribute('href', assets.bedding);
        bedSheet.setAttribute('display', 'inline');
      }
      if (assets.foldedQuilt) foldedQuiltImage.setAttribute('href', assets.foldedQuilt);
      if (assets.bedding) {
        bedSurfaceImage.setAttribute('href', assets.mattress || assets.bedding);
        bedSurface.setAttribute('display', 'inline');
        quiltLayer.picture.setAttribute('href', assets.bedding);
        const p = quiltLayer.picture;
        for (const [k, v] of Object.entries({ x: 0, y: 0, width: house.width, height: house.height, transform: '', 'clip-path': 'url(#' + instance + 'room-front-wardrobe-quilt)' })) {
          p.setAttribute(k, v);
        }
        if (assets.quilt && !assets.geometry.bedBody) {
          const q = assets.quilt, [x, y, w, h] = q.crop;
          p.setAttribute('href', q.url);
          p.setAttribute('x', 330 - x * 218 / w);
          p.setAttribute('y', 618 - y * 136 / h);
          p.setAttribute('width', q.width * 218 / w);
          p.setAttribute('height', q.height * 136 / h);
          p.setAttribute('clip-path', 'none');
          p.setAttribute('transform', 'translate(878,0) scale(-1,1)');
        }
      }
    },
  };
}

export function installBedroomSleepSequences({ make, step, sequence, route, geometry }) {
  const { def, add } = make('sleep', 'bed');
  add('stand', 23, [581, 611]);
  add('edge', 0, [575, 648]);
  add('lower', 1, [578, 658]);
  const bedApproach = route(add, 'bed-approach', [[581, 611], [575, 648]]);
  for (const i of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) {
    const covered = i >= 7 && i <= 21, pivot = covered ? [.48, .72] : [.55, .80], at = covered ? [386, 679] : i <= 4 ? [476, 655] : [405, 650];
    add('b' + i, i, at, covered ? 'bed' : 'hips', pivot, { prop: covered ? 'quilt' : null, headFraction: covered ? [.45, .22] : undefined });
  }
  def.poses.b2.at = [517, 655];
  def.poses.b3.at = [499, 655];
  def.poses.b22.at = [517, 655];
  if (geometry['sofa-rest']) {
    for (const id of ['b7', 'b8', 'b9', 'b10', 'b11', 'b12', 'b13', 'b14', 'b15', 'b16', 'b17', 'b18', 'b19', 'b20', 'b21']) {
      add(id, ['b7', 'b8', 'b18', 'b19', 'b20', 'b21'].includes(id) ? 0 : 1, [323, 625], 'bed', [.25, .45], { atlas: 'sofa-rest', scale: .48, rotation: -20, prop: 'quilt' });
    }
  }
  def.poses.b5.at = [405, 644];
  def.poses.b6.at = [365, 632];
  if (geometry['bed-entry']) {
    const entries = { b2: [0, 489, 565, 0], b3: [1, 460, 575, 0], b4: [2, 422, 583, 0], b5: [3, 383, 598, 0], b6: [4, 339, 615, 0], b7: [4, 325, 621, .2], b8: [4, 325, 621, .6], b9: [5, 325, 621, 1], b10: [5, 325, 621, 1], b11: [6, 325, 621, 1], b12: [5, 325, 621, 1], b13: [6, 325, 621, 1], b14: [6, 325, 621, 1], b15: [5, 325, 621, 1], b16: [5, 325, 621, 1], b17: [5, 325, 621, 1], b18: [4, 325, 621, 1], b19: [7, 383, 598, .3], b20: [2, 422, 583, 0], b21: [1, 460, 575, 0], b22: [0, 489, 565, 0] };
    for (const [id, [cell, x, y, cover]] of Object.entries(entries)) {
      const atlas = geometry['bed-entry'], f = atlas.frames[cell];
      def.poses[id] = { atlas: 'bed-entry', cell, bedCell: cell, at: [x, y], support: cell >= 4 && cell <= 6 ? 'bed' : 'hips', prop: cover ? 'quilt' : null, pivot: [...f.head], head: [...f.head], scale: 188 / atlas.referenceHeight, cover };
    }
  }
  def.still = 'b10';
  def.entry = [step('stand', 180), ...bedApproach.steps, ...sequence(['edge', 'lower', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9'], 650)];
  def.variations = [
    { name: '盖好被子，安静睡一会', frames: [step('b10', 18000), step('b11', 13000), step('b12', 18000)] },
    { name: '轻轻翻身，继续睡觉', frames: [...sequence(['b13', 'b14', 'b15', 'b16'], 800), step('b17', 20000), step('b16', 15000), step('b10', 15000)] },
  ];
  const bedBack = bedApproach.backSteps(bedApproach.positions.length - 1);
  for (const [id, pose] of Object.entries(def.poses)) {
    def.exits[id] = id === 'stand'
      ? []
      : pose.route
        ? [...bedApproach.backSteps(pose.routeIndex), step('stand', 120)]
        : [...(id === 'edge' ? [] : id === 'lower' ? sequence(['edge']) : sequence([...(pose.support === 'bed' ? ['b18', 'b19', 'b20', 'b21'] : ['b4', 'b3', 'b2']), 'b22', 'lower', 'edge'], 400)), ...bedBack, step('stand', 120)];
  }
}

export function installBedBody(defs, geometry) {
  const d = defs.sleep, g = geometry.bedBody, scale = 188 / g.referenceHeight, step = (pose, duration = 600, move = false) => ({ pose, duration, move });
  const contacts = [[405, 780], [405, 780], [414, 720], [414, 720], [410, 707], [405, 684], [325, 625], [325, 625], [325, 625], [325, 625], [325, 625], [335, 621], [416, 714], [414, 720], [405, 780], [405, 780]];
  for (let i = 0; i < 16; i++) {
    const f = g.frames[i], feet = [0, 1, 14, 15].includes(i), lying = i >= 6 && i <= 11, pivot = feet ? f.anchor : lying ? f.head : f.hip;
    d.poses['bed-body-' + i] = { atlas: 'bedBody', cell: i, bedBodyCell: i, at: contacts[i], support: feet ? 'feet' : lying ? 'bed' : 'hips', pivot, head: f.head, scale, prop: null, cover: [8, 9, 10, 11].includes(i) ? 1 : i === 12 ? .3 : 0, articulated: true, compositeQuilt: false, rotation: lying ? 14 : 0 };
  }
  for (const i of [1, 2, 3, 4, 5, 6, 7, 13, 14]) d.poses['bed-body-' + i].cover = .2;
  d.poses['bed-open'] = { ...d.poses['bed-body-0'], cover: .2 };
  const walk = (from, to, prefix) => {
    const count = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 7));
    return Array.from({ length: count + 1 }, (_, i) => {
      const cell = i % 8, f = geometry.walk.frames[cell], id = prefix + i;
      d.poses[id] = { atlas: 'walk', cell, at: from.map((v, k) => v + (to[k] - v) * i / count), support: 'feet', prop: null, pivot: [f.crop[0] + f.crop[2] * .48, f.crop[1] + f.crop[3] * .98], head: [f.crop[0] + f.crop[2] * .5, f.crop[1] + f.crop[3] * .22], scale: 190 / geometry.walk.frames[0].crop[3], flip: to[0] >= from[0] ? 1 : -1, cover: 0 };
      return step(id, 86, true);
    });
  };
  const origin = d.poses.stand.at, approach = [...walk(origin, [572, 790], 'body-outside-'), ...walk([572, 790], [405, 780], 'body-front-')], leave = [...walk([405, 780], [572, 790], 'body-leave-'), ...walk([572, 790], origin, 'body-home-'), step('stand', 120)];
  const enter = [step('bed-body-0', 800), step('bed-body-1', 1000), step('bed-open', 500), ...[14, 13, 2, 3, 4, 5, 6].map(i => step('bed-body-' + i, i === 4 || i === 5 ? 950 : 650)), step('bed-body-7', 1500), step('bed-body-8', 1200)];
  const exit = [step('bed-body-8', 500), step('bed-body-11', 900), step('bed-body-12', 950), step('bed-body-2', 550), step('bed-body-13', 650), step('bed-body-14', 600), step('bed-body-15', 1100), step('bed-body-0', 900), ...leave];
  d.entry = [...approach, ...enter];
  d.still = 'bed-body-8';
  d.variations = [{ name: '枕好枕头，拉好被子安静休息', frames: [step(d.still, 60000)] }];
  for (const id of Object.keys(d.poses)) {
    const a = approach.findIndex(s => s.pose === id), b = enter.findIndex(s => s.pose === id);
    d.exits[id] = id === 'stand' ? [] : a >= 0 ? [...approach.slice(0, a).reverse(), step('stand', 120)] : b >= 0 ? [...enter.slice(b + 1), ...exit] : [...exit];
  }
}

export function installBedReference(defs, geometry) {
  const d = defs.sleep, g = geometry.bedReference, step = (pose, duration = 260, move = false) => ({ pose, duration, move });
  const scale = 188 / g.referenceHeight;
  for (let cell = 0; cell < 24; cell++) {
    const places = { 7: [530, 730], 8: [510, 720], 9: [485, 710], 10: [470, 710], 11: [460, 710], 12: [460, 710], 13: [470, 710], 14: [485, 710], 15: [510, 720], 16: [530, 730] };
    const f = g.frames[cell];
    d.poses['bed-ref-' + cell] = { atlas: 'bedReference', cell, bedReferenceCell: cell, at: places[cell] || [540, 740], support: cell < 3 || cell >= 19 ? 'feet' : cell >= 8 && cell <= 14 ? 'bed' : 'hips', prop: null, pivot: [...f.hip], head: [...f.head], scale, articulated: true, compositeQuilt: true, cover: cell >= 10 && cell <= 14 ? 1 : 0 };
  }
  const walk = (from, to, prefix) => {
    const count = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 7));
    return Array.from({ length: count + 1 }, (_, i) => {
      const cell = i % 8, f = geometry.walk.frames[cell], id = prefix + i;
      d.poses[id] = { atlas: 'walk', cell, at: from.map((v, k) => v + (to[k] - v) * i / count), support: 'feet', prop: null, pivot: [f.crop[0] + f.crop[2] * .48, f.crop[1] + f.crop[3] * .98], head: [f.crop[0] + f.crop[2] * .5, f.crop[1] + f.crop[3] * .22], scale: 190 / geometry.walk.frames[0].crop[3], flip: to[0] >= from[0] ? 1 : -1, cover: 0 };
      return step(id, 86, true);
    });
  };
  const contact = f => [540 + (f.feet[0] - f.hip[0]) * scale, 740 + (f.feet[1] - f.hip[1]) * scale];
  const origin = d.poses.stand.at, front = contact(g.frames[0]), end = contact(g.frames[23]);
  const approach = [...walk(origin, [572, 790], 'reference-outside-'), ...walk([572, 790], front, 'reference-front-')];
  const leave = [...walk(end, [572, 790], 'reference-leave-'), ...walk([572, 790], origin, 'reference-home-'), step('stand', 120)];
  const entry = Array.from({ length: 12 }, (_, i) => step('bed-ref-' + i, [260, 300, 260, 350, 300, 260, 300, 300, 350, 300, 600, 1000][i]));
  const exit = Array.from({ length: 12 }, (_, i) => step('bed-ref-' + (i + 12), [300, 500, 400, 400, 300, 300, 400, 350, 300, 500, 500, 500][i]));
  d.entry = [...approach, ...entry];
  d.still = 'bed-ref-11';
  d.variations = [{ name: '枕好枕头，拉好被子安静休息', frames: [step(d.still, 60000)] }];
  for (const id of Object.keys(d.poses)) {
    const a = approach.findIndex(s => s.pose === id), cell = d.poses[id].bedReferenceCell;
    if (id === 'stand') d.exits[id] = [];
    else if (a >= 0) d.exits[id] = [...approach.slice(0, a).reverse(), step('stand', 120)];
    else if (Number.isInteger(cell) && cell < 12) d.exits[id] = [...entry.slice(cell + 1), ...exit, ...leave];
    else if (Number.isInteger(cell)) d.exits[id] = [...exit.slice(cell - 12 + 1), ...leave];
    else {
      const i = leave.findIndex(s => s.pose === id);
      d.exits[id] = i >= 0 ? leave.slice(i + 1) : [...exit, ...leave];
    }
  }
}

export const BEDROOM_SLEEP_AREA = {
  id: 'bedroom-sleep',
  floor: 2,
  title: '卧室睡眠区',
  features: BEDROOM_SLEEP_FEATURES,
  cameraCenters: BEDROOM_SLEEP_CAMERA_CENTERS,
  workspaceGroups: BEDROOM_SLEEP_WORKSPACE_GROUPS,
  occluders: BEDROOM_SLEEP_OCCLUDERS,
  drawScenery: drawBedroomSleepScenery,
  drawItem: drawBedroomSleepItem,
  createArt: createBedroomSleepArt,
  installSequences: installBedroomSleepSequences,
};
