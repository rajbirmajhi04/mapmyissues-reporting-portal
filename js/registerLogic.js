document.addEventListener('DOMContentLoaded', () => {
  let places = [];
  fetch('resources/places.json')
    .then(res => res.json())
    .then(data => {
      places = data;
      // Populate registration district
      const regDistrictSelect = document.getElementById('regDistrict');
      regDistrictSelect.innerHTML = '<option value="" disabled selected>Select district</option>';
      places.forEach(place => {
        const option = document.createElement('option');
        option.value = place.district;
        option.textContent = place.district;
        regDistrictSelect.appendChild(option);
      });
    })
    .catch(err => console.error('Failed to load places:', err));

  const regDistrictSelect = document.getElementById('regDistrict');
  const regTownSelect = document.getElementById('regTown');

  regDistrictSelect.addEventListener('change', () => {
    const selectedDistrict = places.find(p => p.district === regDistrictSelect.value);
    regTownSelect.innerHTML = '<option value="" disabled selected>Select town</option>';
    if (selectedDistrict) {
      selectedDistrict.towns.forEach(town => {
        const option = document.createElement('option');
        option.value = town;
        option.textContent = town;
        regTownSelect.appendChild(option);
      });
    }
  });

  // Registration form handling
  const registerForm = document.getElementById('registerForm');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const username = e.target.regUsername.value.trim();
    const email = e.target.regEmail.value.trim();
    const password = e.target.regPassword.value;
    const confirmPassword = e.target.regConfirmPassword.value;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      alert('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }

    try {
      const district = e.target.regDistrict.value;
      const town = e.target.regTown.value;
      if (!district || !town) {
        alert('Please select district and town.');
        return;
      }
      await dataService.registerUser(username, email, password, district, town);
      alert('Registration successful! You can now log in.');
      // Switch back to login form
      const loginToggle = document.getElementById('loginToggle');
      loginToggle.click();
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed: ' + (error.message || 'Unknown error'));
    }
  });
});
