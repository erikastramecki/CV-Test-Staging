const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// All fields are optional. We only flag a malformed email IF the user
// chose to type one — but we never block payment on it.
export function validateForm(form) {
  const errors = {};
  if (form.email && !EMAIL_RE.test(form.email)) {
    errors.email = "Enter a valid email";
  }
  return errors;
}
