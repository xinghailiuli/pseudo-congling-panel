# 伪从绫开始的面板 1.3 · 完全重制版

星海回响：DSH 中的双层鲸鱼小屋、生活动作、更衣室和本地阅读。

![小屋实际界面](docs/screenshots/1.3/01-living-room.png)

## 本次更新

从 v1.2.0 升级：星海 HUD、紧凑动作面板、侧边更衣室、模块化加载、动态精力与模拟心率、阅读导入，以及资源无损压缩。保留 11 项生活动作、原装及 13 套服装、19 件家具和已有数据。

- [完整更新详情](docs/UPDATE_1.3.md)
- [小黑盒发帖稿](docs/XIAOHEIHE_POST_1.3.md)
- [验证范围](docs/VERIFICATION.md)
- [发布下载](https://github.com/xinghailiuli/pseudo-congling-panel/releases/tag/v1.3.0)

## 安装和升级

下载 Release 中的 **dsh-whale-status-1.3.0.tgz**，在 DSH 插件安装入口选择本地安装包。它是完整安装包，无需先安装 1.2 补丁。升级前备份现有 DSH 配置及插件数据；保留原插件身份和本地存储，不要卸载清空数据。

若升级后旧宿主资源缓存导致图片 404，请等正在执行的任务结束，再正常重启 DSH。不要清空浏览器存储。源码 ZIP 用于开发，showcase ZIP 是发帖图文素材。

默认数据目录为 LIULI_DATA_DIR，或 DSH_HOME 下的 .dsh/data/dsh-whale-status。首次安装使用无个人历史的 19 件家具默认房间；已有自定义房间不会重新初始化。

小屋可独立使用。QQ、长期记忆、日记和模型生成功能需要用户自行接入兼容服务；缺少服务会显示未接入，不会自动联系 QQ 或 Minecraft。详细接口见 [INTEGRATIONS](docs/INTEGRATIONS.md)。

## 源码构建

使用 Node.js 24，在源码目录执行：

```powershell
npm run build
npm test
npm pack
```

源码包保留原始图片和无损交付副本，生成客户端位于 lib/。安装包无需编译。房间为 2D 分层动画，花海岛为独立场景；心率是活动模拟值，不是生理测量。不同服装的精细动作覆盖仍有差别。

## 许可与致谢

角色来源：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。程序代码 MIT；角色、动画及相关衍生素材须署名并遵守非商用限制，不属于全素材 MIT。见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) 和 [素材来源](assets/SOURCES.md)。
