# Guardian Learner

使用链接https:https://prismatic-biscochitos-6be7ef.netlify.app/

Guardian Learner 是一个仿 Qwerty Learner 体验的本地/静态网页单词练习工具，面向考研英语文章精读和词汇复习。项目无需后端，直接部署为静态网站即可使用。

## Features

- 内置多个考研英语词库：
  - guardian 考研英一词库
  - 2026 真题逐年闪背词库
  - 2026 锐记核心词汇词库
  - 综合互补词库（三个词库合并去重）
- 上传 `.docx` 英文文章后，按所选内置词库提取文章中出现过的单词并生成章节
- 直接粘贴英文文章文本，也可以按所选词库提取并生成章节
- 自动识别常见词形变化，如复数、第三人称单数、过去式、过去分词、现在分词、比较级和最高级
- 用户生成章节支持保存文章链接并一键跳转
- 用户生成章节可以删除章节、删除不想要的单词
- 内置词库章节只读，不允许修改或删除
- 章节、删除记录、文章链接和设置保存在浏览器本地
- 支持英音朗读，优先使用系统 `en-GB` 语音
- 针对平板/手机切换单词时的发音截断做了延迟队列处理
- 支持时间、输入数、WPM、正确数、正确率统计
- 支持明暗主题、随机顺序、隐藏释义、章节单词列表

## Usage

直接打开 `index.html` 即可使用。也可以启动任意静态服务器：

```bash
python -m http.server 4174
```

然后访问：

```text
http://127.0.0.1:4174/
```

如果要让同一局域网里的平板访问，请把服务绑定到 `0.0.0.0`，并用电脑的局域网 IP 访问：

```bash
python -m http.server 4174 --bind 0.0.0.0
```

## Deploy

这是纯静态项目，可以部署到 GitHub Pages、Netlify、Cloudflare Pages、Vercel 等平台。

GitHub Pages 推荐设置：

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/root`

## Keyboard Shortcuts

- 输入字母：练习当前单词
- `Enter`：暂停/继续
- `←`：上一个单词
- `→`：下一个单词
- `↑`：朗读当前单词
- `↓`：隐藏/显示释义
- `Backspace`：回退输入
- `Esc`：暂停

## Article Extraction

上传或粘贴的文章会被当作英文文章处理。工具会扫描文章中的英文单词，按文章首次出现顺序，匹配当前选择的内置词库，并使用该词库中的原词和中文释义生成章节。

例如文章中出现 `consulted`、`consulting` 时，会尝试匹配到词库原词 `consult`。

## Privacy

本项目没有后端。用户上传的 Word、粘贴的文章、生成的章节和设置都只保存在浏览器本地，不会上传到服务器。

注意：当前 `.docx` 解析依赖在线脚本 `mammoth.browser.min.js`，图标依赖 `lucide` CDN。若要完全离线或减少 CDN 依赖，可以把相关脚本下载到本地并修改 `index.html` 引用。

## Files

- `index.html`: 页面结构
- `styles.css`: 页面样式
- `app.js`: 练习、提取、章节管理逻辑
- `guardian-vocab.js`: guardian 考研英一词库
- `truth-vocab.js`: 2026 真题逐年闪背词库
- `ruiji-vocab.js`: 2026 锐记核心词汇词库
- 综合互补词库在浏览器中由前三个词库动态合并生成

## License

MIT
