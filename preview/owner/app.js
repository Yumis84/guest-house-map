const STORAGE_KEY = 'guest-house-owner-preview-v1';

const seedListings = [
  {
    id: 'demo-guest-house',
    name: 'Дом у лесной тропы',
    locality: 'Краснолесье',
    category: 'guest_house',
    role: 'owner',
    price: 5200,
    guests: 6,
    description: 'Тихий гостевой дом для локальной демонстрации кабинета.',
    phone: '',
    email: '',
    available: true,
    published: true
  },
  {
    id: 'demo-apartment',
    name: 'Апартаменты у озера',
    locality: 'Чистые Пруды',
    category: 'apartment',
    role: 'intermediary',
    price: 3900,
    guests: 3,
    description: 'Второй вымышленный объект — данные не отправляются на сервер.',
    phone: '',
    email: '',
    available: false,
    published: false
  }
];

const $ = (id) => document.getElementById(id);
const form = $('listingForm');
const fields = ['name', 'locality', 'category', 'role', 'price', 'guests', 'description', 'phone', 'email', 'available'];
let state = loadState();
let saveTimer;

function cloneSeeds() {
  return seedListings.map((listing) => ({ ...listing }));
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && Array.isArray(parsed.listings) && parsed.listings.length > 0) {
      const listings = parsed.listings.filter(isValidListing).slice(0, 50);
      if (listings.length) {
        const selectedId = listings.some(({ id }) => id === parsed.selectedId) ? parsed.selectedId : listings[0].id;
        return { listings, selectedId };
      }
    }
  } catch {
    // Private browsing or malformed local data falls back to safe demo fixtures.
  }
  const listings = cloneSeeds();
  return { listings, selectedId: listings[0].id };
}

function isValidListing(value) {
  return value && typeof value.id === 'string' && typeof value.name === 'string'
    && ['guest_house', 'apartment'].includes(value.category)
    && ['owner', 'intermediary'].includes(value.role);
}

function currentListing() {
  return state.listings.find(({ id }) => id === state.selectedId) || state.listings[0];
}

function persist(message = 'Сохранено локально') {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('saveState').textContent = message;
  } catch {
    $('saveState').textContent = 'LocalStorage недоступен';
  }
}

function readForm() {
  const listing = currentListing();
  for (const id of fields) {
    const element = $(id);
    listing[id] = element.type === 'checkbox' ? element.checked : element.value;
  }
  listing.price = Number(listing.price);
  listing.guests = Number(listing.guests);
}

function scheduleSave() {
  readForm();
  renderList();
  renderGuestPreview();
  $('editorTitle').textContent = currentListing().name || 'Без названия';
  $('saveState').textContent = 'Сохраняем…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(), 250);
}

function categoryLabel(category) {
  return category === 'apartment' ? 'Апартаменты' : 'Гостевой дом';
}

function roleLabel(role) {
  return role === 'intermediary' ? 'Посредник' : 'Владелец';
}

function renderList() {
  const list = $('listingList');
  list.replaceChildren();
  for (const listing of state.listings) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'listing-card';
    button.dataset.listingId = listing.id;
    button.setAttribute('aria-current', String(listing.id === state.selectedId));
    const name = document.createElement('strong');
    name.textContent = listing.name || 'Без названия';
    const meta = document.createElement('span');
    meta.textContent = `${categoryLabel(listing.category)} · ${listing.published ? 'опубликовано в демо' : 'черновик'}`;
    button.append(name, meta);
    button.addEventListener('click', () => selectListing(listing.id));
    list.append(button);
  }
}

function renderForm() {
  const listing = currentListing();
  for (const id of fields) {
    const element = $(id);
    if (element.type === 'checkbox') element.checked = Boolean(listing[id]);
    else element.value = listing[id] ?? '';
  }
  $('editorTitle').textContent = listing.name || 'Без названия';
  $('togglePublish').textContent = listing.published ? 'Снять с публикации' : 'Опубликовать в демо';
}

function renderGuestPreview() {
  const container = $('guestPreview');
  const listing = currentListing();
  container.replaceChildren();
  if (!listing.published) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Черновик не показывается гостям.';
    container.append(empty);
    return;
  }
  const article = document.createElement('article');
  const title = document.createElement('h3');
  title.id = 'guestPreviewTitle';
  title.textContent = listing.name || 'Без названия';
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `${categoryLabel(listing.category)} · ${roleLabel(listing.role)} · ${listing.locality || 'Место не указано'} · до ${listing.guests || 1} гостей`;
  const description = document.createElement('p');
  description.textContent = listing.description || 'Описание пока не добавлено.';
  const price = document.createElement('strong');
  price.textContent = `${new Intl.NumberFormat('ru-RU').format(listing.price || 0)} ₽ за ночь`;
  article.append(title, meta, description, price);
  if (listing.available) {
    const availability = document.createElement('p');
    availability.textContent = 'Открыто для заявок в демо';
    article.append(availability);
  }
  container.append(article);
}

function selectListing(id) {
  readForm();
  state.selectedId = id;
  persist();
  render();
}

function render() {
  renderList();
  renderForm();
  renderGuestPreview();
}

form.addEventListener('input', scheduleSave);
form.addEventListener('change', scheduleSave);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  readForm();
  persist();
  render();
});

$('addListing').addEventListener('click', () => {
  readForm();
  const id = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.listings.push({
    id,
    name: 'Новый объект',
    locality: 'Краснолесье',
    category: 'guest_house',
    role: 'owner',
    price: 4500,
    guests: 2,
    description: '',
    phone: '',
    email: '',
    available: false,
    published: false
  });
  state.selectedId = id;
  persist('Новый черновик сохранён локально');
  render();
  $('name').select();
});

$('togglePublish').addEventListener('click', () => {
  if (!form.reportValidity()) return;
  readForm();
  currentListing().published = !currentListing().published;
  persist();
  render();
});

$('resetDemo').addEventListener('click', () => {
  if (!window.confirm('Удалить только локальные данные этого демо и восстановить примеры?')) return;
  const listings = cloneSeeds();
  state = { listings, selectedId: listings[0].id };
  persist('Демо сброшено');
  render();
});

window.addEventListener('pagehide', () => {
  readForm();
  persist();
});

render();
