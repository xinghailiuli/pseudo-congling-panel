# 13 套服装 / Wardrobe v1

每个 `<id>.png` 为完整角色的 16 姿态图集。`catalog.json` 列出衣服 ID 与名称，`geometry.json` 提供逐帧裁切框和轮廓。原装角色仍使用独立的原始素材与生活动作。

构建程序读取上述文件，生成 `lib/client.wardrobe-<id>-v1.js`。`client.template.js` 处理按需加载与选择持久化，`src/room-wardrobe.mjs` 处理姿态、位置和局部动态；`panel.js` 提供镜子衣柜与常驻预览。不能只复制 PNG 完成接入。

本公开包不包含私人参考图或生成回执。素材是 AI 辅助制作的角色衍生图，遵循根目录 `THIRD_PARTY_NOTICES.md` 的非商用与署名条件。角色来源：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。
