// Guest house frontend × existing n8n backend. v1
(function(){
  if (window.__guestHouseN8nV1) return;
  window.__guestHouseN8nV1 = true;

  const CHAT_WEBHOOK = 'https://n8n.xn----8sbalgvaeklgsbf4b.xn--p1ai/webhook/e32deeb2-aebf-49f2-aabd-aa245542f2cd/chat';
  const BOOKING_WEBHOOK = 'https://n8n.xn----8sbalgvaeklgsbf4b.xn--p1ai/webhook/guest-house-booking';
  let chatPromise = null;

  function ensureChatAssets(){
    if (!document.querySelector('link[data-guest-n8n-chat-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
      link.dataset.guestN8nChatCss = '1';
      document.head.appendChild(link);
    }
    if (document.getElementById('guest-n8n-chat-theme')) return;
    const style = document.createElement('style');
    style.id = 'guest-n8n-chat-theme';
    style.textContent = `
      #chatHost{
        height:min(62vh,560px);min-height:420px;
        --chat--color-primary:#f2a93b;
        --chat--color-primary-shade-50:#d99128;
        --chat--color-primary-shade-100:#b9781f;
        --chat--color-secondary:#7bd6a1;
        --chat--color-secondary-shade-50:#57bb81;
        --chat--color-white:#f4f7f5;
        --chat--color-light:#18221e;
        --chat--color-light-shade-50:#202c27;
        --chat--color-light-shade-100:#28362f;
        --chat--color-medium:#84918b;
        --chat--color-dark:#0b100f;
        --chat--color-disabled:#66726c;
        --chat--color-typing:#a9b5af;
        --chat--spacing:1rem;
        --chat--border-radius:16px;
        --chat--transition-duration:.16s;
        --chat--font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;
        --chat--window--width:100%;
        --chat--window--height:100%;
        --chat--window--border:none;
        --chat--window--border-radius:0;
        --chat--window--box-shadow:none;
        --chat--header--background:#111815;
        --chat--header--color:#f4f7f5;
        --chat--header--border-bottom:1px solid #28362f;
        --chat--body--background:#0b100f;
        --chat--footer--background:#0d1311;
        --chat--footer--color:#a9b5af;
        --chat--message--bot--background:#18221e;
        --chat--message--bot--color:#f4f7f5;
        --chat--message--user--background:#f2a93b;
        --chat--message--user--color:#271908;
      }
      #chatHost .chat-layout,#chatHost .chat-window-wrapper{height:100%!important;min-height:0!important}
      @media(max-width:520px){#chatHost{height:calc(100dvh - 250px);min-height:390px}}
    `;
    document.head.appendChild(style);
  }

  async function initChat(){
    if (chatPromise) return chatPromise;
    const host = document.getElementById('chatHost');
    if (!host) return;
    ensureChatAssets();
    host.innerHTML = '<div class="chat-placeholder"><b>Подключаем AI‑помощника…</b>Загружаем чат гостевых домов.</div>';
    chatPromise = (async()=>{
      try {
        const { createChat } = await import('https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js');
        host.innerHTML = '';
        createChat({
          webhookUrl: CHAT_WEBHOOK,
          target: '#chatHost',
          mode: 'fullscreen',
          chatInputKey: 'chatInput',
          chatSessionKey: 'sessionId',
          loadPreviousSession: true,
          metadata: { source: 'guest-house-map', surface: 'ai-tab' },
          showWelcomeScreen: false,
          defaultLanguage: 'ru',
          initialMessages: [
            'Здравствуйте! 👋',
            'Помогу подобрать свободный гостевой дом по датам и пожеланиям и оформить бронирование.'
          ],
          i18n: {
            ru: {
              title: 'AI‑помощник',
              subtitle: 'Гостевые дома Краснолесья',
              footer: '',
              getStarted: 'Новый диалог',
              inputPlaceholder: 'Напишите, какой дом вам нужен…'
            }
          }
        });
      } catch (error) {
        console.error('Guest house chat init failed', error);
        chatPromise = null;
        host.innerHTML = '<div class="chat-placeholder"><b>Чат временно недоступен</b>Попробуйте открыть помощника ещё раз чуть позже.</div>';
        throw error;
      }
    })();
    return chatPromise;
  }

  function setupBooking(){
    const form = document.getElementById('bookForm');
    if (!form) return;
    form.onsubmit = async (event)=>{
      event.preventDefault();
      if (typeof chosen === 'undefined' || !chosen) {
        if (typeof toast === 'function') toast('Сначала выберите гостевой дом');
        return;
      }

      const checkin = document.getElementById('checkin').value;
      const checkout = document.getElementById('checkout').value;
      if (!checkin || !checkout || checkout <= checkin) {
        if (typeof toast === 'function') toast('Дата выезда должна быть позже даты заезда');
        return;
      }

      const submit = form.querySelector('.submit');
      const originalText = submit ? submit.textContent : '';
      if (submit) { submit.disabled = true; submit.textContent = 'Отправляем…'; }

      const payload = {
        house_id: chosen.id,
        'Название_дома': chosen.name,
        'Имя_гостя': document.getElementById('guestName').value.trim(),
        'Телефон': document.getElementById('phone').value.trim(),
        'Email_гостя': document.getElementById('email').value.trim(),
        'Дата_заезда': checkin,
        'Дата_выезда': checkout,
        'Количество_гостей': String(document.getElementById('guests').value || ''),
        'Комментарий': document.getElementById('comment').value.trim()
      };

      try {
        const response = await fetch(BOOKING_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        let data = null;
        try { data = await response.json(); } catch (_) {}
        if (!response.ok || !data || data.success !== true) {
          const reason = data && (data.message || data.error) ? (data.message || data.error) : `HTTP ${response.status}`;
          throw new Error(reason);
        }

        const localBooking = {
          booking_id: data.booking_id || ('web_' + Date.now()),
          house_id: chosen.id,
          'Название_дома': chosen.name,
          'Имя_гостя': payload['Имя_гостя'],
          'Телефон': payload['Телефон'],
          'Email_гостя': payload['Email_гостя'],
          'Дата_заезда': payload['Дата_заезда'],
          'Дата_выезда': payload['Дата_выезда'],
          'Количество_гостей': Number(payload['Количество_гостей']) || null,
          'Стоимость': chosen.price || null,
          'Статус': data.status || 'pending',
          'Источник': 'web-n8n',
          'Дата_создания': new Date().toISOString(),
          'Комментарий': payload['Комментарий']
        };
        if (typeof bookings !== 'undefined' && Array.isArray(bookings)) {
          bookings.push(localBooking);
          localStorage.setItem('rominta_bookings', JSON.stringify(bookings));
        }
        document.getElementById('bookModal')?.classList.remove('on');
        form.reset();
        const guests = document.getElementById('guests');
        if (guests) guests.value = '2';
        if (typeof renderBookings === 'function') renderBookings();
        if (typeof toast === 'function') toast(data.message || 'Запрос на бронирование отправлен');
      } catch (error) {
        console.error('Guest house booking failed', error);
        if (typeof toast === 'function') toast('Не удалось отправить бронь. Попробуйте позже.');
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = originalText || 'Отправить запрос'; }
      }
    };
  }

  window.addEventListener('load', ()=>{
    setupBooking();

    const start = document.getElementById('startChat');
    if (start) {
      start.textContent = 'Открыть помощника';
      start.onclick = ()=>initChat().catch(()=>{});
    }

    const aiNav = document.querySelector('.nav [data-s="assistant"]');
    if (aiNav) aiNav.addEventListener('click', ()=>setTimeout(()=>initChat().catch(()=>{}), 0));
  });
})();
