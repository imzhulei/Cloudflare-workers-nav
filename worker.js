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
  const key = url.searchParams.get("key");

  if (request.method === "GET") {
    if (url.pathname === "/api/cards") {
      const data = await env.NAV_KV.get("cards");
      return Response.json(data ? JSON.parse(data) : []);
    }
    if (url.pathname === "/api/groups") {
      const data = await env.NAV_KV.get("groups");
      return Response.json(data ? JSON.parse(data) : []);
    }
  }

  if (key !== env.ADMIN_KEY) return new Response("Forbidden", { status: 403 });

  if (request.method === "POST") {
    if (url.pathname === "/api/cards") {
      const body = await request.json();
      await env.NAV_KV.put("cards", JSON.stringify(body));
      return Response.json({ success: true });
    }
    if (url.pathname === "/api/groups") {
      const body = await request.json();
      await env.NAV_KV.put("groups", JSON.stringify(body));
      return Response.json({ success: true });
    }
  }
  return new Response("Not Found", { status: 404 });
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>我的导航</title>
<style>
body.light { font-family: Arial, sans-serif; background:#faf9f7; margin:0; padding:0; color: #333; }
body.dark { font-family: Arial, sans-serif; background:#333; margin:0; padding:0; color: #faf9f7; }
header { padding:10px; display:flex; justify-content:space-between; align-items:center; }
header h1 { margin:0; font-size:20px; }
header .right { display:flex; gap:10px; }
button { padding:6px 12px; border:none; border-radius:6px; cursor:pointer; background:#4caf50; color:white; }
#search-bar { text-align:center; margin:15px; }
#search-bar input, #search-bar select { padding:8px; font-size:16px; }
#groups { margin:20px; }
.group { margin-bottom:20px; }
.group h2 { font-size:18px; border-left:4px solid green; padding-left:8px; display:flex; align-items:center; justify-content:space-between; }
.cards { display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; }
.card { background:#fff; border-radius:10px; padding:10px; width:180px; box-shadow:0 2px 5px rgba(0,0,0,0.1); cursor:grab; }
.card a { text-decoration:none; color:#333; font-weight:bold; display:flex; align-items:center; gap:5px; margin-bottom:5px; }
.card div { font-size:12px; color:#777; word-break:break-all; }
.admin-btns { display:none; gap:5px; }
.modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); justify-content:center; align-items:center; }
.modal-content { background:#fff; padding:20px; border-radius:8px; width:300px; }
.modal-content h3 { margin-top:0; }
.modal-content input, .modal-content select { width:100%; margin-bottom:10px; padding:6px; }
</style>
</head>
<body class="light">
<header>
  <h1>我的导航</h1>
  <div class="right">
    <button id="loginBtn" onclick="openLoginModal()">管理员登录</button>
    <button id="addGroupBtn" style="display:none;" onclick="openModal('group')">新增分组</button>
    <button id="addCardBtn" style="display:none;" onclick="openModal('card')">新增卡片</button>
    <button id="saveSortBtn" style="display:none;" onclick="saveSort()">保存排序</button>
    <button id="toggleThemeBtn" onclick="toggleTheme()">切换主题</button>
  </div>
</header>

<div id="search-bar">
  <select id="engine">
    <option value="baidu">百度</option>
    <option value="google">Google</option>
  </select>
  <input type="text" id="searchInput" placeholder="输入搜索内容">
  <button onclick="doSearch()">搜索</button>
</div>

<div id="groups"></div>

<!-- 弹窗 -->
<div class="modal" id="modal">
  <div class="modal-content">
    <h3 id="modalTitle">新增</h3>
    <div id="modalForm"></div>
    <button onclick="saveModal()">保存</button>
    <button onclick="closeModal()">取消</button>
  </div>
</div>

<!-- 登录弹窗 -->
<div class="modal" id="loginModal">
  <div class="modal-content">
    <h3>管理员登录</h3>
    <input type="password" id="adminKeyInput" placeholder="请输入管理员口令">
    <button onclick="login()">登录</button>
    <button onclick="closeLoginModal()">取消</button>
    <button id="logoutBtn" style="display:none;" onclick="logout()">退出登录</button>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
<script>
let groups=[], cards=[];
let adminMode=false, adminKey=null;
let editingType=null, editingIndex=null;

async function loadData(){
  groups=await (await fetch('/api/groups')).json();
  cards=await (await fetch('/api/cards')).json();
  render();
}
loadData();

function render(){
  const container=document.getElementById('groups');
  container.innerHTML='';
  groups.forEach((g,i)=>{
    const div=document.createElement('div'); div.className='group'; div.dataset.index=i;
    let adminBtns=adminMode?'<span class="admin-btns" style="display:inline-flex;"><button onclick="editGroup('+i+')">编辑</button><button onclick="deleteGroup('+i+')">删除</button></span>':'';
    div.innerHTML='<h2>'+g+adminBtns+'</h2>';
    const cardsDiv=document.createElement('div'); cardsDiv.className='cards'; cardsDiv.dataset.group=g;
    cards.filter(c=>c.group===g).forEach((c,j)=>{
      const cd=document.createElement('div'); cd.className='card'; cd.dataset.index=cards.indexOf(c);
      cd.innerHTML='<a href="'+c.url+'" target="_blank"><img src="https://www.google.com/s2/favicons?sz=32&domain='+c.url+'">'+c.title+'</a><div>'+c.url+'</div>';
      if(adminMode){
        const ab=document.createElement('div'); ab.className='admin-btns'; ab.style.display='flex';
        ab.innerHTML='<button onclick="editCard('+cards.indexOf(c)+')">编辑</button><button onclick="deleteCard('+cards.indexOf(c)+')">删除</button>';
        cd.appendChild(ab);
      }
      cardsDiv.appendChild(cd);
    });
    div.appendChild(cardsDiv); container.appendChild(div);
  });

  if(adminMode){
    enableDrag();
    document.getElementById('logoutBtn').style.display = 'inline-block';
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('addGroupBtn').style.display = 'inline-block';
    document.getElementById('addCardBtn').style.display = 'inline-block';
    document.getElementById('saveSortBtn').style.display = 'inline-block';
  } else {
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('addGroupBtn').style.display = 'none';
    document.getElementById('addCardBtn').style.display = 'none';
    document.getElementById('saveSortBtn').style.display = 'none';
  }
}

function enableDrag(){
  Sortable.create(document.getElementById('groups'), {
    handle:'h2',
    animation:150,
    onEnd: ()=>{
      groups=[...document.querySelectorAll('.group')].map(el=>groups[el.dataset.index]);
    }
  });

  document.querySelectorAll('.cards').forEach(el=>{
    Sortable.create(el,{
      animation:150,
      onEnd: ()=>{
        const g=el.dataset.group;
        const newOrder=[...el.querySelectorAll('.card')].map(cd=>cards[cd.dataset.index]);
        const others=cards.filter(c=>c.group!==g);
        cards=[...others,...newOrder];
      }
    });
  });
}

async function saveSort(){
  await fetch('/api/groups?key='+encodeURIComponent(adminKey),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(groups)
  });
  await fetch('/api/cards?key='+encodeURIComponent(adminKey),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cards)
  });
  alert("排序已保存！");
}

function openLoginModal() {
  document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
  document.getElementById('loginModal').style.display = 'none';
}

function login() {
  const key = document.getElementById('adminKeyInput').value.trim();
  if (key === '') return;

  adminKey = key; // Store admin key
  adminMode = true; // Set admin mode
  closeLoginModal(); // Close the login modal
  loadData(); // Reload data to render admin buttons and groups/cards
}

function logout() {
  adminMode = false; // Reset admin mode
  adminKey = null; // Clear admin key
  loadData(); // Reload data to hide admin buttons
}

function openModal(type, index = null) {
  editingType = type; editingIndex = index;
  document.getElementById('modal').style.display = 'flex';
  const form = document.getElementById('modalForm');
  if (type === 'group') {
    document.getElementById('modalTitle').innerText = index == null ? '新增分组' : '编辑分组';
    const val = index != null ? groups[index] : '';
    form.innerHTML = '<input type="text" id="groupName" placeholder="分组名称" value="' + val + '">';
  } else if (type === 'card') {
    document.getElementById('modalTitle').innerText = index == null ? '新增卡片' : '编辑卡片';
    let card = index != null ? cards[index] : { title: '', url: '', group: groups[0] || '', color: '#ffffff' };
    let opts = groups.map(g => '<option ' + (g === card.group ? 'selected' : '') + '>' + g + '</option>').join('');
    form.innerHTML = '<input type="text" id="cardTitle" placeholder="标题" value="' + card.title + '">' +
      '<input type="text" id="cardUrl" placeholder="链接" value="' + card.url + '">' +
      '<select id="cardGroup">' + opts + '</select>' +
      '<input type="color" id="cardColor" value="' + (card.color || '#ffffff') + '">';
  }
}
function closeModal() { document.getElementById('modal').style.display = 'none'; }

async function saveModal() {
  if (editingType === 'group') {
    const val = document.getElementById('groupName').value.trim(); if (!val) return;
    if (editingIndex == null) groups.push(val); else groups[editingIndex] = val;
    await fetch('/api/groups?key=' + encodeURIComponent(adminKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groups) });
  } else if (editingType === 'card') {
    const title = document.getElementById('cardTitle').value.trim();
    const url = document.getElementById('cardUrl').value.trim();
    const group = document.getElementById('cardGroup').value;
    const color = document.getElementById('cardColor').value;
    if (!title || !url) return;
    if (editingIndex == null) cards.push({ title, url, group, color });
    else cards[editingIndex] = { title, url, group, color };
    await fetch('/api/cards?key=' + encodeURIComponent(adminKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cards) });
  }
  closeModal(); render();
}

async function deleteGroup(i) {
  if (confirm("删除分组会同时删除该分组下的卡片，确认？")) {
    const g = groups[i]; groups.splice(i, 1); cards = cards.filter(c => c.group !== g);
    await fetch('/api/groups?key=' + encodeURIComponent(adminKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groups) });
    await fetch('/api/cards?key=' + encodeURIComponent(adminKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cards) });
    render();
  }
}
async function deleteCard(i) {
  if (confirm("确认删除该卡片？")) {
    cards.splice(i, 1);
    await fetch('/api/cards?key=' + encodeURIComponent(adminKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cards) });
    render();
  }
}

function editGroup(i) { openModal('group', i); }
function editCard(i) { openModal('card', i); }

function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  const eng = document.getElementById('engine').value;
  let url = eng === 'google' ? 'https://www.google.com/search?q=' + encodeURIComponent(q) : 'https://www.baidu.com/s?wd=' + encodeURIComponent(q);
  window.open(url, '_blank');
}

let isDarkTheme = false;

function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  document.body.className = isDarkTheme ? 'dark' : 'light';
}
</script>
</body>
</html>`;
}
