import { installRoomLeisureV20 } from './room-contact-v20.mjs';
import { installLivingLoungeSequences, installGreenhouseTerraceSequences, installComputerWorkspaceSequences, installComputerDeskTransitions, installBedroomSleepSequences, installBedBody, installBedReference, installLibraryReadingSequences, roomSleepVariation } from './areas/area-registry.mjs';

// 模块 D（生活动作序列协调器）：提供通用姿态构造与路径插值器，并协调各功能区域模块注册校准后的 1536×1024 局部坐标姿态序列与过渡。
export function createRoomLifeDefinitions(geometry) {
  const defs = {}, step = (pose, duration = 180, move = false) => ({ pose, duration, move });
  const make = (mode, atlas, height = 190) => {
    const def = { poses: {}, entry: [], variations: [], exits: {}, still: null };
    defs[mode] = def;
    const reference = { sofa: 0, garden: 2, bed: 0, desk: 0, upper: 6, walk: 0, carry: 0, cover: 0, 'sofa-rest': 0 };
    const add = (id, cell, at, support = 'feet', pivot = [.5, .98], extra = {}) => {
      const name = extra.atlas || atlas, g = geometry[name], frame = g?.frames[cell];
      if (!frame) throw new TypeError('Missing full character: ' + name + '/' + cell);
      const crop = frame.crop, scale = height / geometry[name].frames[reference[name]].crop[3];
      def.poses[id] = {
        atlas: name,
        cell,
        at: [...at],
        support,
        prop: null,
        pivot: [crop[0] + crop[2] * pivot[0], crop[1] + crop[3] * pivot[1]],
        scale,
        head: [crop[0] + crop[2] * .5, crop[1] + crop[3] * .22],
        ...extra,
      };
      return id;
    };
    return { def, add };
  };
  const sequence = (ids, duration = 180) => ids.map(id => step(id, duration));
  const route = (add, prefix, points, prop = null, carried = false) => {
    const positions = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7.75);
      for (let n = 1; n <= count; n++) positions.push(a.map((v, j) => v + (b[j] - v) * n / count));
    }
    const forward = [], backward = [];
    positions.forEach((at, i) => {
      const frame = carried ? i % 8 + (prop === 'hoe' ? 8 : 0) : i % 8, atlas = carried ? 'carry' : 'walk', next = positions[Math.min(i + 1, positions.length - 1)], facing = next[0] >= at[0] ? 1 : -1;
      forward.push(add(prefix + '-' + i, frame, at, 'feet', [.48, .98], { atlas, prop, flip: carried ? -facing : facing, route: prefix, routeIndex: i }));
      backward.push(add(prefix + '-back-' + i, frame, at, 'feet', [.48, .98], { atlas, prop, flip: carried ? facing : -facing, route: prefix, routeIndex: i }));
    });
    return {
      positions,
      forward,
      backward,
      steps: forward.map(id => step(id, 86, true)),
      backSteps: index => backward.slice(0, index + 1).reverse().map(id => step(id, 86, true)),
    };
  };

  const ctx = { defs, geometry, make, step, sequence, route };
  installLivingLoungeSequences(ctx);
  installGreenhouseTerraceSequences(ctx);
  installComputerWorkspaceSequences(ctx);
  installBedroomSleepSequences(ctx);
  installLibraryReadingSequences(ctx);

  if (geometry.transition) installFurnitureTransitions(defs, geometry);
  if (geometry.bedReference) installBedReference(defs, geometry);
  if (geometry.bedBody) installBedBody(defs, geometry);
  installRoomLeisureV20(defs, geometry);
  return defs;
}

