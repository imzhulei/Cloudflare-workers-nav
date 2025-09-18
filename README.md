在 Cloudflare Dashboard → KV，新建命名空间，绑定到 Worker，变量名填 NAV_KV。

在 Worker → Settings → Variables 里添加 环境变量 ADMIN_KEY（例如 123456）。

部署 Worker。

首次访问 / 会显示空白导航页。

点击 管理员登录，输入 ADMIN_KEY，即可新增/编辑/删除/排序卡片，并保存到 KV。
