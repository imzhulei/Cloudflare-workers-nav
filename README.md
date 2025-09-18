我已为你生成并保存了一个可直接部署到 Cloudflare Workers 的单文件导航页面代码（包含 Worker 后端与前端单页应用）。文件名：Cloudflare-workers-nav。

它包含：

完整的 Worker JS（处理静态页面与 /api/* CRUD 接口）

使用 Workers KV（绑定名 NAV_KV）做数据持久化（存储键 nav_items）

响应式布局、移动端友好

支持新增/编辑/删除卡片、拖拽排序（使用 SortableJS）

集成 Google、Bing、百度 搜索（支持 site:当前站点 的站内搜索）

简单的模态编辑器，示例数据和重置按钮

部署与绑定说明注释在文件头

你可以在左侧（或页面的文件视图）打开名为 Cloudflare-workers-nav 的文档查看并复制完整代码，或者我也可以把代码导出为其它格式（例如单独的 worker.js）——你想要哪种？
