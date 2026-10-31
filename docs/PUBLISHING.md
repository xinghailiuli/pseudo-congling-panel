# 发布到 GitHub

仓库名称建议：`pseudo-congling-panel`。展示名称：**伪从绫开始的面板 1.0**。程序内部包名保留 `dsh-whale-status`，以免现有用户升级时被识别成另一个插件。

## 上传源码

只上传本源码目录的内容，不要上传它外面的个人工作区或 DSH profile。本目录已经排除私人状态、账号和其他插件。

1. 在 GitHub 新建一个 Public 仓库 `pseudo-congling-panel`。不要让 GitHub 再自动创建 README 或 LICENSE，本目录已提供。
2. 推荐用 GitHub Desktop 的 **Add local repository**：选择本目录，尚无 Git 仓库时创建，再 Publish repository。也可使用下面的 Git 命令。
3. 若使用命令行，在本目录执行（将 `YOUR_GITHUB_NAME` 替换为自己的 GitHub 用户名）：

   ```powershell
   git init -b main
   git add .
   git commit -m "Release pseudo Congling panel 1.0"
   git remote add origin https://github.com/YOUR_GITHUB_NAME/pseudo-congling-panel.git
   git push -u origin main
   ```

如果 Git 尚未配置提交署名，按 Git 的提示配置自己的用户名和邮箱。不要把令牌写进仓库或 URL。仓库内保留 `lib/` 构建产物，便于检查源码与发布内容。

## 创建下载版本

1. 进入仓库 **Releases → Draft a new release**。
2. 标签填写 `v1.0.0`，标题填写“伪从绫开始的面板 1.0”。
3. 复制 `docs/RELEASE_NOTES.md` 的内容作为说明。
4. 附上 `dsh-whale-status-1.0.0.tgz` 和发布目录的 `SHA256SUMS.txt`。源码 ZIP 可另附，GitHub 也会自动生成对应标签的源码下载。
5. 在你完成实际安装/画面验收前，可先勾选 **pre-release** 并在说明里保留验证边界；验收后再正式发布。

`.tgz` 是给 DSH 安装的；源码 ZIP 是给开发者查看、修改和上传的。不要把源码 ZIP 改后缀当插件包，也不需要做 EXE。

后续升级时，修改 `package.json` 的版本、更新发布说明，运行：

```powershell
npm run build
npm test
npm pack
```

每次介绍、展示或分发含角色素材的版本，都保留原作者地址：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。

参考：[DSH 官方发布文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)、[GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)。
