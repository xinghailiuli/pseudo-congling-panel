import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBlockRoom } from '../src/room-scene.mjs';
import { createRoomLifeDefinitions } from '../src/room-life-sequences.mjs';

const read = path => JSON.parse(readFileSync(new URL('../assets/' + path, import.meta.url)));
const geometry = read('room-life-v11/geometry.json');
const contacts = Object.fromEntries(['sofaSocial', 'sofaBody', 'idleChair'].map(key => [key, read('room-motion-v20/' + key + '-geometry.json')]));
for (const [key, all] of Object.entries(contacts)) geometry[key] = all.original;
const transitions = read('room-transition-v17/geometry.json');
const bedBodies = read('room-motion-v20/bed-geometry.json');
geometry.transition = transitions.original;
geometry.bedBody = bedBodies.original;
const definitions = createRoomLifeDefinitions(geometry);
const outfits = read('wardrobe-v1/geometry.json');
const supplements = {
  desk: read('wardrobe-v15/geometry.json'),
  walk: read('wardrobe-v16/walk-geometry.json'),
  transition: transitions,
  deskTransition: read('room-transition-v17/supplement-geometry.json').desk,
  bedBody: bedBodies,
  ...contacts,
};
const manifest = read('room-actions/manifest.json');
const url = 'data:image/png;base64,AAAA';
const payload = { version: 11, revision: 20, geometry, atlases: Object.fromEntries(Object.keys(geometry).map(key => [key, url])), greenhouse: url, mattress: url, foldedQuilt: url };
const room = { lamp: true, curtain: true, items: ['床', '书桌', '台灯', '窗', '沙发', '冰箱', '电视', '绿萝', '旧相册', '日记本', '记事本', '床头柜', '书架', '椅子', '电脑', '茶几', '挂画', '挂钟', '盆栽'].map((name, i) => ({ id: String(i), name })) };
class Element {
  constructor(tag) { this.tagName = tag; this.attributes = {}; this.children = []; this.isConnected = true; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  append(...children) { this.children.push(...children); }
  addEventListener() {}
}
const nodes = node => [node, ...node.children.flatMap(nodes)];
async function make(preview = 'lounge', outfit) {
  let frame;
  const document = { hidden: false, createElementNS(_, tag) { return new Element(tag); }, addEventListener() {}, removeEventListener() {} };
  const svg = createBlockRoom(room, { document, preview, actionAssets: { ...manifest, lifeV10: payload }, animation: { reducedMotion: false, random: () => 0, requestFrame: fn => { frame = fn; }, loadRoomImage: async () => {} } });
  await svg.roomLifeReady;
  if (outfit) assert.equal(svg.setRoomOutfit(outfit), true);
  frame(0);
  const all = nodes(svg), hit = all.find(node => node.attributes['aria-label'] === '摸摸小鲸鱼').children[0];
  return { svg, all, hit, tick: time => frame(time) };
}
function contains([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = polygon[i], [c, d] = polygon[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) inside = !inside;
  }
  return inside;
}
function covered(scene, mask, point) {
  if (mask.attributes.display !== 'inline') return false;
  if (!mask.attributes['clip-path']?.startsWith('url(#')) return false; // Independently alpha-cut quilt artwork has no floor repaint polygon.
  const id = mask.attributes['clip-path'].slice(5, -1);
  const clip = scene.all.find(node => node.attributes.id === id);
  const offset = Number(mask.attributes.transform.match(/translate\(0,([^)]*)/)[1]);
  return clip.children.some(node => node.attributes.points && contains([point[0], point[1] - offset], node.attributes.points.split(' ').map(pair => pair.split(',').map(Number))));
}
function assertFaceVisible(scene, label) {
  assert.equal(scene.svg.attributes['data-room-render-error'], undefined, label + ': renderer must finish the requested frame');
  const head = [Number(scene.hit.attributes.cx), Number(scene.hit.attributes.cy)];
  assert(head.every(Number.isFinite), label + ': finite rendered face');
  for (const mask of scene.all.filter(node => node.attributes['data-room-foreground'])) {
    assert.equal(covered(scene, mask, head), false, label + ': face hidden by ' + mask.attributes['data-room-foreground']);
  }
}

test('seated and reclining sofa actions keep the face visible above the near armrest', async () => {
  const scene = await make();
  const sofa = scene.all.find(node => node.attributes['data-room-foreground'] === 'sofa');
  assertFaceVisible(scene, 'initial seated pose');
  assert.equal(covered(scene, sofa, [800, 1840]), true, 'near armrest must still hide body pixels behind it');
  let time = 0;
  for (const step of definitions.lounge.variations.flatMap(variation => variation.frames)) {
    scene.tick(time + step.duration / 2);
    assert.equal(scene.svg.attributes['data-life-pose'], step.pose);
    assertFaceVisible(scene, scene.svg.attributes['data-life-pose']);
    time += step.duration;
  }
});

test('all furniture action loops keep the original face clear of polygon foregrounds', async () => {
  for (const mode of Object.keys(definitions)) {
    const scene = await make(mode);
    let time = 0;
    for (const step of definitions[mode].variations.flatMap(variation => variation.frames)) {
      scene.tick(time + step.duration / 2);
      assert.equal(scene.svg.attributes['data-life-pose'], step.pose, mode);
      assertFaceVisible(scene, mode + '/' + scene.svg.attributes['data-life-pose']);
      time += step.duration;
    }
    scene.svg.petRoomResident();
    assertFaceVisible(scene, mode + '/headpat');
  }
});

test('all thirteen outfits preserve furniture support and visible faces across contact actions', async () => {
  for (const [id, geometry] of Object.entries(outfits)) {
    const outfit = { version: 1, id, geometry, url, ...Object.fromEntries(Object.entries(supplements).map(([key, all]) => [key, { geometry: all[id], url }])) };
    for (const mode of Object.keys(definitions)) {
      const scene = await make(mode, outfit);
      let time = 0;
      for (const step of definitions[mode].variations.flatMap(variation => variation.frames)) {
        scene.tick(time + step.duration / 2);
        assert.equal(scene.svg.attributes['data-life-pose'], step.pose, id + '/' + mode);
        assertFaceVisible(scene, id + '/' + mode + '/' + scene.svg.attributes['data-life-pose']);
        time += step.duration;
      }
      const position = scene.svg.attributes['data-resident-feet'];
      scene.svg.setRoomOutfit(null);
      assert.equal(scene.svg.attributes['data-resident-feet'], position, 'changing clothes must keep the existing support location');
    }
  }
});

test('leaving the sofa restores the full silhouette used behind the sofa during walking', async () => {
  const scene = await make();
  const sofa = scene.all.find(node => node.attributes['data-room-foreground'] === 'sofa');
  const contactClip = sofa.attributes['clip-path'];
  scene.svg.setRoomActivity({ preview: 'walk' });
  for (let time = 100; time <= 30000 && scene.svg.attributes['data-room-activity'] !== 'walk'; time += 100) scene.tick(time);
  assert.equal(scene.svg.attributes['data-room-activity'], 'walk');
  assert.notEqual(sofa.attributes['clip-path'], contactClip);
  const id = sofa.attributes['clip-path'].slice(5, -1), clip = scene.all.find(node => node.attributes.id === id);
  assert(clip.children.some(node => contains([770, 600], node.attributes.points.split(' ').map(pair => pair.split(',').map(Number)))), 'backrest remains opaque for an actor behind the sofa');
});
