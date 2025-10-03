document.addEventListener('DOMContentLoaded', () => {
  let places = [];
  let departments = [];
  fetch('resources/places.json')
    .then(res => res.json())
    .then(data => places = data)
    .catch(err => console.error('Failed to load places:', err));
  fetch('resources/departments.json')
    .then(res => res.json())
    .then(data => departments = data)
    .catch(err => console.error('Failed to load departments:', err));

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
    if (roleSelect.value === 'citizen') {
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
    } else {
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

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    const password = e.target.password.value;
    const role = e.target.role.value;

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

    const isValidCitizen = role === 'citizen' && username.length > 0 && password.length > 0; // any username and password allowed for citizen
    const isValidAdmin = role === 'admin' && /^admin\d+$/.test(username.toLowerCase()) && password.length > 0;
    const isValidDepartment = role === 'department' && departments.some(dept => dept.code.toLowerCase() === username.toLowerCase()) && password.length > 0;

    if (isValidCitizen || isValidAdmin || isValidDepartment) {
    try {
        await dataService.logLogin(username, role, password);
        sessionStorage.setItem('username', username);
        sessionStorage.setItem('role', role);
        window.location.href = 'dashboard.html';
      } catch (error) {
        console.error('Failed to log login:', error);
        if (error.message === 'User is already logged in from another session.') {
          alert('Login failed: ' + error.message);
        } else {
          alert('Login successful, but failed to record in database. Proceeding to dashboard.');
          sessionStorage.setItem('username', username);
          sessionStorage.setItem('role', role);
          window.location.href = 'dashboard.html';
        }
      }
    } else {
      alert('Invalid username, password, or role combination. Please check your credentials.');
    }
  });
});
