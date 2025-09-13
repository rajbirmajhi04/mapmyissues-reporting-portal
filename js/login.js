document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    const role = e.target.role.value;

    const isValidCitizen = role === 'citizen' && /^citizen\d+$/.test(username.toLowerCase());
    const isValidAdmin = role === 'admin' && /^admin\d+$/.test(username.toLowerCase());

    if (isValidCitizen || isValidAdmin) {
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('role', role);
      window.location.href = 'dashboard.html';
    } else {
      alert('Invalid username or role combination. Use citizen1, citizen2, etc. for citizens, or admin1, admin2, etc. for admins.');
    }
  });
});


