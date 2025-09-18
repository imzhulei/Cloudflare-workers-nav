export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api")) {
      return handleAPI(request, env);
    }

    return new Response(getHTML(), {
      headers: { "content-type": "text/html;charset=utf-8" },
    });
  },
};

async function handleAPI(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || request.headers.get("Authorization")?.replace("Bearer ", "");

  // 只读接口
  if (request.method === "GET" && url.pathname === "/api/cards") {
    const data = await env.NAV_KV.get("cards");
    return Response.json(data ? JSON.parse(data) : []);
  }

  // 管理员操作需要校验口令
  if (key !== env.ADMIN_KEY) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "POST" && url.pathname === "/api/cards") {
    const body = await request.json();
    await env.NAV_KV.put("cards", JSON.stringify(body));
    return Response.json({ success: true });
  }

  return new Response("Not Found", { status: 404 });
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>导航页面</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    header { background: #333; color: #fff; padding: 10px; text-align: center; }
    #search-bar { display: flex; justify-content: center; margin: 15px; gap: 5px; }
    #search-bar input { flex: 1; padding: 8px; font-size: 16px; }
    #search-bar select, #search-bar button { padding: 8px; font-size: 16px; }
    #cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; padding: 15px; }
    .card { background: white; border-radius: 12px; padding: 15px; text-align: center; cursor: grab; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
    .card a { text-decoration: none; color: inherit; font-weight: bold; }
    .admin-only { display: none; }
    .card button { margin-top: 8px; font-size: 12px; }
    @media (max-width: 600px) { #search-bar { flex-direction: column; } }
  </style>
</head>
<body>
  <header>
    <h1>导航页面</h1>
  </header>

  <div id="search-bar">
    <input type="text" id="searchInput" placeholder="搜索本站或输入关键字" />
    <select id="engine">
      <option value="google">Google</option>
      <option value="baidu">Baidu</option>
    </select>
    <button onclick="doSearch()">搜索</button>
  </div>

  <div style="text-align:center; margin-bottom:10px;">
    <button onclick="login()" id="loginBtn">管理员登录</button>
    <button onclick="addCard()" class="admin-only">新增卡片</button>
    <button onclick="saveCards()" class="admin-only">保存修改</button>
  </div>

  <div id="cards"></div>

  <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
  <script>
    let cards = [];
    let adminMode = false;
    let adminKey = null;

    async function loadCards() {
      const res = await fetch('/api/cards');
      cards = await res.json();
      renderCards();
    }

    function renderCards() {
      const container = document.getElementById('cards');
      container.innerHTML = '';
      cards.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.background = c.color || 'white';
        div.innerHTML = \`
          <a href="\${c.url}" target="_blank">\${c.title}</a>
          \${adminMode ? '<br><button onclick="editCard(\${i})">编辑</button><button onclick="deleteCard(\${i})">删除</button>' : ''}
        \`;
        container.appendChild(div);
      });

      if (adminMode) {
        new Sortable(container, { animation: 150, onEnd: e => {
          const [moved] = cards.splice(e.oldIndex, 1);
          cards.splice(e.newIndex, 0, moved);
        }});
      }
    }

    function doSearch() {
      const q = document.getElementById('searchInput').value.trim();
      const engine = document.getElementById('engine').value;
      if (!q) return;
      let url = '';
      if (engine === 'google') url = 'https://www.google.com/search?q=' + encodeURIComponent(q);
      if (engine === 'baidu') url = 'https://www.baidu.com/s?wd=' + encodeURIComponent(q);
      window.open(url, '_blank');
    }

    function login() {
      const key = prompt("请输入管理员口令：");
      if (key) {
        adminKey = key;
        adminMode = true;
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-block');
        document.getElementById('loginBtn').style.display = 'none';
        renderCards();
      }
    }

    function addCard() {
      const title = prompt("标题：");
      const url = prompt("链接：");
      const color = prompt("背景颜色 (可选, 如 #ffcc00)：");
      if (title && url) {
        cards.push({ title, url, color });
        renderCards();
      }
    }

    function editCard(i) {
      const c = cards[i];
      const title = prompt("标题：", c.title);
      const url = prompt("链接：", c.url);
      const color = prompt("背景颜色：", c.color || '');
      if (title && url) {
        cards[i] = { title, url, color };
        renderCards();
      }
    }

    function deleteCard(i) {
      if (confirm("确认删除？")) {
        cards.splice(i, 1);
        renderCards();
      }
    }

    async function saveCards() {
      const res = await fetch('/api/cards?key=' + encodeURIComponent(adminKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cards)
      });
      const r = await res.json();
      alert(r.success ? "保存成功" : "保存失败");
    }

    loadCards();
  </script>
</body>
</html>`;
}
