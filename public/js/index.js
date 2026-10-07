import { login, logout } from './login';
import { updateSettings } from './updateSettings';
import { bookTour } from './booking';
import { showAlert } from './alerts';

// DOM ELEMENTS
const mapBox = document.getElementById('map');
const loginForm = document.querySelector('.form--login');
const logOutBtn = document.querySelector('.nav__el--logout');
const userDataForm = document.querySelector('.form-user-data');
const userPasswordForm = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour');

// DELEGATION
if (mapBox) {
  import('./map').then(({ displayMap }) => {
    displayMap(JSON.parse(mapBox.dataset.locations));
  }).catch(() => {
    mapBox.closest('.section-map').hidden = true;
    console.warn('The map could not be loaded; tour stops are listed on the page.');
  });
}

if (loginForm)
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const button = loginForm.querySelector('button');
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Logging in...';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loggedIn = await login(email, password);
    if (!loggedIn) {
      button.disabled = false;
      button.textContent = 'Login';
    }
  });

if (logOutBtn) logOutBtn.addEventListener('click', logout);

if (userDataForm)
  userDataForm.addEventListener('submit', async e => {
    e.preventDefault();
    const button = userDataForm.querySelector('button');
    if (button.disabled) return;
    button.disabled = true;
    const form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    const photo = document.getElementById('photo').files[0];
    if (photo) form.append('photo', photo);
    const updated = await updateSettings(form, 'data');
    button.disabled = false;
    if (updated && typeof updated === 'object') {
      document.querySelectorAll('.form__user-photo, .nav__user-img').forEach(img => { img.src = `/img/users/${updated.photo}`; });
      const name = document.querySelector('.nav--user span');
      if (name) name.textContent = updated.name.split(' ')[0];
    }
  });

if (userPasswordForm)
  userPasswordForm.addEventListener('submit', async e => {
    e.preventDefault();
    const button = document.querySelector('.btn--save-password');
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Updating...';

    const passwordCurrent = document.getElementById('password-current').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    const updated = await updateSettings(
      { passwordCurrent, password, passwordConfirm },
      'password'
    );

    button.disabled = false;
    button.textContent = 'Save password';
    if (updated) userPasswordForm.reset();
  });

if (bookBtn)
  bookBtn.addEventListener('click', async () => {
    if (bookBtn.disabled) return;
    const label = bookBtn.textContent;
    bookBtn.disabled = true;
    bookBtn.textContent = 'Processing...';
    const bookingCreated = await bookTour(bookBtn.dataset.tourId);
    if (!bookingCreated) {
      bookBtn.disabled = false;
      bookBtn.textContent = label;
    }
  });

const alertMessage = document.querySelector('body').dataset.alert;
if (alertMessage) showAlert('success', alertMessage, 20);
