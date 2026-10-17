# GitHub Actions 自动发布

完成本地修改后推送 `main`，即可关闭终端。GitHub 的 [Checks 工作流](https://github.com/lizaixi01/agent-spire/actions/workflows/ci.yml) 在云端完成版本更新、测试、Pages 部署和 Release 发布，不需要本机持续联网或等待。

```sh
git pull --ff-only
# 完成功能、说明和截图修改
git add .
git commit -m "Describe the update"
git push origin main
```

也可运行 `npm run release`，或在 Windows 双击 `发布更新.cmd`，自动提交所有已跟踪及未被 Git 忽略的本地修改并推送。此快捷命令需要本机 Git、Python 和可用的 GitHub Git 凭据；不再本地升版、运行完整发布或等待云端。`npm run release -- --dry-run` 仅预检。请在推送前检查 `git status`，确保文件都应公开。

## 云端流程

1. `main` 的 push 或手动 Run workflow 启动发布；PR 和其他分支只执行测试、类型检查及双构建，没有写仓库和发布权限。
2. 检查触发提交是否仍是最新源码；过期运行跳过发布。首次运行从当前包版本和最新 Release 的较高值递增补丁版本，自动更新 `package.json`、lockfile 根包和 README 版本标记区。
3. 在 runner 本地创建仅修改这三个文件的机器人版本提交。先不推送，执行 `npm ci`、全量游戏及发布工具测试、类型检查、下载包构建和真实解压启动检查、Pages 构建。任何失败均不推送版本提交、不部署、不发布。
4. 检查 main 是否前进；若有较新源码，将发布交给其排队运行。否则将通过验证的版本提交普通快进推回 main，绝不强推。GITHUB_TOKEN 的推送不会再次触发 push 工作流，避免循环升版。
5. 上传同一个干净版本提交的下载包和 Pages 产物。部署前再次检查 main，随后用官方 Pages Actions 部署 `dist-pages/`。
6. Pages 成功后，从本次 Actions 产物直接创建标签和草稿 Release，上传游玩 ZIP、`SHA256SUMS.txt`、`RELEASE-MANIFEST.json`，核对在线信息后发布。已有附件哈希一致时复用，不同则停止，绝不覆盖旧版。
7. 最后核对 main、版本标签、最新 Release、在线构建信息、ZIP 清单与三个远端附件哈希。只有全部一致才成功，Actions 摘要显示版本、提交、精确体积和体验/下载链接。

README 的自动区块为 `<!-- release-version:start -->` 到 `<!-- release-version:end -->`，请保留标记。功能介绍和截图由维护者在源码更新时编辑，自动流程只维护版本、文件名和入口。游戏界面直接读取包版本。精确体积写入 Release 说明和清单，避免把构建结果反复回写源码。

## 仓库设置与开发同步

- Pages 来源保持 **GitHub Actions**。main 的构建和发布 job 显式授予 `contents: write`；Pages 部署 job 使用 `pages: write`、`id-token: write`。使用仓库自带 GITHUB_TOKEN，不需要额外 PAT 或发布密钥。
- 当前 main 允许机器人普通推送；若以后增加分支保护或组织策略，需允许该发布方式，否则版本推送会明确失败，不绕过保护。
- 机器人会添加版本提交，下次修改前先 `git pull --ff-only`。本地已存在未提交修改时先妥善保存，再合并远端；不要强推覆盖机器人提交。
- main 的整个工作流串行且不主动取消正在发布的运行。连续快速推送时，GitHub 可能以最新等待运行替换中间等待运行，最新快照包含已合入的更新；不保证每个中间提交单独发布。旧源码运行不会覆盖新发布。

## 重试与失败恢复

打开失败运行，选择 **Re-run failed jobs**。也可 `gh run rerun <run-id> --failed`；本地无需保持运行。

- **测试失败：**查看日志，修复代码后再次推送 main。失败的临时版本提交未写回仓库。
- **版本提交已推送、部署或上传失败：**优先重试失败 job，复用同一个版本提交和已验证产物。已存在的匹配草稿/附件会续传；不重复升版。
- **重新运行全部 job：**通过机器人作者、直接父提交、`Release-Source` 标记和仅三个元数据文件的差异识别之前的版本提交，复用同一版本。ZIP 固定内部时间戳、权限和压缩设置，同一内容重建可保持相同哈希。Pages 产物按运行尝试编号命名，避免重试名称冲突。
- **main 已有更新：**不要重发旧运行；新 main 的排队运行负责统一发布。部署和发布前均会拒绝旧提交。
- **公网元数据尚未传播：**最多重试六次；仍不一致明确失败，确认 Pages 状态后重试。
- **权限、网络或产物过期：**修复权限或重新运行相同源码；不会自动改写旧标签/附件。若构建工具或输入变化导致已有附件哈希不同，停止并用后续新版本发布。

源码、Pages 和 Release 不能跨服务原子更新，失败期间可能短暂不同步；流程不回滚已推送的提交或已部署站点，以最终一致性检查作为完成标准。

## 轻量包和独立验证

ZIP 保持 **10 MiB 硬上限**，超出立即失败。仅打包 `dist/`、Windows 启动器、零依赖 Node 服务器、游玩/资源说明及字体许可。Node.js、`node_modules`、测试、发布工具、源码、教材和历史素材均不进入游玩包。在线版无需安装 Node.js；离线包仍需 Node.js 22.12+（也兼容 20.19+），无需 npm 依赖或 Python。

`npm run release:pack` 可本地独立构建轻量包，不发布。打包后自动解压实际 ZIP，使用随机本机端口启动包内服务器，逐一核对首页和全部资源响应，完成后关闭该进程。界面或玩法修改仍应在推送前验证选角、战斗、作答、出牌、刷新恢复和手机布局。

`scripts/build-info.mjs` 将版本、完整提交和脏状态写入两种构建；正式包必须 `uncommitted=false`。Pages 使用 `/agent-spire/` 路径，本地包使用根路径。二者存档分别保存在浏览器，不自动同步。

下载本次 Actions 的 `player-package` 后可独立检查：

```sh
gh run download <run-id> --name player-package --dir output/verify-release
python scripts/verify-release.py --directory output/verify-release
```

此检查需要 gh 登录和公网 HTTPS。SHA256 校验用于完整性验证，不是数字签名。云端正式产物不自动下载回每位开发者的 `release/` 目录，以 GitHub Release 和同次 Actions 产物为准。
