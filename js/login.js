document.addEventListener('DOMContentLoaded', () => {
  let places = [];
  let departments = [];
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
  fetch('resources/departments.json')
    .then(res => res.json())
    .then(data => departments = data)
    .catch(err => console.error('Failed to load departments:', err));

  // Form toggle functionality
  const loginToggle = document.getElementById('loginToggle');
  const registerToggle = document.getElementById('registerToggle');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const formTitle = document.getElementById('formTitle');

  loginToggle.addEventListener('click', () => {
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
    loginToggle.classList.add('active');
    registerToggle.classList.remove('active');
    formTitle.textContent = 'Portal Login';
  });

  registerToggle.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
    registerToggle.classList.add('active');
    loginToggle.classList.remove('active');
    formTitle.textContent = 'Citizen Registration';
  });

  const roleSelect = document.getElementById('role');
  const districtSelect = document.getElementById('district');
  const townSelect = document.getElementById('town');
  const departmentSelect = document.getElementById('department');
  const departmentCodeDisplay = document.getElementById('departmentCodeDisplay');
  const loginContainer = document.querySelector('.login-container');
  loginContainer.style.width = '400px';

  roleSelect.addEventListener('change', () => {
    const loginContainer = document.querySelector('.login-container');
    const districtLabel = document.getElementById('districtLabel');
    const townLabel = document.getElementById('townLabel');
    const departmentLabel = document.getElementById('departmentLabel');
    const usernameLabel = document.querySelector('label[for="username"]');
    const usernameInput = document.getElementById('username');
    if (roleSelect.value === 'citizen') {
      usernameLabel.textContent = 'Username or Email';
      usernameInput.placeholder = 'Enter your username or email';
      loginContainer.style.width = '400px';
      districtLabel.style.display = 'block';
      districtSelect.style.display = 'block';
      townLabel.style.display = 'block';
      townSelect.style.display = 'block';
      departmentLabel.style.display = 'none';
      departmentSelect.style.display = 'none';
      departmentCodeDisplay.style.display = 'none';
      // Populate districts
      districtSelect.innerHTML = '<option value="" disabled selected>Select district</option>';
      places.forEach(place => {
        const option = document.createElement('option');
        option.value = place.district;
        option.textContent = place.district;
        districtSelect.appendChild(option);
      });
    } else if (roleSelect.value === 'department') {
      usernameLabel.textContent = 'Department Code';
      usernameInput.placeholder = 'Enter your department code';
      loginContainer.style.width = '400px';
      districtLabel.style.display = 'none';
      districtSelect.style.display = 'none';
      townLabel.style.display = 'none';
      townSelect.style.display = 'none';
      departmentLabel.style.display = 'block';
      departmentSelect.style.display = 'block';
      departmentCodeDisplay.style.display = 'none';
      // Populate departments
      departmentSelect.innerHTML = '<option value="" disabled selected>Select department</option>';
      departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.code;
        option.textContent = dept.dept;
        departmentSelect.appendChild(option);
      });
    } else if (roleSelect.value === 'admin') {
      usernameLabel.textContent = 'Admin Name';
      usernameInput.placeholder = 'Enter admin name';
      loginContainer.style.width = '400px';
      districtLabel.style.display = 'none';
      districtSelect.style.display = 'none';
      townLabel.style.display = 'none';
      townSelect.style.display = 'none';
      departmentLabel.style.display = 'none';
      departmentSelect.style.display = 'none';
      departmentCodeDisplay.style.display = 'none';
    } else {
      usernameLabel.textContent = 'Username or Email';
      usernameInput.placeholder = 'Enter your username or email';
      loginContainer.style.width = '400px';
      districtLabel.style.display = 'none';
      districtSelect.style.display = 'none';
      townLabel.style.display = 'none';
      townSelect.style.display = 'none';
      departmentLabel.style.display = 'none';
      departmentSelect.style.display = 'none';
      departmentCodeDisplay.style.display = 'none';
    }
  });

  departmentSelect.addEventListener('change', () => {
    const selectedDeptCode = departmentSelect.value;
    const selectedDept = departments.find(dept => dept.code === selectedDeptCode);
    if (selectedDept) {
      departmentCodeDisplay.style.display = 'block';
      departmentCodeDisplay.textContent = `Department Code: ${selectedDept.code}`;
    } else {
      departmentCodeDisplay.style.display = 'none';
      departmentCodeDisplay.textContent = '';
    }
  });

  districtSelect.addEventListener('change', () => {
    const selectedDistrict = places.find(p => p.district === districtSelect.value);
    townSelect.innerHTML = '<option value="" disabled selected>Select town</option>';
    if (selectedDistrict) {
      selectedDistrict.towns.forEach(town => {
        const option = document.createElement('option');
        option.value = town;
        option.textContent = town;
        townSelect.appendChild(option);
      });
    }
  });

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

  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const userIdentifier = e.target.username.value.trim();
    const password = e.target.password.value;
    const role = e.target.role.value;

    // Helper function to check if string is email
    const isEmail = (str) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(str);
    };

    if (role === 'citizen') {
      const district = e.target.district.value;
      const town = e.target.town.value;
      if (!district || !town) {
        alert('Please select district and town.');
        return;
      }
      sessionStorage.setItem('district', district);
      sessionStorage.setItem('town', town);
    } else if (role === 'department') {
      const department = e.target.department.value;
      if (!department) {
        alert('Please select a department.');
        return;
      }
      sessionStorage.setItem('department', department);
    }

    // Validation logic updated to accept username or email for citizen and admin
    let isValidCitizen = false;
    let isValidAdmin = false;
    let isValidDepartment = false;

    if (role === 'citizen') {
      isValidCitizen = userIdentifier.length > 0 && password.length > 0;
    } else if (role === 'admin') {
      // Admin username pattern or admin email pattern
      const adminUsernamePattern = /^admin\d+$/;
      if ((adminUsernamePattern.test(userIdentifier.toLowerCase()) || isEmail(userIdentifier)) && password.length > 0) {
        isValidAdmin = true;
      }
    } else if (role === 'department') {
      isValidDepartment = departments.some(dept => dept.code.toLowerCase() === userIdentifier.toLowerCase()) && password.length > 0;
    }

    if (isValidCitizen || isValidAdmin || isValidDepartment) {
      try {
        await dataService.logLogin(userIdentifier, role, password);
        sessionStorage.setItem('username', userIdentifier);
        sessionStorage.setItem('role', role);
        window.location.href = 'dashboard.html';
      } catch (error) {
        console.error('Failed to log login:', error);
        if (error.message === 'User is already logged in from another session.') {
          alert('Login failed: ' + error.message);
        } else {
          alert('Login successful, but failed to record in database. Proceeding to dashboard.');
          sessionStorage.setItem('username', userIdentifier);
          sessionStorage.setItem('role', role);
          window.location.href = 'dashboard.html';
        }
      }
    } else {
      alert('Invalid username/email, password, or role combination. Please check your credentials.');
    }
  });

  // Registration form handling
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

    if (password.length < 6) {
      alert('Password must be at least 6 characters long.');
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
      loginToggle.click();
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed: ' + (error.message || 'Unknown error'));
    }
  });
});
