# 发布维护

首次发布使用当前 GitHub 账号 lizaixi01 的公开仓库 agent-spire。安装依赖、构建产物、本地截图集合、教材文本及历史素材不进入 Git；仅 README 用的两张截图保留于 docs/images/。

## 验证和打包

```sh
npm ci
npm test
npm run check
npm run release:pack
```

Python 3 标准库打包 dist/、Windows 启动器、Node 静态服务器与游玩/资源说明。ZIP 最大 10 MiB，超出会失败并删除不合格 ZIP。字体及其上游许可原样进入 dist/ 和 ZIP。SHA256SUMS.txt 用于校验传输完整性，不作为签名。

解压到独立目录，验证其中没有 node_modules；使用 `node scripts/serve-game.mjs 4183` 并检查首页、脚本、CSS、图片、字体均能加载。Windows 另验证 `scripts/start-game.ps1 -Port 4183 -NoBrowser`。服务器只监听 127.0.0.1，并拒绝目录越界与写入请求。

## GitHub Release

更新 package.json 版本并同步 package-lock.json；提交、推送并确认 Checks 成功后，再用相同版本创建 tag 和 Release。上传 release/ 下的游玩 ZIP 与 SHA256SUMS.txt。发布说明写明包大小、Node.js 前置要求与验证结果。不要上传包含 node_modules 的整个目录。

CI 在每次推送及 PR 执行测试、类型检查、构建与体积检查，失败时查看 Actions 日志；修复后重新推送。Release 附件由维护者在验证完成后上传。

历史素材留在本机 reference/unpublished-assets/，不会随源码下载。src/style.css 的历史背景引用统一指向仍在使用的 pixel/spire.png，避免构建重新收录旧背景。

## GitHub Pages 在线体验

访问 https://lizaixi01.github.io/agent-spire/ 即可在浏览器游玩，无需安装 Node.js。在线版需要网络加载资源；下载包继续用于本地离线游玩。

`npm run build:pages` 单独生成 dist-pages/，Vite 将脚本、CSS、图片、字体及图标的路径统一加上 /agent-spire/ 前缀。该目录被 Git 忽略，不影响下载包的 dist/ 与根路径。

仓库 Pages 来源设置为 GitHub Actions。Checks 工作流在测试、类型检查、下载体积检查和网页构建通过后上传 Pages 产物；只有 main 的非 PR 运行可部署到 github-pages 环境。失败时查看 Actions 日志，修复后重新推送或手动运行工作流；需要回退时恢复已验证提交再部署。现有站点在新部署失败时继续提供上一版本。

在线版和本地版属于不同站点，存档各自保存在当前浏览器，不会自动同步。GitHub Pages 上同一域名的其他项目共享浏览器 origin，后续项目应避免复用本游戏的存档键。

部署后检查首页、全部静态资源及字体无 404，实际走通选角、进入战斗、作答、出牌、刷新恢复，并检查手机布局。自动构建成功不等于在线验收完成。
