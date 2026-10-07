// Standalone browser script for the statically served signup page.
const signupForm = document.querySelector('.form--signup');

if (signupForm) {
  const password = signupForm.elements.password;
  const passwordConfirm = signupForm.elements.passwordConfirm;
  const status = document.getElementById('signup-status');
  const button = signupForm.querySelector('button[type="submit"]');
  let createdEmail = null;

  const validatePasswords = () => {
    passwordConfirm.setCustomValidity(
      password.value === passwordConfirm.value ? '' : 'Passwords do not match.'
    );
  };

  password.addEventListener('input', validatePasswords);
  passwordConfirm.addEventListener('input', validatePasswords);

  const request = async (url, data) => {
    const response = await fetch(url, {
      method: data ? 'POST' : 'GET',
      credentials: 'same-origin',
      ...(data ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      } : {})
    });
    const result = await response.json().catch(() => null);
    return { response, result };
  };

  signupForm.addEventListener('submit', async event => {
    event.preventDefault();
    validatePasswords();
    if (!signupForm.reportValidity() || button.disabled) return;

    const email = signupForm.elements.email.value.trim();
    button.disabled = true;
    button.textContent = 'Creating account...';
    status.textContent = '';

    try {
      let registrationError = null;
      if (createdEmail !== email) {
        const { response, result } = await request('/api/v1/users/signup', {
          name: signupForm.elements.name.value.trim(),
          email,
          password: password.value,
          passwordConfirm: passwordConfirm.value
        });
        if (response.ok && result?.status === 'success') {
          createdEmail = email;
        } else {
          registrationError = new Error(
            result?.message || 'Unable to create your account. Please try again.'
          );
          // Welcome email delivery can fail after the account has been saved.
          // A retry may then report that this email already exists.
          const duplicateEmail =
            (result?.error?.code === 11000 && result?.error?.keyValue?.email) ||
            /duplicate value for email:/i.test(result?.message || '');
          if (response.status < 500 && !duplicateEmail) throw registrationError;
        }
      }

      button.textContent = 'Logging in...';
      const login = await request('/api/v1/users/login', {
        email,
        password: password.value
      });
      if (!login.response.ok || login.result?.status !== 'success') {
        if (registrationError) throw registrationError;
        throw new Error(
          login.result?.message || 'Your account was created, but login failed. Please try again.'
        );
      }
      createdEmail = email;

      // Verify that the browser sends the session cookie to a protected endpoint.
      const session = await request('/api/v1/users/me');
      if (!session.response.ok || session.result?.status !== 'success') {
        throw new Error('Your account was created, but your login session could not be verified. Please log in.');
      }

      signupForm.reset();
      status.textContent = 'Account created successfully! You are logged in. Redirecting...';
      window.setTimeout(() => window.location.assign('/'), 1000);
    } catch (error) {
      status.textContent = error.message || 'Unable to connect. Please try again.';
      button.disabled = false;
      button.textContent = createdEmail === email ? 'Log in' : 'Sign up';
    }
  });
}
