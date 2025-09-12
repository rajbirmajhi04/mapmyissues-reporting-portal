document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    const role = e.target.role.value;

    if (
      (role === 'citizen' && username.toLowerCase() === 'citizen1') ||
      (role === 'admin' && username.toLowerCase() === 'admin1')
    ) {
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('role', role);
      window.location.href = 'dashboard.html';
    } else {
      alert('Invalid username or role combination. Use citizen1 or admin1 with correct role.');
    }
  });
});


