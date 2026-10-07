import axios from 'axios';
import { showAlert } from './alerts';

export const bookTour = async tourId => {
  try {
    const response = await axios({
      method: 'POST',
      url: `/api/v1/bookings/demo/${tourId}`
    });
    if (response.data?.status !== 'success') {
      throw new Error('Unable to book this tour. Please try again.');
    }

    window.location.assign('/my-tours?alert=demo-booking');
    return true;
  } catch (err) {
    if (err.response?.status === 401) {
      window.location.assign('/login');
      return true;
    }
    showAlert(
      'error',
      err.response?.data?.message || err.message || 'Unable to book this tour. Please try again.'
    );
    return false;
  }
};
