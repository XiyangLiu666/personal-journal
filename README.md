# 未完 · 个人记录网站

参考 Cheerego 的黑白摄影、小字排版、留白与深色底部导航，制作的个人日记网站。原站的品牌、人物照片及文章没有复制；本项目照片为 AI 生成示例。你可以替换为自己的名字、照片和记录。

## 本地查看

Mac 可在 Finder 双击 `预览网站.command` 启动；或在此文件夹运行（需要 Python 3）：

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

打开 <http://127.0.0.1:4173>。终端按 Control+C 停止预览。不要直接双击 HTML：浏览器会限制读取 JSON 内容。

## 日常更新：直接在网站里改

1. 打开网站，点击左下角 **edit** 进入编辑室（地址：<https://xiyangliu666.github.io/personal-journal/editor.html>）。
2. **第一次在某台设备上使用时**，按页面上的步骤创建一个 GitHub 密钥并粘贴连接。每台电脑、手机只需做一次。
3. 选择左侧分类（日记、照片、时间线、收藏、网站设置）：
   - **新增**：点右上角“＋ 新增”，填写后点 **保存并发布**。
   - **修改**：点某条记录的“编辑”，改完点 **保存并发布**。
   - **删除**：点“删除”并确认。
   - **照片**：在照片栏点 **选择照片上传**，照片会自动压缩并放进仓库的 `assets/uploads/`，路径自动填写。
4. 发布后约 1 分钟网站更新，编辑页会显示“网站已更新 ✓”。

没有连接 GitHub 时，修改只保存在当前浏览器，页面上会出现“发布”按钮，连接后点一下即可上线。“备份与恢复”中可以下载或导入 `content.json`。每次发布都会在 GitHub 留下一次提交，误删的内容可以在仓库历史里找回。

### 关于密钥

密钥只保存在当前设备的浏览器中，不会写进网站或仓库。建议只授权 `personal-journal` 一个仓库、只给 Contents 读写权限，并设置过期时间；过期后重新生成并连接即可。在公用电脑上用完请点“断开”。如果担心密钥泄露，可在 GitHub 的 Settings → Developer settings → Personal access tokens 中删除它。

### 更换照片

推荐直接在编辑页上传。也可以手动把图片放到 `assets/`，在编辑页的路径栏填写 `assets/文件名.jpg`；远程图片需为 HTTPS 链接。

### 页面对应关系

| 页面 | 内容 | 数据位置 |
| --- | --- | --- |
| home | 全屏封面、首页文字 | `site` |
| life | 彩色背景、半透明窄栏、照片与文字流 | `posts` |
| leaf | 树叶背景、半透明窄栏、纵向照片流 | `photos` |
| about | 名字、自我介绍、近况 | `site` |
| days | event 形式的白色内容面板、分页记录 | `timeline` |
| collection | 书、音乐、地点及链接 | `favorites` |
| to me | 写给自己的信、可选邮箱 | `site` |

正文使用空行分段，普通换行也会保留；内容按纯文字渲染，不执行 HTML。日期为 `YYYY-MM-DD`。日记、照片和时间线按日期倒序显示。每条记录的 `id` 应唯一且稳定，编辑器会自动创建。

## 第一次发布到 GitHub Pages

项目仓库：[XiyangLiu666/personal-journal](https://github.com/XiyangLiu666/personal-journal)。

网站地址：[未完](https://xiyangliu666.github.io/personal-journal/)。以下为首次部署或迁移到其他仓库时的步骤。

1. 登录 GitHub，新建仓库，例如 `personal-journal`。普通 GitHub Free 账号可选公开仓库使用 Pages。
2. 把项目全部文件提交到仓库的 `main` 分支，包含隐藏目录 `.github/workflows/pages.yml`。
3. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 **Actions → Publish personal journal → Run workflow** 手动运行第一次部署。之后推送 main 分支会自动部署。
5. 部署完成后，Pages 页面会显示实际网址。项目仓库通常为 `https://你的用户名.github.io/personal-journal/`。

若使用 Git 命令，可在项目目录执行以下命令，把占位地址换为自己的仓库。仓库中如已有内容，请先处理合并，不要强制推送。

```sh
git add .
git commit -m "Create personal journal website"
git remote add origin https://github.com/XiyangLiu666/personal-journal.git
git push -u origin main
```

以后只修改内容时，也可直接在 GitHub 编辑 `data/content.json`，不必使用本地编辑器。JSON 字段和数组结构请保留；部署前的检查会发现缺失字段、重复 ID 和缺少的本地图片。

官方说明：[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[自定义部署工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 关于“自己用”与隐私

这是个人维护的网站，发布后的设计适合公开浏览。编辑器是本地草稿工具，不是身份验证后台，其他访客无法通过它修改你的仓库。GitHub Pages 不应被当作保密日记存储，公开仓库和发布网页中的文字及图片都可能被读取。如果需要只有你能登录查看的私人日记，需要另加身份验证和受保护存储，不能只隐藏导航或加前端密码。

## 验证和结构

无框架、无运行时依赖、不需要 npm install。若安装 Node.js 22+，可执行：

```sh
node scripts/check.mjs
node --test tests/content.test.mjs
```

- `index.html` / `style.css`：网站页面与响应式样式
- `editor.html` / `editor.css`：本地内容编辑界面
- `data/content.json`：全部文字内容及图片路径
- `js/`：页面渲染、内容校验、草稿与导入导出
- `assets/`：封面、照片及图标
- `.github/workflows/pages.yml`：检查并部署到 GitHub Pages

## 封面来源

`assets/hero.jpg` 使用内置 imagegen 生成，为可替换的示例，并非你本人的照片。生成提示词记录于 [assets/IMAGE_PROMPT.md](assets/IMAGE_PROMPT.md)。

## 子页样式与图片设置

life 和 leaf 采用参考站的整屏背景、靠左窄栏和半透明黑底；about 与 collection 使用白色主面板和右侧 bio 分类栏；days 使用 event 内容面板和上一页 / 下一页。首页布局保持原样。

在编辑器“网站设置”末尾可以更换 life、leaf、个人介绍 / 收藏、时间线的背景图片。日记可添加照片路径，收藏可添加封面，时间线可添加配图；这些字段均可留空，旧版内容文件仍然兼容。

此次调整已将此前上传到根目录 content.json 中的个人设置合并到正式使用的 data/content.json。以后更新请替换 data 文件夹里的内容文件。
