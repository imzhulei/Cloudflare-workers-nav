<!--
Cloudflare Workers single-file navigation app (frontend + backend API)

How to deploy:
1. Create a Workers KV namespace in the Cloudflare dashboard and bind it to your Worker with the variable name NAV_KV.
   - Dashboard > Workers > KV > Create namespace (e.g. "nav_kv")
   - In your Worker settings, add a KV binding: Variable name: NAV_KV, Namespace: nav_kv

2. Create a Worker script and paste this entire file as the script source (or use Wrangler with a minimal worker that `import` or serves this HTML). If using a single script, name the Worker e.g. "nav-worker" and set the KV binding.

3. (Using Wrangler) Example `wrangler.toml`:
   name = "nav-worker"
   main = "./worker.js"  # if you place this content into a JS file instead of a static html
   type = "javascript"

   [[kv_namespaces]]
   binding = "NAV_KV"
   id = "<your-kv-id-from-dashboard>"

4. The Worker uses KV key `nav_items` to store an array of card objects.
   Example card shape:
   {
     id: "uuid",
     title: "Cloudflare",
     url: "https://cloudflare.com",
     tags: ["infra"],
     desc: "Edge network",
     color: "#4F46E5"
   }

Notes:
- This file uses environment variable `NAV_KV` for Workers KV. If you name your binding differently, update the code (ENV: NAV_KV).
- No server other than Workers is required. The script below serves a static HTML UI and implements a small JSON API for CRUD and reordering.
- Uses SortableJS via CDN for drag-and-drop sorting.
- Search integrates Google, Bing, Baidu (open 3rd-party) and supports searching this site via `site:` queries.
- This example uses native KV get/put; KV has eventual consistency and limits. For heavy write workloads consider Durable Objects or an external DB.
-->

<script>
// This block is intentionally left blank — the actual worker script comes after HTML.
</script>

<!-- Worker Script: save this file as `worker.js` in Cloudflare or paste the JS part into a Worker script. -->

<!-- BEGIN WORKER CODE -->
<script type="module">
// Cloudflare Worker combined server + static HTML
// If you paste this into the Cloudflare Worker editor, remove the surrounding <script> tags

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // API endpoints under /api/
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }
    // Serve static HTML for everything else (single page app)
    return new Response(HTML, {
      headers: { 'content-type': 'text/html;charset=UTF-8' }
    });
  }
};

// --- API implementation (KV-based) ---
async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api','');
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return cors(new Response(null, { status: 204 }));
  }

  try {
    if (path === '/list' && request.method === 'GET') {
      const items = await getItems(env);
      return cors(json(items));
    }
    if (path === '/add' && request.method === 'POST') {
      const body = await request.json();
      const items = await getItems(env);
      const id = cryptoRandomId();
      const item = { id, title: body.title||'Untitled', url: body.url||'#', tags: body.tags||[], desc: body.desc||'', color: body.color||randomColor() };
      items.push(item);
      await putItems(env, items);
      return cors(json(item, 201));
    }
    if (path === '/update' && request.method === 'PUT') {
      const body = await request.json();
      if (!body.id) return cors(json({ error: 'missing id' }, 400));
      const items = await getItems(env);
      const i = items.findIndex(x=>x.id===body.id);
      if (i===-1) return cors(json({ error: 'not found' }, 404));
      items[i] = { ...items[i], ...body };
      await putItems(env, items);
      return cors(json(items[i]));
    }
    if (path === '/delete' && request.method === 'DELETE') {
      const body = await request.json();
      if (!body.id) return cors(json({ error: 'missing id' }, 400));
      let items = await getItems(env);
      items = items.filter(x=>x.id!==body.id);
      await putItems(env, items);
      return cors(json({ ok: true }));
    }
    if (path === '/reorder' && request.method === 'POST') {
      const body = await request.json();
      if (!Array.isArray(body.ids)) return cors(json({ error: 'ids array required' }, 400));
      let items = await getItems(env);
      const idToItem = Object.fromEntries(items.map(it=>[it.id,it]));
      const newItems = body.ids.map(id=>idToItem[id]).filter(Boolean);
      await putItems(env, newItems);
      return cors(json({ ok: true }));
    }

    return cors(json({ error: 'unknown endpoint' }, 404));
  } catch (e) {
    return cors(json({ error: e.message }, 500));
  }
}

