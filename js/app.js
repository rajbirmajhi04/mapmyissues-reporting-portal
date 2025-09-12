(() => {
  /* ===========================
     Constants & Demo Data
     =========================== */
  const STORAGE_KEY = 'civic_issues_data_v2';
  const POLL_INTERVAL_MS = 1500;
  const AUTOSUGGEST_DEBOUNCE_MS = 300;
  const DUPLICATE_DISTANCE_THRESHOLD = 0.0005;

  const LOCATION_SUGGESTIONS = [
    'Janpath Road','Sahid Nagar','Nayapalli','Jaydev Vihar','Chandrasekharpur','Khandagiri',
    'Patia','Bapuji Nagar','Bomikhal','CRP Square','KIIT Road','Baramunda','Unit-1 Market',
    'Vani Vihar','Rasulgarh','Laxmi Sagar','Acharya Vihar','Jagamara','Palasuni','Mancheswar',
  ];

  const ISSUE_TYPES = [
    'pothole','streetlight','garbage','water leak','sidewalk damage',
    'traffic signal','graffiti','parks maintenance','drainage','noise complaint','others'
  ];

  const STATUS_ORDER = ['recent', 'queue', 'inprogress', 'completed'];

  const PRIORITY_DISPLAY = {
    low: 'Low',
    medium: 'Medium',
    immediate: 'Immediate',
    urgent: 'Urgent',
  };

  const PRIORITY_RANK = { urgent: 3, immediate: 2, medium: 1, low: 0 };

  const DEPARTMENTS = [
    'Road Maintenance','Electrical','Sanitation','Waterworks','Parks & Rec',
    'Public Safety','Transportation','Housing & Urban Development','Environmental Services',
    'Health & Human Services','Planning & Zoning','Information Technology','Finance & Budget',
    'Emergency Management','Community Development'
  ];

  const DEMO_ISSUES = [
    {
      id: 'demo1',
      type: 'pothole',
      description: 'Big pothole near Master Canteen square, causing traffic jams.',
      location: 'Master Canteen Square, Bhubaneswar',
      coordinates: { lat: 20.2686, lng: 85.8430 },
      photo: '',
      votes: 3,
      priority: 'medium',
      status: 'recent',
      department: 'Road Maintenance',
      expense: 15000,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
      votedBy: ['citizen1']
    },
    {
      id: 'demo2',
      type: 'streetlight',
      description: 'Streetlight not working near KIIT Square.',
      location: 'KIIT Square, Bhubaneswar',
      coordinates: { lat: 20.3551, lng: 85.8192 },
      photo: '',
      votes: 5,
      priority: 'immediate',
      status: 'queue',
      department: 'Electrical',
      expense: 2500,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
      votedBy: ['citizen1','user2','user3','user4','user5']
    },
    {
      id: 'demo3',
      type: 'garbage',
      description: 'Garbage pile-up near Rupali Square bus stop.',
      location: 'Rupali Square, Bhubaneswar',
      coordinates: { lat: 20.2940, lng: 85.8253 },
      photo: '',
      votes: 1,
      priority: 'low',
      status: 'inprogress',
      department: 'Sanitation',
      expense: 800,
      createdAt: Date.now() - 1000 * 60 * 60 * 12,
      votedBy: ['user6']
    }
  ];

  /* ===========================
     App State & DOM refs
     =========================== */
  let issues = [];
  let username = null;
  let role = null;
  let pollTimer = null;
  let autosuggestTimer = null;
  let lastSavedAt = 0;
  let unsubscribeRealtime = null;

  // DOM refs set in init
  let userGreetingEl, logoutBtn, leftPanel, recentColumn, queueColumn, inprogressColumn, completedColumn, insightsSection;

  /* ===========================
     Utilities
     =========================== */
  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }

  function now() {
    return Date.now();
  }

  async function refreshIssuesFromServer() {
    try {
      const list = await window.dataService.fetchAllIssuesWithVotes();
      issues = list;
      renderBoardColumns();
      if (role === 'citizen') renderInsights();
    } catch (e) {
      console.error('Failed to load issues', e);
      notify('Unable to load issues from server');
    }
  }

  function formatCoords(coords) {
    if (!coords) return '';
    return `Lat: ${Number(coords.lat).toFixed(10)}, Lng: ${Number(coords.lng).toFixed(10)}`;
  }

  const INR_FORMATTER = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
  function formatCurrency(num) {
    if (!isFinite(num)) return '₹0';
    return INR_FORMATTER.format(num);
  }

  function capitalize(s = '') {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function priorityClass(priority) {
    return `priority-${priority || 'low'}`;
  }

  function notify(msg, timeout = 2500) {
    // simple non-blocking notification element
    let n = document.getElementById('appNotify');
    if (!n) {
      n = document.createElement('div');
      n.id = 'appNotify';
      n.style.position = 'fixed';
      n.style.right = '1rem';
      n.style.bottom = '1rem';
      n.style.background = '#222';
      n.style.color = '#fff';
      n.style.padding = '0.6rem 1rem';
      n.style.borderRadius = '6px';
      n.style.zIndex = 9999;
      n.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      document.body.appendChild(n);
    }
    n.textContent = msg;
    n.style.opacity = 1;
    clearTimeout(n._t);
    n._t = setTimeout(() => {
      n.style.transition = 'opacity 300ms';
      n.style.opacity = 0;
    }, timeout);
  }

  /* ===========================
     Sorting & helpers
     =========================== */
  function sortIssuesForColumn(list, status) {
    // sort by: priority rank desc, votes desc, createdAt desc
    return list
      .filter(i => i.status === status)
      .sort((a, b) => {
        const pr = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
        if (pr !== 0) return pr;
        if ((b.votes || 0) !== (a.votes || 0)) return (b.votes || 0) - (a.votes || 0);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  function findIssueById(id) {
    return issues.find(i => i.id === id);
  }

  function distanceApprox(a, b) {
    if (!a || !b) return Infinity;
    const dLat = a.lat - b.lat;
    const dLng = a.lng - b.lng;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  function isDuplicateNearby(type, coords) {
    if (!coords) return false;
    return issues.some(i => {
      if (i.type !== type) return false;
      const d = distanceApprox(i.coordinates, coords);
      return d <= DUPLICATE_DISTANCE_THRESHOLD;
    });
  }

  /* ===========================
     Rendering
     =========================== */
  function renderUI() {
    if (!userGreetingEl) return;
    userGreetingEl.textContent = `Welcome, ${username} (${role})`;
    renderLeftPanel();
    renderBoardColumns();
    if (role === 'citizen') renderInsights();
    else insightsSection.innerHTML = '';
  }

  function renderLeftPanel() {
    if (role === 'citizen') {
      renderCitizenPanel();
    } else {
      renderAdminPanel();
    }
  }

  function renderCitizenPanel() {
    leftPanel.innerHTML = `
      <h2>Report an Issue</h2>
      <form id="issueForm" class="issue-form" aria-label="Report an issue">

        <div>
          <label for="issueType">Issue Type</label>
          <input 
            type="text" 
            id="issueType" 
            name="type" 
            placeholder="Enter issue type..." 
            list="issueTypeOptions" 
            required 
            aria-required="true"
            autocomplete="off"
            style="width: 100%; padding: 0.4em; box-sizing: border-box;"
          >
          <datalist id="issueTypeOptions">
            ${ISSUE_TYPES.map(type => `<option value="${capitalize(type)}"></option>`).join('')}
          </datalist>
        </div>

        <div>
          <label for="issueDescription">Description</label>
          <textarea id="issueDescription" name="description" placeholder="Describe the issue in detail..." required rows="5" maxlength="500" style="resize: none; width: 100%;"></textarea>
          <small id="descHelp" class="form-text">Maximum 500 characters.</small>
        </div>

        <div class="autosuggest-list" style="position: relative;">
          <label for="issueLocation">Location</label>
          <input type="text" id="issueLocation" name="location" placeholder="Start typing location..." required aria-autocomplete="list" aria-haspopup="true" aria-expanded="false" autocomplete="off">
          <ul id="locationSuggestions" role="listbox" style="display:none; position:absolute; z-index:10; left:0; right:0; max-height:180px; overflow:auto; background:#fff; border:1px solid #ddd;"></ul>
        </div>

        <div style="display: flex; gap: 1em;">
          <div style="flex: 1;">
            <label for="issueLat">Latitude</label>
            <input type="number" id="issueLat" name="lat" step="0.0001" placeholder="0.00" required style="width: 100%;">
          </div>
          <div style="flex: 1;">
            <label for="issueLng">Longitude</label>
            <input type="number" id="issueLng" name="lng" step="0.0001" placeholder="0.00" required style="width: 100%;">
          </div>
        </div>

        <div>
          <label for="issuePhoto">Photo (optional)</label>
          <input type="file" id="issuePhoto" name="photo" accept="image/*" aria-label="Upload a photo">
        </div>

        <div>
          <button type="button" id="getLocationBtn" class="btn-secondary" style="margin-bottom:1em;">Use Current Location</button>
        </div>

        <button type="submit" class="submit-btn">Submit Issue</button>
        <div id="issueFormStatus" role="status" aria-live="polite" style="margin-top:0.5em;"></div>
      </form>
    `;

    const form = document.getElementById('issueForm');
    const locationInput = document.getElementById('issueLocation');

    locationInput.addEventListener('input', handleLocationInput);
    locationInput.addEventListener('keydown', handleLocationKeydown);
    locationInput.addEventListener('focus', handleLocationInput);
    document.getElementById('getLocationBtn').addEventListener('click', getCurrentLocation);
    form.addEventListener('submit', handleIssueSubmission);
  }

  function renderAdminPanel() {
    leftPanel.innerHTML = `
      <h2>Admin Controls</h2>
      <div class="admin-form">
        <p>Use the controls on each issue card to manage priority and status.</p>
        <div style="margin-top: 1em; padding: 1em; background: #f8f9fa; border-radius: 4px;">
          <h3>Priority Guide</h3>
          <ul style="margin: 0; padding-left: 1.2em;">
            <li><strong>Low</strong>: Gray - Routine issues</li>
            <li><strong>Medium</strong>: Yellow - Moderate urgency</li>
            <li><strong>Immediate</strong>: Orange - High priority</li>
            <li><strong>Urgent</strong>: Red - Critical issues</li>
          </ul>
        </div>
      </div>
    `;
  }

  function renderBoardColumns() {
    if (!recentColumn) return;
    // Clear columns
    recentColumn.innerHTML = '';
    queueColumn.innerHTML = '';
    inprogressColumn.innerHTML = '';
    completedColumn.innerHTML = '';

    // Render each column with sorted results
    const recentList = sortIssuesForColumn(issues, 'recent');
    const queueList = sortIssuesForColumn(issues, 'queue');
    const inprogressList = sortIssuesForColumn(issues, 'inprogress');
    const completedList = sortIssuesForColumn(issues, 'completed');

    recentList.forEach(i => recentColumn.appendChild(createIssueCard(i)));
    queueList.forEach(i => queueColumn.appendChild(createIssueCard(i)));
    inprogressList.forEach(i => inprogressColumn.appendChild(createIssueCard(i)));
    completedList.forEach(i => completedColumn.appendChild(createIssueCard(i)));
  }

  function getColumnByStatus(status) {
    switch (status) {
      case 'recent': return recentColumn;
      case 'queue': return queueColumn;
      case 'inprogress': return inprogressColumn;
      case 'completed': return completedColumn;
      default: return null;
    }
  }

  function createIssueCard(issue) {
    const card = document.createElement('div');
    card.className = `issue-card ${priorityClass(issue.priority)}`;
    card.dataset.id = issue.id;
    card.setAttribute('role', 'article');
    card.style.border = '1px solid #e6e6e6';
    card.style.padding = '0.8rem';
    card.style.marginBottom = '0.8rem';
    card.style.borderRadius = '6px';
    card.style.background = '#fff';

    const hasVoted = issue.votedBy && issue.votedBy.includes(username);
    const canVote = role === 'citizen' && issue.status === 'recent' && !hasVoted;

    // Build inner HTML
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:600;">${capitalize(issue.type)}</div>
        <div style="font-size:0.9em; color:#666;">${new Date(issue.createdAt).toLocaleString()}</div>
      </div>
      <div class="description" style="margin-top:0.4rem;">${escapeHtml(issue.description)}</div>
      <div class="location" style="margin-top:0.4rem;">📍 ${escapeHtml(issue.location)}</div>
      <div class="coordinates" style="font-size:0.85em; color:#555;">${formatCoords(issue.coordinates)}</div>
      <div style="display:flex; gap:8px; align-items:center; margin-top:0.6rem;">
        <div class="votes">👍 <span class="vote-count">${issue.votes || 0}</span> votes</div>
        <div class="priority" style="margin-left:auto;">Priority: ${PRIORITY_DISPLAY[issue.priority] || capitalize(issue.priority)}</div>
      </div>
      <div style="font-size:0.85em; color:#444; margin-top:0.4rem;">Department: ${escapeHtml(issue.department)} • Est. Cost: ${formatCurrency(issue.expense)}</div>
      ${issue.photo ? `<img src="${issue.photo}" alt="Photo of ${escapeHtml(issue.type)} at ${escapeHtml(issue.location)}" style="max-width:100%; margin-top:0.5rem; border-radius:4px;">` : ''}
      <div class="card-controls" style="margin-top:0.6rem; display:flex; gap:8px; align-items:center;">
        ${role === 'citizen' && issue.status === 'recent' ? `<button class="btn-upvote" data-id="${issue.id}" ${hasVoted ? 'disabled' : ''} aria-pressed="${hasVoted ? 'true' : 'false'}">${hasVoted ? 'Voted ✓' : 'Upvote'}</button>` : ''}
        ${role === 'admin' ? `
          <select class="priority-select" data-issue-id="${issue.id}" aria-label="Change priority">
            <option value="low" ${issue.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${issue.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="immediate" ${issue.priority === 'immediate' ? 'selected' : ''}>Immediate</option>
            <option value="urgent" ${issue.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
          </select>
          <button class="advance-status" data-issue-id="${issue.id}" ${issue.status === 'completed' ? 'disabled' : ''}>${issue.status === 'completed' ? 'Completed' : 'Advance Status'}</button>
        ` : ''}
      </div>
    `;

    // Use event delegation at container level (set up elsewhere)
    return card;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]);
  }

  function renderInsights() {
    if (role !== 'citizen') return;
    const completedCount = issues.filter(i => i.status === 'completed').length;
    const totalSpending = issues.filter(i => i.status === 'completed').reduce((s, it) => s + (it.expense || 0), 0);
    const deptCounts = {};
    issues.filter(i => i.status === 'completed').forEach(issue => {
      deptCounts[issue.department] = (deptCounts[issue.department] || 0) + 1;
    });
    const topDept = Object.keys(deptCounts).length > 0 ? Object.entries(deptCounts).sort((a,b)=>b[1]-a[1])[0][0] : 'None';

    insightsSection.innerHTML = `
      <h3>Community Insights</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:1em; margin-top:0.5em;">
        <div style="background:#e8f5e8; padding:1em; border-radius:6px;">
          <strong>Total Completed Works</strong><br><span style="font-size:1.5em; font-weight:bold;">${completedCount}</span>
        </div>
        <div style="background:#e3f2fd; padding:1em; border-radius:6px;">
          <strong>Top Department</strong><br><span style="font-size:1.2em; font-weight:bold;">${escapeHtml(topDept)}</span>
        </div>
        <div style="background:#fff3e0; padding:1em; border-radius:6px;">
          <strong>Total Spending</strong><br><span style="font-size:1.2em; font-weight:bold;">${formatCurrency(totalSpending)}</span>
        </div>
      </div>
    `;
  }

  /* ===========================
     Event Handlers & Actions
     =========================== */

  // --- Autosuggest (debounced + keyboard)
  function handleLocationInput(e) {
    const input = e.target;
    const value = input.value.trim().toLowerCase();
    const listEl = document.getElementById('locationSuggestions');
    input.setAttribute('aria-expanded', 'true');

    clearTimeout(autosuggestTimer);
    if (!value) {
      listEl.style.display = 'none';
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    autosuggestTimer = setTimeout(() => {
      const filtered = LOCATION_SUGGESTIONS.filter(loc => loc.toLowerCase().includes(value));
      if (!filtered.length) {
        listEl.style.display = 'none';
        input.setAttribute('aria-expanded', 'false');
        return;
      }
      listEl.innerHTML = filtered.map((loc, idx) => `<li role="option" data-index="${idx}" data-location="${escapeHtml(loc)}" style="padding:6px; cursor:pointer;">${escapeHtml(loc)}</li>`).join('');
      listEl.style.display = 'block';
      // click listeners (delegated)
      listEl.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => {
          input.value = li.getAttribute('data-location');
          listEl.style.display = 'none';
          input.setAttribute('aria-expanded', 'false');
        });
      });
    }, AUTOSUGGEST_DEBOUNCE_MS);
  }

  function handleLocationKeydown(e) {
    const listEl = document.getElementById('locationSuggestions');
    if (!listEl) return;
    const visible = listEl.style.display !== 'none';
    if (!visible) return;

    const items = Array.from(listEl.querySelectorAll('li'));
    if (!items.length) return;

    const active = listEl.querySelector('.active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!active) {
        items[0].classList.add('active');
        items[0].style.background = '#eef';
      } else {
        const idx = items.indexOf(active);
        active.classList.remove('active');
        active.style.background = '';
        const next = items[Math.min(items.length - 1, idx + 1)];
        next.classList.add('active');
        next.style.background = '#eef';
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!active) {
        items[items.length - 1].classList.add('active');
        items[items.length - 1].style.background = '#eef';
      } else {
        const idx = items.indexOf(active);
        active.classList.remove('active');
        active.style.background = '';
        const prev = items[Math.max(0, idx - 1)];
        prev.classList.add('active');
        prev.style.background = '#eef';
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = listEl.querySelector('.active') || items[0];
      if (chosen) {
        document.getElementById('issueLocation').value = chosen.getAttribute('data-location');
        listEl.style.display = 'none';
        e.target.setAttribute('aria-expanded', 'false');
      }
    } else if (e.key === 'Escape') {
      listEl.style.display = 'none';
      e.target.setAttribute('aria-expanded', 'false');
    }
  }

  function closeAutosuggest() {
    const listEl = document.getElementById('locationSuggestions');
    if (listEl) {
      listEl.style.display = 'none';
      const input = document.getElementById('issueLocation');
      if (input) input.setAttribute('aria-expanded', 'false');
    }
  }

  async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'CivicIssuesApp/1.0' }
      });
      if (!response.ok) throw new Error('Failed to reverse geocode');
      const data = await response.json();
      return data.display_name || '';
    } catch (e) {
      console.warn('Reverse geocode error:', e);
      return '';
    }
  }

  // Geolocation
  async function getCurrentLocation() {
  const latInput = document.getElementById('issueLat');
  const lngInput = document.getElementById('issueLng');
  const locationInput = document.getElementById('issueLocation');
  const getLocationBtn = document.getElementById('getLocationBtn');

  if (!navigator.geolocation) {
    notify('Geolocation is not supported by your browser');
    return;
  }

  getLocationBtn.disabled = true;
  getLocationBtn.textContent = 'Fetching location...';

  navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        latInput.value = latitude.toFixed(3);
        lngInput.value = longitude.toFixed(3);

        // Try reverse geocoding to get a human-readable location name
        const locationName = await reverseGeocode(latitude, longitude);
        locationInput.value = locationName || 'Current Location';

        getLocationBtn.disabled = false;
        getLocationBtn.textContent = 'Use Current Location';
      },
      (error) => {
        notify('Unable to retrieve your location: ' + error.message);
        getLocationBtn.disabled = false;
        getLocationBtn.textContent = 'Use Current Location';
      },
      { timeout: 10000 }
    );
  }

  // File -> base64 utility returning Promise
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  // Submission
  async function handleIssueSubmission(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const type = fd.get('type');
    const description = fd.get('description') || '';
    const location = fd.get('location') || '';
    const lat = parseFloat(fd.get('lat'));
    const lng = parseFloat(fd.get('lng'));
    const photoFile = fd.get('photo');

    const statusEl = document.getElementById('issueFormStatus');
    if (!type || !description || !location || !isFinite(lat) || !isFinite(lng)) {
      statusEl.textContent = 'Please fill all required fields with valid data.';
      return;
    }

    const coords = { lat, lng };

    // Duplicate check (client-side heuristic only)
    if (isDuplicateNearby(type, coords)) {
      notify('A similar issue (same type, nearby) may exist. Consider upvoting the existing report.');
    }

    // Upload photo (to storage) and create record
    let photo_url = '';
    try {
      if (photoFile && photoFile.size && photoFile.type.startsWith('image/')) {
        photo_url = await window.dataService.uploadPhotoIfNeeded(photoFile);
      }
    } catch (err) {
      console.warn('Photo upload failed:', err);
      notify('Failed to upload image — continuing without photo.');
    }

    try {
      const payload = {
        type,
        description,
        location,
        latitude: coords.lat,
        longitude: coords.lng,
        photo_url,
        priority: 'low',
        status: 'recent',
        department: DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)],
        expense: Math.floor(Math.random() * 1000) + 100
      };
      await window.dataService.createIssue(payload);
      form.reset();
      closeAutosuggest();
      statusEl.textContent = '';
      notify('Issue submitted successfully!');
      // Re-fetch to ensure consistency
      await refreshIssuesFromServer();
    } catch (e2) {
      console.error('Create issue failed', e2);
      notify('Failed to submit issue');
    }
  }

  // Upvote (citizen)
  async function handleUpvote(issueId) {
    const issue = findIssueById(issueId);
    if (!issue) return;
    if (issue.status !== 'recent') return;
    if (issue.votedBy && issue.votedBy.includes(username)) return;
    try {
      await window.dataService.addVote(issueId, username);
      await refreshIssuesFromServer();
    } catch (e) {
      console.error('Upvote failed', e);
      notify('Failed to upvote');
    }
  }

  // Admin: priority change
  async function handlePriorityChange(issueId, newPriority) {
    const issue = findIssueById(issueId);
    if (!issue) return;
    if (issue.priority === newPriority) return;
    try {
      await window.dataService.updateIssue(issueId, { priority: newPriority });
      // Optimistic class update
      const card = document.querySelector(`.issue-card[data-id="${issueId}"]`);
      if (card) card.className = `issue-card ${priorityClass(newPriority)}`;
    } catch (e) {
      console.error('Priority update failed', e);
      notify('Failed to update priority');
    }
  }

  // Admin: advance status
  async function handleStatusAdvance(issueId) {
    const issue = findIssueById(issueId);
    if (!issue) return;
    const idx = STATUS_ORDER.indexOf(issue.status);
    if (idx < 0 || idx >= STATUS_ORDER.length - 1) return;
    const next = STATUS_ORDER[idx + 1];
    try {
      await window.dataService.updateIssue(issueId, { status: next });
    } catch (e) {
      console.error('Status advance failed', e);
      notify('Failed to advance status');
    }
  }

  /* ===========================
     Polling & Sync
     =========================== */
  function startRealtime() {
    if (unsubscribeRealtime) return;
    unsubscribeRealtime = window.dataService.subscribeRealtime(async () => {
      await refreshIssuesFromServer();
    });
  }

  function stopRealtime() {
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
    }
  }

  /* ===========================
     Global Event Delegation
     =========================== */
  function setupGlobalDelegation() {
    // Upvote buttons, admin controls inside board container
    const board = document.getElementById('board'); // assuming a #board wrapper exists
    if (!board) {
      // fallback: attach to document
      document.addEventListener('click', globalClickHandler);
      document.addEventListener('change', globalChangeHandler);
      return;
    }
    board.addEventListener('click', globalClickHandler);
    board.addEventListener('change', globalChangeHandler);
  }

  function globalClickHandler(e) {
    const up = e.target.closest('.btn-upvote');
    if (up) {
      const id = up.getAttribute('data-id');
      handleUpvote(id);
      return;
    }
    const adv = e.target.closest('.advance-status');
    if (adv) {
      const id = adv.getAttribute('data-issue-id');
      handleStatusAdvance(id);
      return;
    }
  }

  function globalChangeHandler(e) {
    const sel = e.target.closest('.priority-select');
    if (sel) {
      const id = sel.getAttribute('data-issue-id');
      handlePriorityChange(id, sel.value);
    }
  }

  /* ===========================
     Initialization & Cleanup
     =========================== */
  function init() {
    username = sessionStorage.getItem('username');
    role = sessionStorage.getItem('role');

    if (!username || !role) {
      // not logged in
      window.location.href = 'index.html';
      return;
    }

    // DOM refs
    userGreetingEl = document.getElementById('userGreeting');
    logoutBtn = document.getElementById('logoutBtn');
    leftPanel = document.getElementById('leftPanel');
    recentColumn = document.getElementById('recentColumn');
    queueColumn = document.getElementById('queueColumn');
    inprogressColumn = document.getElementById('inprogressColumn');
    completedColumn = document.getElementById('completedColumn');
    insightsSection = document.getElementById('insightsSection');

    // Basic checks
    if (!userGreetingEl || !leftPanel) {
      console.error('UI root elements missing (userGreeting or leftPanel).');
    }

    // logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
      });
    }

    // close autosuggest on outside click
    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('.autosuggest-list')) {
        closeAutosuggest();
      }
    });

    // load and render from Supabase
    refreshIssuesFromServer();
    renderUI();
    setupGlobalDelegation();
    startRealtime();
  }

  // Clean up
  window.addEventListener('beforeunload', stopRealtime);

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ===========================
     End of file
     =========================== */
})();
