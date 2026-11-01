# 伪从绫开始的面板 1.11 优化版

1.1 的动作与房间体验修订版，安装包版本 **1.1.1**，标签 **v1.1.1**。

## 本次更新

| 项目 | 更新内容 |
| --- | --- |
| 走路与脚部 | 13 套服装补充完整八帧步态，调整脚底接触并修正翻脚问题。 |
| 坐姿与工作 | 补充电脑椅落座动作，细分椅背/扶手遮挡；打字、写字改为稳定身体和头部、局部手部运动。 |
| 上床与下床 | 按参考分镜重做掀被、坐床沿、支撑抬腿、躺下、拉被，以及推被、坐起、双脚落地、起身和折被。 |
| 睡眠 | 增加翻身和概率踢被子，保留睡眠停留；离床后保留折好的被子。 |
| 活动过渡 | 补充沙发、露台和书桌的坐下/站起，改善活动中断后的退出衔接。 |
| 随机散步 | 在两层的 8 个安全地点间随机选目标，经通道和楼梯移动。 |
| 房间接续 | 重开房间恢复楼层、路线和动作进度，按离开时间推进状态。 |
| 全服装适配 | 原装及 13 套服装均接入每套 24 个上下床姿态、16 个翻身/踢被姿态，增加素材校验和失败保护。 |

保留双层 MC 小屋、19 件默认物品、科技镜衣柜及预览、家具专属工作区和本地电脑时间窗景。仅分发陪伴中心套件，不包含其他插件、个人数据或账号配置。

## 包体积优化

安装包只携带当前运行所需的完整构建代码、内嵌服装/动作素材及图片路由资源，并保留 1.1 公开版兼容块，去除内部修订的重复构建块。源码 ZIP 保留全部可编辑源码、原始动作图片及完整性清单，省略可重新生成的客户端构建文件；开发前请先运行 `npm run build`，再运行 `npm test`。两种包的用途不同，安装包无需编译，源码包可重新生成全部客户端资源。

## 下载与升级

- **安装包：** [dsh-whale-status-1.1.1.tgz](https://github.com/xinghailiuli/pseudo-congling-panel/releases/download/v1.1.1/dsh-whale-status-1.1.1.tgz)
- **完整源码：** [pseudo-congling-panel-1.1.1-source.zip](https://github.com/xinghailiuli/pseudo-congling-panel/releases/download/v1.1.1/pseudo-congling-panel-1.1.1-source.zip)
- **校验文件：** [SHA256SUMS.txt](https://github.com/xinghailiuli/pseudo-congling-panel/releases/download/v1.1.1/SHA256SUMS.txt)
- **[详细更新与使用说明](https://github.com/xinghailiuli/pseudo-congling-panel/blob/v1.1.1/docs/UPDATE_1.11.md)**

保留原 profile 和数据目录，安装后重新载入 DSH 客户端：

```powershell
dsh plugin --profile desktop add ./dsh-whale-status-1.1.1.tgz
```

本版继续以预发布提供。自动化、解包及隔离动作检查不等于实际 DSH 画面验收；2D 动作的流畅度和特定服装接触问题仍欢迎反馈。[发布验证范围](https://github.com/xinghailiuli/pseudo-congling-panel/blob/v1.1.1/docs/VERIFICATION.md)。

角色来源：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。素材及衍生作品禁止商用，介绍、展示和分发须保留原作者链接；程序代码许可与素材许可分开，见仓库 THIRD_PARTY_NOTICES.md。

发布验证：公开版 205 项测试通过；1,122 张图片完整性检查通过。完整结果和限制见上面的发布验证范围。
