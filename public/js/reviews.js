const reviewStatus = document.getElementById('reviews-status');
const reviewList = document.getElementById('reviews-list');
const reviewForm = document.getElementById('review-form');
const tourSelect = document.getElementById('review-tour');
const ratingSelect = document.getElementById('review-rating');
const reviewText = document.getElementById('review-text');
const saveReview = document.getElementById('review-save');
const cancelReview = document.getElementById('review-cancel');
const retryReviews = document.getElementById('reviews-retry');
const editor = document.getElementById('review-editor');
let reviewUser;
let userReviews = [];
let reviewTours = [];
let editingReview = null;
let reviewBusy = false;
const recordId = record => String(record?._id || record?.id || record || '');

async function reviewRequest(url, method = 'GET', data) {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {})
  });
  if (response.status === 401) {
    window.location.assign('/login');
    throw new Error('Please log in to view your reviews.');
  }
  if (response.status === 204) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.status !== 'success') {
    throw new Error(result?.message || 'Unable to load or save reviews. Please try again.');
  }
  return result.data.data;
}

async function reviewRecords(url) {
  const records = [];
  for (let page = 1; ; page++) {
    const batch = await reviewRequest(`${url}${url.includes('?') ? '&' : '?'}limit=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('Unable to load reviews. Please try again.');
    records.push(...batch);
    if (batch.length < 100) return records;
  }
}

function reviewElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderReviewEditor() {
  tourSelect.replaceChildren();
  tourSelect.appendChild(reviewElement('option', '', 'Choose a tour'));
  tourSelect.firstChild.value = '';
  const reviewed = new Set(userReviews.map(review => recordId(review.tour)));
  const available = reviewTours.filter(tour => !reviewed.has(recordId(tour)) || recordId(tour) === recordId(editingReview?.tour));
  for (const tour of available) {
    const option = reviewElement('option', '', tour.name);
    option.value = recordId(tour);
    tourSelect.appendChild(option);
  }
  if (editingReview && !available.some(tour => recordId(tour) === recordId(editingReview.tour))) {
    const option = reviewElement('option', '', 'Tour unavailable');
    option.value = recordId(editingReview.tour);
    tourSelect.appendChild(option);
  }
  editor.hidden = !editingReview && (reviewUser.role !== 'user' || available.length === 0);
  tourSelect.disabled = Boolean(editingReview);
  document.getElementById('review-editor-title').textContent = editingReview ? 'Edit your review' : 'Write a review';
  cancelReview.hidden = !editingReview;
  tourSelect.value = editingReview ? recordId(editingReview.tour) : '';
  ratingSelect.value = editingReview ? String(editingReview.rating) : '';
  reviewText.value = editingReview ? editingReview.review : '';
}

function renderUserReviews() {
  reviewList.replaceChildren();
  for (const review of userReviews) {
    const tour = reviewTours.find(tour => recordId(tour) === recordId(review.tour));
    const card = reviewElement('article', 'review-page__card');
    card.appendChild(reviewElement('h2', 'heading-secondary', tour?.name || 'Tour unavailable'));
    card.appendChild(reviewElement('p', 'review-page__rating', `${review.rating || '—'} / 5`));
    card.appendChild(reviewElement('p', 'review-page__text', review.review));
    const actions = reviewElement('div', 'review-page__actions');
    if (tour?.slug) {
      const link = reviewElement('a', 'btn-text', 'View tour');
      link.href = `/tour/${encodeURIComponent(tour.slug)}`;
      actions.appendChild(link);
    }
    if (['user', 'admin'].includes(reviewUser.role)) {
      const edit = reviewElement('button', 'btn btn--white btn--small', 'Edit review');
      edit.type = 'button';
      edit.addEventListener('click', () => {
        if (reviewBusy) return;
        editingReview = review;
        renderReviewEditor();
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      const remove = reviewElement('button', 'btn btn--white btn--small', 'Delete review');
      remove.type = 'button';
      remove.addEventListener('click', () => deleteUserReview(review, remove));
      actions.appendChild(edit);
      actions.appendChild(remove);
    }
    card.appendChild(actions);
    reviewList.appendChild(card);
  }
  renderReviewEditor();
}

async function loadReviewsPage() {
  retryReviews.hidden = true;
  reviewStatus.textContent = 'Loading your reviews...';
  try {
    reviewUser = await reviewRequest('/api/v1/users/me');
    [userReviews, reviewTours] = await Promise.all([
      reviewRecords(`/api/v1/reviews?user=${encodeURIComponent(recordId(reviewUser))}`),
      reviewRecords('/api/v1/tours?fields=name,slug')
    ]);
    userReviews = userReviews.filter(review => recordId(review.user) === recordId(reviewUser));
    editingReview = null;
    renderUserReviews();
    reviewStatus.textContent = userReviews.length ? '' : 'You have not written any reviews yet.';
  } catch (error) {
    reviewStatus.textContent = error.message || 'Unable to connect. Please try again.';
    retryReviews.hidden = false;
  }
}

async function saveUserReview(event) {
  event.preventDefault();
  if (reviewBusy || !reviewForm.reportValidity()) return;
  const text = reviewText.value.trim();
  if (!text) {
    reviewStatus.textContent = 'Please enter your review.';
    return;
  }
  reviewBusy = true;
  saveReview.disabled = true;
  saveReview.textContent = 'Saving...';
  try {
    const data = { review: text, rating: Number(ratingSelect.value) };
    const url = editingReview ? `/api/v1/reviews/${encodeURIComponent(recordId(editingReview))}` : '/api/v1/reviews';
    if (!editingReview) data.tour = tourSelect.value;
    const saved = await reviewRequest(url, editingReview ? 'PATCH' : 'POST', data);
    if (editingReview) userReviews = userReviews.filter(review => recordId(review) !== recordId(editingReview));
    userReviews.unshift(saved);
    editingReview = null;
    renderUserReviews();
    reviewStatus.textContent = 'Your review was saved.';
  } catch (error) {
    reviewStatus.textContent = error.message || 'Unable to save your review. Please try again.';
  } finally {
    reviewBusy = false;
    saveReview.disabled = false;
    saveReview.textContent = 'Save review';
  }
}

async function deleteUserReview(review, button) {
  if (reviewBusy || !window.confirm('Delete this review?')) return;
  reviewBusy = true;
  button.disabled = true;
  try {
    await reviewRequest(`/api/v1/reviews/${encodeURIComponent(recordId(review))}`, 'DELETE');
    userReviews = userReviews.filter(item => recordId(item) !== recordId(review));
    if (recordId(editingReview) === recordId(review)) editingReview = null;
    renderUserReviews();
    reviewStatus.textContent = 'Your review was deleted.';
  } catch (error) {
    reviewStatus.textContent = error.message || 'Unable to delete your review. Please try again.';
  } finally {
    reviewBusy = false;
    button.disabled = false;
  }
}

reviewForm.addEventListener('submit', saveUserReview);
cancelReview.addEventListener('click', () => {
  if (reviewBusy) return;
  editingReview = null;
  renderReviewEditor();
});
retryReviews.addEventListener('click', loadReviewsPage);
const reviewsReady = loadReviewsPage();
