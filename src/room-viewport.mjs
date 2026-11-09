import { ROOM_CAMERA_CENTERS } from './areas/area-registry.mjs';

// 模块 A-2：楼层视角、人物特写相机与楼梯跨层门户（Room Viewport & Stair Portal）
// 职责：管理 1F / 2F / 双层总览（all）与人物特写（detail）的 viewBox 计算与平滑插值、楼层可见性同步以及跨楼层楼梯门户（data-stair-handoff）渐隐交接。

export function computeRoomTargetViewBox({ floor, detail, offsets, travelling, route, currentMode, residentLevel, centers = ROOM_CAMERA_CENTERS }) {
  if (detail) {
    const center = travelling ? [route.x, route.y - 80] : (centers[currentMode] || centers.walk);
    return [center[0] - 325, center[1] + offsets[residentLevel] - 216.5, 650, 433];
  }
  return floor === 'all' ? [0, 0, 1536, 2104] : [0, offsets[floor], 1536, 1024];
}

export function stepRoomCamera(camera, target, dt = 1000, force = false) {
  const alpha = force || !camera || dt > 1000 ? 1 : 1 - Math.exp(-Math.max(0, dt) / 180);
  return camera
    ? camera.map((v, i) => {
        const next = v + (target[i] - v) * alpha;
        return Math.abs(target[i] - next) < .02 ? target[i] : next;
      })
    : target;
}

export function shiftCameraAcrossPortal(camera, previousPortal, currentTransition, detail, offsets) {
  if (detail && previousPortal && !currentTransition && camera) {
    const p = previousPortal;
    camera[0] += p.to.x - p.from.x;
    camera[1] += p.to.y + offsets[p.to.floor] - p.from.y - offsets[p.from.floor];
  }
}

export function renderRoomStairPortal({ svg, portal, portalFloors, transition, detail, follow, offsets, setAttr }) {
  const active = Boolean(detail && transition && follow);
  setAttr(portal, 'display', active ? 'inline' : 'none');
  if (active) {
    const { from, to, progress } = transition;
    for (const [level, g] of Object.entries(portalFloors)) {
      const old = Number(level) === from.floor;
      g.setAttribute('opacity', old ? 1 - progress : progress);
      g.setAttribute('transform', old ? 'translate(0,' + offsets[from.floor] + ')' : 'translate(' + (from.x - to.x) + ',' + (from.y + offsets[from.floor] - to.y) + ')');
    }
    setAttr(svg, 'data-stair-progress', transition.progress);
  } else {
    setAttr(svg, 'data-stair-progress', '');
  }
}

export function syncRoomFloorVisibility({
  floor, detail, route, follow, camera, offsets,
  floors, featureLayers, resident, interaction, controls, upstairsControls,
  residentLevel, bedroomArt, lifeAssets, lifeSample, quiltCover, setAttr,
}) {
  const crossing = Boolean(detail && route?.transition && follow);
  const panning = camera && Math.abs(camera[1] - offsets[floor]) > 1;
  for (const [level, g] of Object.entries(floors)) {
    const visible = !crossing && (floor === 'all' || floor === level || panning);
    setAttr(g, 'display', visible ? 'inline' : 'none');
    setAttr(g, 'aria-hidden', String(!visible));
  }
  bedroomArt.syncVisibility({ crossing, floor, panning, lifeAssets, lifeSample, quiltCover, setAttr });
  const visible = crossing || floor === 'all' || floor === residentLevel || panning;
  setAttr(resident, 'display', visible ? 'inline' : 'none');
  setAttr(interaction, 'display', visible ? 'inline' : 'none');
  for (const [level, g] of Object.entries(featureLayers)) {
    const layerVisible = !crossing && (floor === 'all' || floor === level || panning);
    setAttr(g, 'display', layerVisible ? 'inline' : 'none');
    setAttr(g, 'aria-hidden', String(!layerVisible));
  }
  setAttr(controls, 'display', crossing || floor === '2' ? 'none' : 'inline');
  setAttr(upstairsControls, 'display', crossing || floor === '1' ? 'none' : 'inline');
}
