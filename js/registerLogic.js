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



  // Real-time validation
  const regUsername = document.getElementById('regUsername');
  const regEmail = document.getElementById('regEmail');
  const regPassword = document.getElementById('regPassword');
  const regConfirmPassword = document.getElementById('regConfirmPassword');

  regUsername.addEventListener('input', () => {
    if (regUsername.value.trim().length >= 3) {
      regUsername.classList.add('valid');
      regUsername.classList.remove('invalid');
    } else {
      regUsername.classList.add('invalid');
      regUsername.classList.remove('valid');
    }
  });

  regEmail.addEventListener('input', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(regEmail.value.trim())) {
      regEmail.classList.add('valid');
      regEmail.classList.remove('invalid');
    } else {
      regEmail.classList.add('invalid');
      regEmail.classList.remove('valid');
    }
  });

  regPassword.addEventListener('input', () => {
    if (regPassword.value.length >= 8) {
      regPassword.classList.add('valid');
      regPassword.classList.remove('invalid');
    } else {
      regPassword.classList.add('invalid');
      regPassword.classList.remove('valid');
    }
    // Also check confirm password
    if (regConfirmPassword.value === regPassword.value && regConfirmPassword.value.length > 0) {
      regConfirmPassword.classList.add('valid');
      regConfirmPassword.classList.remove('invalid');
    } else if (regConfirmPassword.value.length > 0) {
      regConfirmPassword.classList.add('invalid');
      regConfirmPassword.classList.remove('valid');
    }
  });

  regConfirmPassword.addEventListener('input', () => {
    if (regConfirmPassword.value === regPassword.value && regConfirmPassword.value.length >= 8) {
      regConfirmPassword.classList.add('valid');
      regConfirmPassword.classList.remove('invalid');
    } else {
      regConfirmPassword.classList.add('invalid');
      regConfirmPassword.classList.remove('valid');
    }
  });

  // Registration form handling
  const registerForm = document.getElementById('registerForm');
  const registerError = document.getElementById('registerError');
  const registerButton = registerForm.querySelector('button[type="submit"]');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const username = e.target.regUsername.value.trim();
    const email = e.target.regEmail.value.trim();
    const password = e.target.regPassword.value;
    const confirmPassword = e.target.regConfirmPassword.value;

    // Clear previous error
    registerError.textContent = '';
    registerError.style.display = 'none';

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      registerError.textContent = 'Please fill in all fields.';
      registerError.style.display = 'block';
      return;
    }

    if (password !== confirmPassword) {
      registerError.textContent = 'Passwords do not match.';
      registerError.style.display = 'block';
      return;
    }

    if (password.length < 8) {
      registerError.textContent = 'Password must be at least 8 characters long.';
      registerError.style.display = 'block';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      registerError.textContent = 'Please enter a valid email address.';
      registerError.style.display = 'block';
      return;
    }

    try {
      const district = e.target.regDistrict.value;
      const town = e.target.regTown.value;
      if (!district || !town) {
        registerError.textContent = 'Please select district and town.';
        registerError.style.display = 'block';
        return;
      }
      // Loading state
      registerButton.disabled = true;
      registerButton.textContent = 'Registering...';

      await dataService.registerUser(username, email, password, district, town);
      registerError.textContent = 'Registration successful! You can now log in.';
      registerError.style.display = 'block';
      registerError.style.color = '#28a745';
      // Switch back to login form
      setTimeout(() => {
        const loginToggle = document.getElementById('loginToggle');
        loginToggle.click();
      }, 2000);
    } catch (error) {
      console.error('Registration failed:', error);
      registerError.textContent = 'Registration failed: ' + (error.message || 'Unknown error');
      registerError.style.display = 'block';
      registerError.style.color = '#dc3545';
    } finally {
      registerButton.disabled = false;
      registerButton.textContent = 'Register';
    }
  });
});
