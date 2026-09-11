# 裴冬冬 · 视觉设计与 AIGC 作品集

发布目录为 `dist/`。网页仅使用本地提供的作品素材，无访客登录功能、无数据库。静态页面可以直接部署到 Cloudflare Pages。

## 本地预览与检查

需要 Node.js 22 或更高版本，不需要安装第三方依赖。

- `npm start`：打开本地预览服务 `http://127.0.0.1:4173/`。
- `npm run build`：检查脚本语法、项目数据与素材路径。
- `npm test`：检查场景切换顺序与连续输入保护。

## GitHub + Cloudflare Pages

将本项目发布文件推送到选定的 GitHub 仓库，在 Cloudflare Pages 选择该仓库：

- 框架预设：None
- 构建命令：`npm run build`
- 输出目录：`dist`
- Node.js 版本：22 或更高

部署后，生产 `pages.dev` 地址可公开访问。不要为该生产站点开启 Cloudflare Access 或其他登录限制。

## 内容更新

项目清单在 `dist/projects.js`，按 AIGC、品牌创意 / IP 视觉、更多视觉探索分组。只引用 `dist/assets/` 内的优化素材。长图可按顺序无缝堆叠多个图片资源；页面不裁切详情图，也不使用轮播。

`dist/flow.js` 管理场景切换；`dist/script.js` 接入视频、输入与站内作品浏览；`dist/water.js` 提供桌面端水面折射，设备不支持时自动使用原图和视频。

素材原件保留在工作区原目录，部署目录只包含网页实际使用的版本。个人资料截图没有加入公开资源；页面联系信息来自用户提供资料。

音乐节页面按用户提供的最新长图展示，保留设计提案的表述。