// KV helpers
async function getItems(env) {
  const raw = await env.NAV_KV.get('nav_items');
  if (!raw) {
    const defaults = [
      { id: 'a1', title: 'Cloudflare', url: 'https://cloudflare.com', tags:['edge'], desc: 'Cloudflare', color: '#2563EB' },
      { id: 'a2', title: 'Google', url: 'https://www.google.com', tags:['search'], desc: 'Google Search', color: '#EA4335' }
    ];
    await env.NAV_KV.put('nav_items', JSON.stringify(defaults));
    return defaults;
  }
  try { return JSON.parse(raw); } catch { return []; }
}
async function putItems(env, items) {
  await env.NAV_KV.put('nav_items', JSON.stringify(items));
}

// Utilities
function json(obj, status=200) { return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } }); }
function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin','*');
  resp.headers.set('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers','content-type');
  return resp;
}
function cryptoRandomId() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2,9); }
function randomColor() { const colors=['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#0EA5E9']; return colors[Math.floor(Math.random()*colors.length)]; }

// --- HTML front-end served by the worker ---
const HTML = `
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>导航面板 - Cloudflare Workers</title>
  <link rel="icon" href="data:;base64,iVBORw0KGgo=">
  <style>
    /* Simple responsive card grid */
    :root{--bg:#0f172a;--card:#0b1220;--muted:#94a3b8}
    html,body{height:100%;margin:0;font-family:Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;color:#e6eef8;background:linear-gradient(180deg,#071029 0%, #021025 100%);}
    .wrap{max-width:1100px;margin:24px auto;padding:16px}
    header{display:flex;gap:12px;align-items:center;justify-content:space-between}
    h1{font-size:18px;margin:0}
    .controls{display:flex;gap:8px;align-items:center}
    .searchRow{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
    input[type=text]{padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:inherit}
    button{padding:8px 10px;border-radius:8px;border:none;background:#2563eb;color:white;cursor:pointer}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:12px}
    .card{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 6px 18px rgba(2,6,23,0.6);cursor:grab}
    .card .title{font-weight:600}
    .card .meta{font-size:12px;color:var(--muted)}
    .card .actions{display:flex;gap:6px;margin-top:auto}
    .tag{display:inline-block;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,0.03);font-size:12px}
    .footer{margin-top:18px;color:var(--muted);font-size:13px}
    @media (max-width:600px){h1{font-size:16px}}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>我的导航面板</h1>
        <div style="color:var(--muted);font-size:13px">可增删改，拖动排序，集成 Google / Bing / 百度 搜索</div>
      </div>
      <div class="controls">
        <button id="addBtn">新增卡片</button>
        <button id="importSampleBtn">重置为示例</button>
      </div>
    </header>

    <div class="searchRow">
      <input id="q" type="text" placeholder="站内/全网搜索：输入关键词，点击搜索引擎图标" />
      <select id="engine">
        <option value="google">Google</option>
        <option value="bing">Bing</option>
        <option value="baidu">Baidu</option>
      </select>
      <label style="display:flex;align-items:center;gap:6px;color:var(--muted)"><input id="siteOnly" type="checkbox"/> 仅本站</label>
      <button id="doSearch">搜索</button>
    </div>

    <div id="grid" class="grid"></div>

    <div class="footer">长按或拖动卡片可排序。数据保存在 Cloudflare Workers KV（请在 Worker 绑定 NAV_KV）。</div>
  </div>

  <!-- Edit Modal (simple) -->
  <div id="modal" style="display:none;position:fixed;inset:0;background:rgba(2,6,23,0.6);align-items:center;justify-content:center">
    <div style="background:white;color:#0b1220;padding:16px;border-radius:10px;min-width:300px;max-width:90%">
      <h3 id="modalTitle">编辑卡片</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        <input id="m_title" placeholder="标题" />
        <input id="m_url" placeholder="https://..." />
        <input id="m_desc" placeholder="描述" />
        <input id="m_tags" placeholder="逗号分隔标签" />
        <input id="m_color" placeholder="#hex 或 CSS 颜色" />
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="m_cancel">取消</button>
          <button id="m_save">保存</button>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
  <script>
    // Client-side app
    const API = '/api';
    let items = [];
    const grid = document.getElementById('grid');
    const q = document.getElementById('q');
    const engine = document.getElementById('engine');
    const siteOnly = document.getElementById('siteOnly');

    async function fetchList(){
      const res = await fetch(API + '/list');
      items = await res.json();
      render();
    }

    function render(){
      grid.innerHTML = '';
      for (const it of items){
        const card = document.createElement('div'); card.className='card'; card.dataset.id=it.id;
        card.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:10px;height:40px;background:${it.color};border-radius:6px"></div>
            <div style="flex:1">
              <div class="title"><a href="${it.url}" target="_blank" rel="noopener" style="color:inherit; text-decoration:none">${escapeHtml(it.title)}</a></div>
              <div class="meta">${escapeHtml(it.desc||it.url)}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${(it.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        `;
        const actions = document.createElement('div'); actions.className='actions';
        const edit = document.createElement('button'); edit.textContent='编辑'; edit.onclick=()=>openEdit(it);
        const del = document.createElement('button'); del.textContent='删除'; del.onclick=()=>doDelete(it.id);
        actions.appendChild(edit); actions.appendChild(del);
        card.appendChild(actions);
        grid.appendChild(card);
      }
      // enable sortable
      if (window._sortable) window._sortable.destroy();
      window._sortable = Sortable.create(grid, { animation:150, onEnd: onSortEnd });
    }

    function onSortEnd(){
      const ids = Array.from(grid.children).map(ch => ch.dataset.id);
      fetch(API + '/reorder', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids})});
    }

    // Modal
    const modal = document.getElementById('modal');
    const m_title = document.getElementById('m_title');
    const m_url = document.getElementById('m_url');
    const m_desc = document.getElementById('m_desc');
    const m_tags = document.getElementById('m_tags');
    const m_color = document.getElementById('m_color');
    let editingId = null;

    document.getElementById('addBtn').addEventListener('click', ()=>openEdit({title:'',url:'',desc:'',tags:[],color:''}));
    document.getElementById('importSampleBtn').addEventListener('click', async ()=>{
      if(!confirm('重置为示例数据？当前数据将被覆盖')) return;
      // Overwrite KV directly via multiple deletes/puts: easiest is to delete and add sample via API
      // We'll call /add twice after clearing via update of nav_items
      await fetch(API + '/reorder', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ids:[]})});
      await fetch(API + '/add', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({title:'Cloudflare',url:'https://cloudflare.com',desc:'Cloudflare',tags:['edge']} )});
      await fetch(API + '/add', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({title:'Google',url:'https://google.com',desc:'Google',tags:['search']} )});
      await fetchList();
    });

    function openEdit(item){
      editingId = item.id || null;
      m_title.value = item.title||'';
      m_url.value = item.url||'';
      m_desc.value = item.desc||'';
      m_tags.value = (item.tags||[]).join(',');
      m_color.value = item.color||'';
      modal.style.display='flex';
    }
    document.getElementById('m_cancel').onclick = ()=>{ modal.style.display='none'; };
    document.getElementById('m_save').onclick = async ()=>{
      const payload = { title:m_title.value, url:m_url.value, desc:m_desc.value, tags:m_tags.value.split(',').map(s=>s.trim()).filter(Boolean), color:m_color.value };
      if (editingId){ payload.id = editingId; await fetch(API + '/update', {method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify(payload)});
      } else { await fetch(API + '/add', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload)});
      }
      modal.style.display='none'; await fetchList();
    };

    async function doDelete(id){ if(!confirm('确认删除？')) return; await fetch(API + '/delete', {method:'DELETE', headers:{'content-type':'application/json'}, body:JSON.stringify({id})}); await fetchList(); }

    // Search
    document.getElementById('doSearch').addEventListener('click', ()=>{
      const k = q.value.trim(); if (!k) return; const eng = engine.value; const site = siteOnly.checked ? `site:${location.hostname} ` : '';
      let url = '';
      const query = encodeURIComponent(site + k);
      if (eng==='google') url = `https://www.google.com/search?q=${query}`;
      if (eng==='bing') url = `https://www.bing.com/search?q=${query}`;
      if (eng==='baidu') url = `https://www.baidu.com/s?wd=${query}`;
      window.open(url,'_blank');
    });

    // Basic escaping
    function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

    // init
    fetchList();
  </script>
</body>
</html>
`;

</script>
<!-- END WORKER CODE -->