// The body drawings articulate at the support point. Do not interpolate a
// sleeping cutout across the mattress between these frames.
function installFurnitureTransitions(defs, geometry) {
  const g = geometry.transition, scale = 188 / g.referenceHeight;
  const pose = (cell, at, support = 'hips', extra = {}) => {
    const f = g.frames[cell];
    return { atlas: 'transition', cell, transitionCell: cell, at: [...at], support, prop: null, pivot: [...f.hip], head: [...f.head], scale, articulated: true, ...extra };
  };
  const step = (name, duration = 115, move = false) => ({ pose: name, duration, move });
  const walkTo = (d, from, to, prefix) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.max(1, Math.ceil(length / 7));
    const names = [];
    for (let i = 0; i <= n; i++) {
      const cell = i % 8, f = geometry.walk.frames[cell], p = from.map((v, k) => v + (to[k] - v) * i / n), id = prefix + i;
      d.poses[id] = { atlas: 'walk', cell, at: p, support: 'feet', prop: null, pivot: [f.crop[0] + f.crop[2] * .48, f.crop[1] + f.crop[3] * .98], head: [f.crop[0] + f.crop[2] * .5, f.crop[1] + f.crop[3] * .22], scale: 190 / geometry.walk.frames[0].crop[3], flip: to[0] >= from[0] ? 1 : -1 };
      names.push(id);
    }
    return names.map(id => step(id, 86, true));
  };
  installComputerDeskTransitions(defs, geometry, { walkTo, step });
  for (const mode of ['sleep', 'lounge', 'rest']) {
    const d = defs[mode], sleep = mode === 'sleep', target = sleep ? [490, 660] : mode === 'lounge' ? [755, 674] : [1140, 661], floor = sleep ? [490, 785] : mode === 'lounge' ? [740, 742] : [1128, 738], origin = d.poses.stand.at;
    const approach = sleep ? [...walkTo(d, origin, [572, 780], 'approach-outside-'), ...walkTo(d, [572, 780], floor, 'approach-front-')] : walkTo(d, origin, floor, 'approach-contact-');
    if (sleep) {
      d.poses.stand.cover = 0;
      for (const s of approach) d.poses[s.pose].cover = 0;
    }
    const lower = [];
    for (let i = 0; i < 8; i++) {
      const f = g.frames[16 + i], p0 = g.frames[16], start = [floor[0], floor[1] - (p0.anchor[1] - p0.hip[1]) * scale], at = start.map((v, k) => v + (target[k] - v) * i / 7), id = 'settle-' + i;
      d.poses[id] = pose(16 + i, at, i < 6 ? 'feet' : 'hips', { cover: sleep ? 0 : 1 });
      lower.push(step(id, 125));
    }
    const enter = [...approach, ...lower, step('settle-7', 350)];
    if (sleep) {
      const bed = [];
      for (let i = 0; i < 16; i++) {
        const amount = Math.min(1, i / 8), at = [490 + (450 - 490) * amount, 660 + (615 - 660) * amount], id = 'bed-joint-' + i;
        d.poses[id] = pose(i, at, i < 10 ? 'hips' : 'bed', { prop: i >= 12 ? 'quilt' : null, cover: i < 13 ? 0 : (i - 12) / 3 });
        bed.push(step(id, i >= 12 ? 500 : i === 0 ? 350 : 150));
      }
      enter.push(...bed);
      d.still = 'bed-joint-15';
      d.variations = [{ name: '盖好被子，安静睡觉', frames: [step(d.still, 60000)] }];
      d.sleepEvents = true;
    } else enter.push(step(d.still, 250));
    d.entry = enter;
    const outward = [...lower.slice(0, 7).reverse().map(s => step(s.pose, 125)), ...approach.slice().reverse().map(s => step(s.pose, 86, true)), step('stand', 120)];
    for (const id of Object.keys(d.poses)) {
      if (id === 'stand') { d.exits[id] = []; continue; }
      const at = enter.findIndex(s => s.pose === id);
      if (at >= 0) d.exits[id] = [...enter.slice(0, at).reverse().map(s => step(s.pose, s.move ? 86 : sleep && /^bed-joint-1[234]$/.test(s.pose) ? 550 : 150, s.move)), step('stand', 120)];
      else if (sleep) d.exits[id] = [...enter.slice().reverse().map(s => step(s.pose, s.move ? 86 : /^bed-joint-1[234]$/.test(s.pose) ? 550 : 150, s.move)), step('stand', 120)];
      else d.exits[id] = [...(d.exits[id] || []).filter(s => !['stand', 'lower'].includes(s.pose)), ...outward];
    }
  }
}

export { roomSleepVariation };
