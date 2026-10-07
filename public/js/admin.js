const adminPage = document.getElementById('admin-page');
if (adminPage) {
  const resource = adminPage.dataset.resource;
  const list = document.getElementById('admin-list');
  const status = document.getElementById('admin-status');
  const form = document.getElementById('admin-form');
  const fields = document.getElementById('admin-fields');
  const editor = document.getElementById('admin-editor');
  const save = document.getElementById('admin-save');
  const add = document.getElementById('admin-new');
  let selected = null;
  let busy = false;
  const id = record => record._id || record.id;
  const schemas = {
    tours: [
      ['name', 'Tour name', 'text'], ['price', 'Price', 'number'], ['duration', 'Duration (days)', 'number'],
      ['maxGroupSize', 'Maximum group size', 'number'], ['difficulty', 'Difficulty', ['easy', 'medium', 'difficult']],
      ['summary', 'Summary', 'textarea'], ['description', 'Description', 'textarea'],
      ['startDate', 'Next start date', 'date']
    ],
    users: [['name', 'Name', 'text'], ['email', 'Email address', 'email'], ['role', 'Role', ['user', 'guide', 'lead-guide', 'admin']]],
    reviews: [['review', 'Review', 'textarea'], ['rating', 'Rating', ['1', '2', '3', '4', '5']]],
    bookings: []
  };
  const element = (tag, text, className = '') => {
    const el = document.createElement(tag); el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  async function request(url, method = 'GET', body) {
    const response = await fetch(url, { method, credentials: 'same-origin',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    if (response.status === 401) { location.assign('/login'); throw new Error('Please log in.'); }
    if (response.status === 204) return null;
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== 'success') throw new Error(result?.message || 'Unable to complete this request.');
    return result.data.data;
  }
  function edit(record) {
    if (busy) return;
    selected = record;
    fields.replaceChildren();
    for (const [name, label, type] of schemas[resource]) {
      const group = element('div', undefined, 'form__group');
      const caption = element('label', label, 'form__label'); caption.htmlFor = `admin-${name}`;
      const input = element(Array.isArray(type) ? 'select' : type === 'textarea' ? 'textarea' : 'input', undefined, 'form__input');
      input.name = name; input.id = `admin-${name}`; input.required = !['description', 'startDate'].includes(name);
      if (Array.isArray(type)) type.forEach(value => { const option = element('option', value); option.value = value; input.appendChild(option); });
      else if (type !== 'textarea') input.type = type;
      if (type === 'number') { input.min = name === 'price' ? '0' : '1'; input.step = name === 'price' ? '0.01' : '1'; }
      input.value = name === 'startDate' ? (record?.startDates?.[0] || '').slice(0, 10) : record?.[name] ?? (Array.isArray(type) ? type[0] : '');
      group.append(caption, input); fields.appendChild(group);
    }
    document.getElementById('admin-editor-title').textContent = record ? 'Edit record' : 'Add tour';
    editor.hidden = false; editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function load() {
    if (busy) return;
    status.textContent = 'Loading...';
    try {
      const records = [];
      for (let page = 1; ; page++) {
        const batch = await request(`/api/v1/${resource}?limit=100&page=${page}`);
        records.push(...batch); if (batch.length < 100) break;
      }
      list.replaceChildren();
      for (const record of records) {
        const card = element('article', undefined, 'review-page__card');
        const heading = resource === 'bookings' ? `${record.tour?.name || 'Deleted tour'} — ${record.user?.name || 'Deleted user'}` : resource === 'reviews' ? `${record.user?.name || 'Deleted user'} · ${record.rating}/5` : record.name;
        card.appendChild(element('h2', heading, 'heading-secondary'));
        const detail = resource === 'users' ? `${record.email} · ${record.role}` : resource === 'tours' ? `$${record.price} · ${record.duration} days` : resource === 'reviews' ? record.review : record.demo || !record.paid ? 'Demo reservation — no payment collected' : 'Previously recorded as paid';
        card.appendChild(element('p', detail, 'review-page__text'));
        const actions = element('div', undefined, 'review-page__actions');
        if (schemas[resource].length) {
          const button = element('button', 'Edit', 'btn btn--white btn--small'); button.type = 'button';
          button.addEventListener('click', () => edit(record)); actions.appendChild(button);
        }
        const remove = element('button', 'Delete', 'btn btn--white btn--small'); remove.type = 'button';
        remove.addEventListener('click', async () => {
          if (busy || !window.confirm('Delete this record? This cannot be undone.')) return;
          busy = true; remove.disabled = true;
          try { await request(`/api/v1/${resource}/${id(record)}`, 'DELETE'); editor.hidden = true; busy = false; await load(); status.textContent = 'Record deleted.'; }
          catch (error) { status.textContent = error.message; }
          finally { busy = false; remove.disabled = false; }
        });
        actions.appendChild(remove); card.appendChild(actions); list.appendChild(card);
      }
      status.textContent = records.length ? `${records.length} records` : 'No records yet.';
    } catch (error) { status.textContent = error.message; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !form.reportValidity()) return;
    busy = true; save.disabled = true;
    try {
      const data = {};
      for (const [name, , type] of schemas[resource]) {
        const value = form.elements[name].value;
        if (name === 'startDate') {
          if (value && value !== (selected?.startDates?.[0] || '').slice(0, 10)) data.startDates = [value, ...(selected?.startDates || []).slice(1)];
        } else data[name] = type === 'number' || name === 'rating' ? Number(value) : value;
      }
      if (!selected && resource === 'tours') {
        data.imageCover = 'tour-1-cover.jpg';
        data.images = ['tour-1-1.jpg', 'tour-1-2.jpg', 'tour-1-3.jpg'];
      }
      await request(`/api/v1/${resource}${selected ? '/' + id(selected) : ''}`, selected ? 'PATCH' : 'POST', data);
      editor.hidden = true; busy = false; await load(); status.textContent = 'Changes saved.';
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; save.disabled = false; }
  });
  add.hidden = resource !== 'tours'; add.addEventListener('click', () => edit(null));
  document.getElementById('admin-cancel').addEventListener('click', () => { if (!busy) editor.hidden = true; });
  document.getElementById('admin-reload').addEventListener('click', load);
  load();
}
