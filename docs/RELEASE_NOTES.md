# 伪从绫开始的面板 1.1 · 小屋生活与换装更新

本次汇总 1.0 发布后的琉璃陪伴中心更新。插件包名仍为 `dsh-whale-status`，版本 `1.1.0`。

- **更多生活动作**：沙发坐卧与零食、园艺浇水除草、入床盖被子、坐姿写字打字、阅读与露台休息；放慢轮换，补充收工具和离座过渡。
- **科技镜衣柜**：二楼挂画替换为镜子；13 套服装，每套 16 个基础姿态，另保留原装角色。选择在本地保存。
- **常驻试衣预览**：下方直接查看换装和动作，不影响主房间当前活动。
- **家具工作区**：电脑承载记忆/人格、附魔台承载日记、床承载长夜/梦境；五个重复侧栏入口移除。
- **本地时段窗景**：跟随查看者电脑的时间和时区显示晨昼暮夜。
- **动作与遮挡修正**：沙发方向、换装书桌坐姿、被子条件、园艺通道、走路脚点、预览遮罩冲突及动作交接。

[完整更新详情与配图](https://github.com/xinghailiuli/pseudo-congling-panel/blob/v1.1.0/docs/UPDATE_1.1.md) · [小黑盒发帖稿](https://github.com/xinghailiuli/pseudo-congling-panel/blob/v1.1.0/docs/XIAOHEIHE_POST.md) · [验证记录](https://github.com/xinghailiuli/pseudo-congling-panel/blob/v1.1.0/docs/VERIFICATION.md)

## 下载

- `dsh-whale-status-1.1.0.tgz`：DSH 安装包，保持扩展名。
- `pseudo-congling-panel-1.1.0-source.zip`：完整源码与构建产物。
- `SHA256SUMS.txt`：两份下载文件的校验值。

安装示例：`dsh plugin --profile desktop add ./dsh-whale-status-1.1.0.tgz`。使用自己的 profile，升级前备份原数据目录，详见 [安装说明](https://github.com/xinghailiuli/pseudo-congling-panel/blob/v1.1.0/README.md#安装)。仅含本套件，不需要另装桌宠插件，不包含个人数据或其他插件。

## 验证边界

本版标记为 **Pre-release**：公开版自动化测试和解包启动/资源检查已完成，真实 DSH 界面与动作观感仍待使用者验收。新衣服有基础动态，尚未逐套覆盖原装角色全部精细持物动作。外部记忆、日记、QQ 等功能需要用户自行接入。

角色素材来源：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。功能设计参考：[从绫开始](https://github.com/LUOSHUI319/astrbot_plugin_congling)。原创代码 MIT；角色及衍生素材有署名和非商用要求，请保留原作者链接。小屋为 2D 场景，不控制真实 Minecraft。
