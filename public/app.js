const app = document.getElementById('app');
const topbarActions = document.getElementById('topbar-actions');

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* geen JSON body */ }
  if (!res.ok) throw new Error((data && data.error) || 'Er ging iets mis');
  return data;
}

function timeAgo(ts) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'zojuist';
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} u geleden`;
  return new Date(ts).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function init() {
  const { loggedIn } = await api('/api/session');
  if (loggedIn) {
    renderBoard();
  } else {
    renderLogin();
  }
}

function renderLogin() {
  topbarActions.innerHTML = '';
  app.innerHTML = '';
  const tpl = document.getElementById('tpl-login').content.cloneNode(true);
  app.appendChild(tpl);

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const password = document.getElementById('password').value;
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
      renderBoard();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

async function renderBoard() {
  topbarActions.innerHTML = '';
  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Uitloggen';
  logoutBtn.className = 'logout-btn';
  logoutBtn.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    renderLogin();
  });
  topbarActions.appendChild(logoutBtn);

  app.innerHTML = '';
  const tpl = document.getElementById('tpl-board').content.cloneNode(true);
  app.appendChild(tpl);

  document.getElementById('feed-url').textContent = `${location.origin}/feed.xml`;
  document.getElementById('copy-feed').addEventListener('click', async (e) => {
    await navigator.clipboard.writeText(`${location.origin}/feed.xml`);
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.textContent = 'Gekopieerd!';
    setTimeout(() => (btn.textContent = original), 1500);
  });

  const postForm = document.getElementById('post-form');
  const postError = document.getElementById('post-error');
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    postError.hidden = true;
    const textarea = document.getElementById('new-text');
    const text = textarea.value.trim();
    if (!text) return;
    try {
      await api('/api/messages', { method: 'POST', body: JSON.stringify({ text }) });
      textarea.value = '';
      await loadMessages();
    } catch (err) {
      postError.textContent = err.message;
      postError.hidden = false;
    }
  });

  await loadMessages();
}

async function loadMessages() {
  const board = document.getElementById('board');
  let messages;
  try {
    messages = await api('/api/messages');
  } catch (err) {
    if (err.message.includes('ingelogd')) return renderLogin();
    board.innerHTML = `<p class="error">${err.message}</p>`;
    return;
  }

  board.innerHTML = '';
  if (messages.length === 0) {
    board.innerHTML = '<p class="empty-state">Nog geen mededelingen. Plaats de eerste hierboven.</p>';
    return;
  }

  const noteTpl = document.getElementById('tpl-note');
  for (const msg of messages) {
    const node = noteTpl.content.cloneNode(true);
    node.querySelector('.note-text').textContent = msg.text;
    node.querySelector('.note-time').textContent = timeAgo(msg.createdAt);
    node.querySelector('.note-time').setAttribute('datetime', new Date(msg.createdAt).toISOString());
    node.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm('Dit bericht verwijderen?')) return;
      try {
        await api(`/api/messages/${msg.id}`, { method: 'DELETE' });
        await loadMessages();
      } catch (err) {
        alert(err.message);
      }
    });
    board.appendChild(node);
  }
}

init();
