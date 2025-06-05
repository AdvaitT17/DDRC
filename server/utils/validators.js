/**
 * Validates an email address
 * @param {string} email - The email address to validate
 * @returns {boolean} - Whether the email is valid
 */
function validateEmail(email) {
  if (!email) return false;

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  validateEmail,
};
