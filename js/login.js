document.addEventListener('DOMContentLoaded', () => {
  let places = [];
  fetch('resources/places.json')
    .then(res => res.json())
    .then(data => places = data)
    .catch(err => console.error('Failed to load places:', err));

  const roleSelect = document.getElementById('role');
  const districtSelect = document.getElementById('district');
  const townSelect = document.getElementById('town');

  roleSelect.addEventListener('change', () => {
    const districtLabel = document.getElementById('districtLabel');
    const townLabel = document.getElementById('townLabel');
    if (roleSelect.value === 'citizen') {
      districtLabel.style.display = 'block';
      districtSelect.style.display = 'block';
      townLabel.style.display = 'block';
      townSelect.style.display = 'block';
      // Populate districts
      districtSelect.innerHTML = '<option value="" disabled selected>Select district</option>';
      places.forEach(place => {
        const option = document.createElement('option');
        option.value = place.district;
        option.textContent = place.district;
        districtSelect.appendChild(option);
      });
    } else {
      districtLabel.style.display = 'none';
      districtSelect.style.display = 'none';
      townLabel.style.display = 'none';
      townSelect.style.display = 'none';
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
    }

    const isValidCitizen = role === 'citizen' && /^citizen\d+$/.test(username.toLowerCase());
    const isValidAdmin = role === 'admin' && /^admin\d+$/.test(username.toLowerCase());

    if (isValidCitizen || isValidAdmin) {
    try {
        await dataService.logLogin(username, role);
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
      alert('Invalid username or role combination. Use citizen1, citizen2, etc. for citizens, or admin1, admin2, etc. for admins.');
    }
  });
});


