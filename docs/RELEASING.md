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
