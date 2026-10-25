# 未完 · 个人记录网站

参考 Cheerego 的黑白摄影、小字排版、留白与深色底部导航，制作的个人日记网站。原站的品牌、人物照片及文章没有复制；本项目照片为 AI 生成示例。你可以替换为自己的名字、照片和记录。

## 本地查看

Mac 可在 Finder 双击 `预览网站.command` 启动；或在此文件夹运行（需要 Python 3）：

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

打开 <http://127.0.0.1:4173>。终端按 Control+C 停止预览。不要直接双击 HTML：浏览器会限制读取 JSON 内容。

## 日常更新：不用改代码

1. 打开网站，点击左下角 **edit**。
2. 在“网站设置”修改名字、介绍、封面及写给自己的信；在其他分类新增、编辑或删除记录。
3. 点击 **保存**，再点 **预览草稿**。草稿仅保存在当前浏览器，未保存的表单会在预览和导出时自动保存。
4. 点击 **导出 content.json**，得到完整备份。把它上传替换 GitHub 仓库中的 `data/content.json` 并提交。
5. GitHub Actions 部署完成后，正式网站显示最新内容。

浏览器草稿不会自动上传，不会跨设备同步。换设备后可通过“导入内容”继续编辑，或直接载入已发布的文件。浏览器清理数据也会清除草稿，重要更新请及时导出。首次查看正式站时不会显示本地草稿；只有“预览草稿”链接会读取它。

### 更换照片

把图片放到 `assets/`（或在 GitHub 的 assets 文件夹使用 Add file → Upload files 上传）。在编辑器填写相对路径，例如 `assets/my-photo.jpg`，保存、导出并更新内容文件。文件名建议使用英文、小写和连字符；图片建议压缩到 1 MB 左右，封面以横图为佳。远程图片需为 HTTPS 链接；本地图片不依赖任何外部图床。

### 页面对应关系

| 页面 | 内容 | 数据位置 |
| --- | --- | --- |
| home | 全屏封面、首页文字 | `site` |
| life | 日记、搜索、文章全文 | `posts` |
| leaf | 照片、日期、说明、放大 | `photos` |
| about | 名字、自我介绍、近况 | `site` |
| days | 按日期排列的时间线 | `timeline` |
| collection | 书、音乐、地点及链接 | `favorites` |
| to me | 写给自己的信、可选邮箱 | `site` |

正文使用空行分段，普通换行也会保留；内容按纯文字渲染，不执行 HTML。日期为 `YYYY-MM-DD`。日记、照片和时间线按日期倒序显示。每条记录的 `id` 应唯一且稳定，编辑器会自动创建。

## 第一次发布到 GitHub Pages

当前项目尚未绑定远程 GitHub 仓库。

1. 登录 GitHub，新建仓库，例如 `personal-journal`。普通 GitHub Free 账号可选公开仓库使用 Pages。
2. 把项目全部文件提交到仓库的 `main` 分支，包含隐藏目录 `.github/workflows/pages.yml`。
3. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 **Actions → Publish personal journal → Run workflow** 手动运行第一次部署。之后推送 main 分支会自动部署。
5. 部署完成后，Pages 页面会显示实际网址。项目仓库通常为 `https://你的用户名.github.io/personal-journal/`。

若使用 Git 命令，可在项目目录执行以下命令，把占位地址换为自己的仓库。仓库中如已有内容，请先处理合并，不要强制推送。

```sh
git add .
git commit -m "Create personal journal website"
git remote add origin https://github.com/YOUR_USERNAME/personal-journal.git
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
