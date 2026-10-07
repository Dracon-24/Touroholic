const recoveryForm = document.querySelector('.form--recovery');
if (recoveryForm) {
  const reset = recoveryForm.dataset.mode === 'reset';
  const button = recoveryForm.querySelector('button');
  const status = document.getElementById('recovery-status');
  if (reset) {
    const check = () => recoveryForm.elements.passwordConfirm.setCustomValidity(
      recoveryForm.elements.password.value === recoveryForm.elements.passwordConfirm.value ? '' : 'Passwords do not match.'
    );
    recoveryForm.elements.password.addEventListener('input', check);
    recoveryForm.elements.passwordConfirm.addEventListener('input', check);
  }
  recoveryForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !recoveryForm.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'Please wait...';
    try {
      const data = reset ? {
        password: recoveryForm.elements.password.value,
        passwordConfirm: recoveryForm.elements.passwordConfirm.value
      } : { email: recoveryForm.elements.email.value.trim() };
      const url = reset ? `/api/v1/users/resetPassword/${encodeURIComponent(recoveryForm.dataset.token)}` : '/api/v1/users/forgotPassword';
      const response = await fetch(url, { method: reset ? 'PATCH' : 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.status !== 'success') throw new Error(result?.message || 'Unable to complete this request. Please try again.');
      status.textContent = reset ? 'Password reset. You are logged in.' : result.message;
      if (reset) { recoveryForm.reset(); window.setTimeout(() => location.assign('/me'), 1000); }
    } catch (error) { status.textContent = error.message || 'Unable to connect. Please try again.'; }
    finally { button.disabled = false; }
  });
}
