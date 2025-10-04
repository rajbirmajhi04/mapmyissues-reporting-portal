document.addEventListener('DOMContentLoaded', () => {
  let places = [];
  let departments = [];
  fetch('resources/places.json')
    .then(res => res.json())
    .then(data => {
      places = data;
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



  const form = document.getElementById('loginForm');
  if (!form) return;

  const loginError = document.getElementById('loginError');
  const loginButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const userIdentifier = e.target.username.value.trim();
    const password = e.target.password.value;
    const role = e.target.role.value;

    // Clear previous error
    loginError.textContent = '';
    loginError.style.display = 'none';

    // Helper function to check if string is email
    const isEmail = (str) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(str);
    };

    if (role === 'citizen') {
      const district = e.target.district.value;
      const town = e.target.town.value;
      if (!district || !town) {
        loginError.textContent = 'Please select district and town.';
        loginError.style.display = 'block';
        return;
      }
      sessionStorage.setItem('district', district);
      sessionStorage.setItem('town', town);
    } else if (role === 'department') {
      const department = e.target.department.value;
      if (!department) {
        loginError.textContent = 'Please select a department.';
        loginError.style.display = 'block';
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
      const adminUsernamePattern = /^admin\..+$/;
      if ((adminUsernamePattern.test(userIdentifier.toLowerCase()) || isEmail(userIdentifier)) && password.length > 0) {
        isValidAdmin = true;
      }
    } else if (role === 'department') {
      isValidDepartment = departments.some(dept => dept.code.toLowerCase() === userIdentifier.toLowerCase()) && password.length > 0;
    }

    if (isValidCitizen || isValidAdmin || isValidDepartment) {
      try {
        // Loading state
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';

        await dataService.logLogin(userIdentifier, role, password);
        sessionStorage.setItem('username', userIdentifier);
        sessionStorage.setItem('role', role);
        window.location.href = 'dashboard.html';
      } catch (error) {
        console.error('Failed to log login:', error);
        if (error.message === 'User is already logged in from another session.') {
          loginError.textContent = 'Login failed: ' + error.message;
          loginError.style.display = 'block';
        } else {
          loginError.textContent = 'Login successful, but failed to record in database. Proceeding to dashboard.';
          loginError.style.display = 'block';
          loginError.style.color = '#28a745';
          sessionStorage.setItem('username', userIdentifier);
          sessionStorage.setItem('role', role);
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 2000);
        }
      } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
      }
    } else {
      loginError.textContent = 'Invalid username/email, password, or role combination. Please check your credentials.';
      loginError.style.display = 'block';
    }
  });

  // Forgot Password button functionality
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  forgotPasswordBtn.addEventListener('click', () => {
    const email = prompt('Enter your email address to reset your password:');
    if (email) {
      alert('Password reset link has been sent to your email.');
      // Here you can add logic to send reset email
    }
  });

  // Simulate fetching total users count
  setTimeout(() => {
    const totalUsersCount = Math.floor(Math.random() * (1000000 - 10000 + 1)) + 10000; // Random number between 10000 and 1000000
    let formattedCount;
    if (totalUsersCount >= 100000) {
      formattedCount = Math.floor(totalUsersCount / 100000) + ' Lakh +';
    } else if (totalUsersCount >= 10000) {
      formattedCount = Math.floor(totalUsersCount / 1000) + ' K +';
    } else {
      formattedCount = totalUsersCount + ' +';
    }
    document.getElementById('totalUsersCount').textContent = formattedCount;
  }, 1000); // Simulate delay
});
