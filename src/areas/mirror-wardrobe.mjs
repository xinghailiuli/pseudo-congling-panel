// 模块 B-7：全息试衣镜跨区域适配器（Holographic Mirror & Wardrobe Adapter）
// 职责：拥有二楼全息试衣镜（mirror）的热区配置、镜面修补图层（data-room-mirror="v12"）及换装入口适配。

export const MIRROR_WARDROBE_FEATURES = [
  {
    id: 'mirror',
    level: 2,
    label: '全息镜：换装',
    short: '全息镜 · 换装',
    title: '全息试衣镜',
    rect: [685, 171, 121, 169],
    mark: [797, 196],
    symbol: '衣',
  },
];

export function createMirrorWardrobeArt({ el, clip, image, floor2, house }) {
  const mirrorPatch = el('g', {
    'data-room-mirror': 'v12',
    'clip-path': clip('room-mirror-v12', [685, 171, 121, 169]),
    'pointer-events': 'none',
    display: house.mirror ? 'inline' : 'none',
  });
  const mirrorPicture = image(house.mirror);
  mirrorPatch.append(mirrorPicture);
  floor2.append(mirrorPatch);
  mirrorPicture.addEventListener('error', () => mirrorPatch.setAttribute('display', 'none'));

  return {
    mirrorPatch,
    mirrorPicture,
    applyArtAssets(assets) {
      if (assets?.mirror) {
        mirrorPicture.setAttribute('href', assets.mirror);
        mirrorPatch.setAttribute('display', 'inline');
      }
    },
  };
}

export const MIRROR_WARDROBE_AREA = {
  id: 'mirror-wardrobe',
  floor: 2,
  title: '全息镜换装区',
  features: MIRROR_WARDROBE_FEATURES,
  createArt: createMirrorWardrobeArt,
};
