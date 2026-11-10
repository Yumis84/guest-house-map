/* Read-only guest house assistant. Production endpoint deliberately unset until reviewed. */
(() => {
  const root = document.getElementById('chatHost');
  if (!root) return;
  const endpoint = (window.ROMINTA_AI_CHAT_ENDPOINT || '').trim();
  const validEndpoint = (() => {
    try { const u = new URL(endpoint); return u.protocol === 'https:' && !!u.hostname; }
    catch { return false; }
  })();
  root.innerHTML = '';
  root.setAttribute('aria-label', 'Чат помощника');
  const history = document.createElement('div');
  history.className = 'rominta-chat-history';
  history.setAttribute('role', 'log');
  history.setAttribute('aria-live', 'polite');
  const form = document.createElement('form');
  form.className = 'rominta-chat-form';
  const field = document.createElement('input');
  field.type = 'text'; field.maxLength = 1200; field.placeholder = 'Задайте вопрос о гостевых домах';
  field.setAttribute('aria-label', 'Ваш вопрос');
  const send = document.createElement('button');
  send.type = 'submit'; send.textContent = 'Отправить';
  const note = document.createElement('p');
  note.className = 'rominta-chat-note';
  note.textContent = validEndpoint
    ? 'Помощник отвечает на вопросы. Наличие мест и бронирование уточняйте у владельца.'
    : 'Чат готов к подключению. Сервер помощника пока не настроен.';
  form.append(field, send); root.append(history, form, note);
  let busy = false;
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  function add(text, own) {
    const item = document.createElement('p');
    item.className = own ? 'rominta-chat-own' : 'rominta-chat-reply';
    item.textContent = text;
    history.append(item); history.scrollTop = history.scrollHeight;
  }
  add('Здравствуйте! Могу рассказать о гостевых домах Краснолесья. Проверка свободных дат и бронирование пока недоступны.', false);
  field.disabled = send.disabled = !validEndpoint;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const question = field.value.trim();
    if (!validEndpoint || busy || !question) return;
    busy = true; send.disabled = true; field.disabled = true;
    add(question, true); field.value = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'sendMessage', chatInput: question, sessionId}),
        signal: controller.signal, credentials: 'omit'
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const answer = data.output || data.text || data.response;
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('Empty response');
      add(answer.slice(0, 6000), false);
    } catch {
      add('Не удалось связаться с помощником. Попробуйте позже.', false);
    } finally {
      clearTimeout(timeout); busy = false; send.disabled = field.disabled = false; field.focus();
    }
  });
})();