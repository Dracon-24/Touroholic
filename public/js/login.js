import axios from 'axios';
import { showAlert } from './alerts';

export const login = async (email, password) => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',
      data: {
        email,
        password
      }
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully!');
      window.setTimeout(() => {
        location.assign('/');
      }, 1500);
      return true;
    }
    showAlert('error', 'Unable to log in. Please try again.');
  } catch (err) {
    showAlert(
      'error',
      err.response?.data?.message || 'Unable to connect. Please try again.'
    );
  }
  return false;
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout'
    });
    if (res.data.status === 'success') location.assign('/');
    else showAlert('error', 'Unable to log out. Please try again.');
  } catch (err) {
    console.log(err.response);
    showAlert('error', 'Error logging out! Try again.');
  }
};
