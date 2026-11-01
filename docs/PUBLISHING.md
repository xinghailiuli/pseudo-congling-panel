# 维护和发布

仓库：[xinghailiuli/pseudo-congling-panel](https://github.com/xinghailiuli/pseudo-congling-panel)。本版展示名称为“伪从绫开始的面板 1.11 优化版”，包名始终为 `dsh-whale-status`。

## 准备版本

1. 从当前公开源码建立工作副本，保留独立数据目录、可选桥接与自带角色路由等可移植适配。
2. 更新 `package.json` 版本、README、CHANGELOG、详细更新说明和发布说明。
3. 仅纳入本面板代码与允许公开的素材，不打包个人状态、QQ/日记/记忆数据、运行令牌、其他插件、生成回执或整个个人工作区。
4. 使用 Node.js 24 执行：

   ```powershell
   npm run build
   npm test
   npm pack
   ```

5. 检查打包清单，解包到独立目录，从包内入口启动并检查房间与资源。`lib/`、工作区样式和全部懒加载块必须存在；PNG 本身不构成完整插件。
6. 文件与许可核查后提交源码和构建产物，正常推送 Git 分支并创建新版本标签，不覆盖已发布标签。

## GitHub Release

在仓库 **Releases → Draft a new release** 中，选对应提交创建 `v1.1.1` 标签，标题“伪从绫开始的面板 1.11 优化版 · 动作与小屋体验修订”。说明采用 [RELEASE_NOTES.md](RELEASE_NOTES.md)。

附上：

- `dsh-whale-status-1.1.1.tgz`：可安装插件。
- `pseudo-congling-panel-1.1.1-source.zip`：来自对应提交的源码。
- `SHA256SUMS.txt`：上述两文件的 SHA-256。

最终原生 DSH 界面未验收时标记 **Pre-release**，并保留具体验证边界。发布后核对远程提交/标签和附件，下载校验实际文件。

`.tgz` 给 DSH 安装；源码 ZIP 供查看与修改。无需制作 EXE，也不要通过改扩展名替代打包。令牌只交给凭据管理器，不写进 Git URL、源码或文档。

介绍、展示与分发始终保留角色来源：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。
