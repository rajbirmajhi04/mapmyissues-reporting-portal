// app.js
// Civic Issues Reporting Platform JS
// Handles login session, issue management, UI rendering, polling for live sync

(() => {
  // Constants
  const STORAGE_KEY = 'civic_issues_data';
  const POLL_INTERVAL_MS = 1500;
  const DEMO_ISSUES = [
    {
      id: 'demo1',
      type: 'pothole',
      description: 'Large pothole near Main St.',
      location: 'Main Street',
      coordinates: { lat: 40.7128, lng: -74.006 },
      photo: '',
      votes: 3,
      priority: 'medium',
      status: 'recent',
      department: 'Road Maintenance',
      expense: 500,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
      votedBy: ['citizen1']
    },
    {
      id: 'demo2',
      type: 'streetlight',
      description: 'Streetlight flickering on 5th Ave.',
      location: '5th Avenue',
      coordinates: { lat: 40.7138, lng: -74.001 },
      photo: '',
      votes: 5,
      priority: 'immediate',
      status: 'queue',
      department: 'Electrical',
      expense: 200,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 1, // 1 day ago
      votedBy: ['citizen1', 'user2', 'user3', 'user4', 'user5']
    },
    {
      id: 'demo3',
      type: 'garbage',
      description: 'Overflowing garbage bin near park.',
      location: 'Central Park',
      coordinates: { lat: 40.7851, lng: -73.9683 },
      photo: '',
      votes: 1,
      priority: 'low',
      status: 'inprogress',
      department: 'Sanitation',
      expense: 0,
      createdAt: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
      votedBy: ['user6']
    },
  ];

  // Location suggestions for autosuggest
  const LOCATION_SUGGESTIONS = [
    'Main Street',
    '5th Avenue',
    'Central Park',
    'Broadway',
    'Elm Street',
    'Maple Avenue',
    'Oak Street',
    'Pine Street',
    'Cedar Road',
    'Washington Blvd',
  ];

  // Issue types for dropdown
  const ISSUE_TYPES = [
    'pothole',
    'streetlight',
    'garbage',
    'water leak',
    'sidewalk damage',
    'traffic signal',
    'graffiti',
    'parks maintenance',
    'drainage',
    'noise complaint'
  ];

  // Priority order for advancing status
  const STATUS_ORDER = ['recent', 'queue', 'inprogress', 'completed'];

  // Priority display names and colors
  const PRIORITY_DISPLAY = {
    low: 'Low',
    medium: 'Medium',
    immediate: 'Immediate',
    urgent: 'Urgent',
  };

  // Departments for demo
  const DEPARTMENTS = ['Road Maintenance', 'Electrical', 'Sanitation', 'Waterworks', 'Parks & Rec'];

  // Global state
  let issues = [];
  let username = null;
  let role = null;
  let pollTimer = null;
  let autosuggestTimeout = null;

  // DOM elements (will be set in init)
  let userGreetingEl, logoutBtn, leftPanel, recentColumn, queueColumn, inprogressColumn, completedColumn, insightsSection;

  // Initialize the application
  function init() {
    // Check if user is logged in
    username = sessionStorage.getItem('username');
    role = sessionStorage.getItem('role');
    
    if (!username || !role) {
      window.location.href = 'index.html';
      return;
    }

    // Get DOM elements
    userGreetingEl = document.getElementById('userGreeting');
    logoutBtn = document.getElementById('logoutBtn');
    leftPanel = document.getElementById('leftPanel');
    recentColumn = document.getElementById('recentColumn');
    queueColumn = document.getElementById('queueColumn');
    inprogressColumn = document.getElementById('inprogressColumn');
    completedColumn = document.getElementById('completedColumn');
    insightsSection = document.getElementById('insightsSection');

    // Setup event listeners
    setupEventListeners();

    // Load data and render UI
    loadIssues();
    renderUI();
    
    // Start polling for live updates
    startPolling();
  }

  // Setup event listeners
  function setupEventListeners() {
    // Logout button
    logoutBtn.addEventListener('click', () => {
      sessionStorage.clear();
      window.location.href = 'index.html';
    });

    // Handle clicks anywhere to close autosuggest
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autosuggest-list')) {
        closeAutosuggest();
      }
    });
  }

  // Utility: Generate unique ID
  function generateId() {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }

  // Utility: Save issues to localStorage
  function saveIssues() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
  }

  // Utility: Load issues from localStorage, initialize demo if empty
  function loadIssues() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        issues = JSON.parse(data);
      } catch {
        issues = [];
      }
    }
    if (!issues.length) {
      issues = DEMO_ISSUES.map(issue => ({ ...issue }));
      saveIssues();
    }
  }

  // Utility: Format coordinates nicely
  function formatCoords(coords) {
    return `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`;
  }

  // Utility: Format currency
  function formatCurrency(num) {
    return `$${num.toLocaleString()}`;
  }

  // Utility: Capitalize first letter
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Utility: Get priority CSS class
  function priorityClass(priority) {
    return `priority-${priority}`;
  }

  // Render the entire UI based on user role
  function renderUI() {
    if (!userGreetingEl) return;

    // Update user greeting
    userGreetingEl.textContent = `Welcome, ${username} (${role})`;

    // Render left panel based on role
    renderLeftPanel();

    // Render board columns
    renderBoardColumns();

    // Render insights for citizens
    if (role === 'citizen') {
      renderInsights();
    } else {
      insightsSection.innerHTML = '';
    }
  }

  // Render left panel (different for citizen vs admin)
  function renderLeftPanel() {
    if (role === 'citizen') {
      renderCitizenPanel();
    } else {
      renderAdminPanel();
    }
  }

  // Render citizen issue submission form
  function renderCitizenPanel() {
    leftPanel.innerHTML = `
      <h2>Report an Issue</h2>
      <form id="issueForm" class="issue-form">
        <div>
          <label for="issueType">Issue Type</label>
          <select id="issueType" name="type" required>
            <option value="" disabled selected>Select issue type</option>
            ${ISSUE_TYPES.map(type => `<option value="${type}">${capitalize(type)}</option>`).join('')}
          </select>
        </div>
        
        <div>
          <label for="issueDescription">Description</label>
          <textarea id="issueDescription" name="description" placeholder="Describe the issue in detail..." required></textarea>
        </div>
        
        <div class="autosuggest-list">
          <label for="issueLocation">Location</label>
          <input type="text" id="issueLocation" name="location" placeholder="Start typing location..." required>
          <ul id="locationSuggestions" style="display: none;"></ul>
        </div>
        
        <div>
          <label for="issueLat">Latitude</label>
          <input type="number" id="issueLat" name="lat" step="0.0001" placeholder="40.7128" required>
        </div>
        
        <div>
          <label for="issueLng">Longitude</label>
          <input type="number" id="issueLng" name="lng" step="0.0001" placeholder="-74.0060" required>
        </div>
        
        <div>
          <label for="issuePhoto">Photo (optional)</label>
          <input type="file" id="issuePhoto" name="photo" accept="image/*">
        </div>
        
        <div>
          <button type="button" id="getLocationBtn" class="btn-secondary" style="margin-bottom: 1em;">
            Use Current Location
          </button>
        </div>
        
        <button type="submit" class="submit-btn">Submit Issue</button>
      </form>
    `;

    // Setup form event listeners
    const form = document.getElementById('issueForm');
    const locationInput = document.getElementById('issueLocation');
    const suggestionsList = document.getElementById('locationSuggestions');
    const getLocationBtn = document.getElementById('getLocationBtn');

    // Location autosuggest
    locationInput.addEventListener('input', handleLocationInput);
    locationInput.addEventListener('focus', handleLocationInput);

    // Get current location
    getLocationBtn.addEventListener('click', getCurrentLocation);

    // Form submission
    form.addEventListener('submit', handleIssueSubmission);
  }

  // Handle location input for autosuggest
  function handleLocationInput(e) {
    const input = e.target;
    const suggestionsList = document.getElementById('locationSuggestions');
    const value = input.value.toLowerCase();

    clearTimeout(autosuggestTimeout);
    
    if (!value.trim()) {
      suggestionsList.style.display = 'none';
      return;
    }

    autosuggestTimeout = setTimeout(() => {
      const filtered = LOCATION_SUGGESTIONS.filter(loc => 
        loc.toLowerCase().includes(value)
      );

      if (filtered.length === 0) {
        suggestionsList.style.display = 'none';
        return;
      }

      suggestionsList.innerHTML = filtered.map(loc => 
        `<li data-location="${loc}">${loc}</li>`
      ).join('');
      suggestionsList.style.display = 'block';

      // Add click listeners to suggestions
      suggestionsList.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => {
          input.value = li.getAttribute('data-location');
          suggestionsList.style.display = 'none';
        });
      });
    }, 300);
  }

  // Close autosuggest dropdown
  function closeAutosuggest() {
    const suggestionsList = document.getElementById('locationSuggestions');
    if (suggestionsList) {
      suggestionsList.style.display = 'none';
    }
  }

  // Get current geolocation
  function getCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    const latInput = document.getElementById('issueLat');
    const lngInput = document.getElementById('issueLng');
    const locationInput = document.getElementById('issueLocation');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        latInput.value = position.coords.latitude.toFixed(6);
        lngInput.value = position.coords.longitude.toFixed(6);
        locationInput.value = 'Current Location';
      },
      (error) => {
        alert('Unable to retrieve your location: ' + error.message);
      }
    );
  }

  // Handle citizen issue submission
  function handleIssueSubmission(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const newIssue = {
      id: generateId(),
      type: formData.get('type'),
      description: formData.get('description'),
      location: formData.get('location'),
      coordinates: {
        lat: parseFloat(formData.get('lat')),
        lng: parseFloat(formData.get('lng'))
      },
      photo: '', // Handle file upload would go here
      votes: 0,
      priority: 'low', // Default priority
      status: 'recent',
      department: DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)],
      expense: Math.floor(Math.random() * 1000) + 100,
      createdAt: Date.now(),
      votedBy: []
    };

    // Add issue and save
    issues.push(newIssue);
    saveIssues();

    // Reset form and update UI
    form.reset();
    alert('Issue submitted successfully!');
    renderBoardColumns();
    renderInsights();
  }

  // Render admin control panel
  function renderAdminPanel() {
    leftPanel.innerHTML = `
      <h2>Admin Controls</h2>
      <div class="admin-form">
        <p>Use the controls on each issue card to manage priority and status.</p>
        <div style="margin-top: 1em; padding: 1em; background: #f8f9fa; border-radius: 4px;">
          <h3>Priority Guide</h3>
          <ul style="margin: 0; padding-left: 1.2em;">
            <li><strong>Low</strong>: Gray border - Routine issues</li>
            <li><strong>Medium</strong>: Yellow border - Moderate urgency</li>
            <li><strong>Immediate</strong>: Orange border - High priority</li>
            <li><strong>Urgent</strong>: Red border - Critical issues</li>
          </ul>
        </div>
      </div>
    `;
  }

  // Render all board columns with issues
  function renderBoardColumns() {
    if (!recentColumn) return;

    // Clear all columns
    recentColumn.innerHTML = '';
    queueColumn.innerHTML = '';
    inprogressColumn.innerHTML = '';
    completedColumn.innerHTML = '';

    // Sort issues by votes (descending) for recent column, then by creation date
    const sortedIssues = [...issues].sort((a, b) => {
      if (a.status === 'recent' && b.status === 'recent') {
        return b.votes - a.votes || b.createdAt - a.createdAt;
      }
      return b.createdAt - a.createdAt;
    });

    // Render issues in their respective columns
    sortedIssues.forEach(issue => {
      const card = createIssueCard(issue);
      const column = getColumnByStatus(issue.status);
      if (column) {
        column.appendChild(card);
      }
    });
  }

  // Get DOM column by status
  function getColumnByStatus(status) {
    switch (status) {
      case 'recent': return recentColumn;
      case 'queue': return queueColumn;
      case 'inprogress': return inprogressColumn;
      case 'completed': return completedColumn;
      default: return null;
    }
  }

  // Create an issue card element
  function createIssueCard(issue) {
    const card = document.createElement('div');
    card.className = `issue-card ${priorityClass(issue.priority)}`;
    card.dataset.id = issue.id;

    const hasVoted = issue.votedBy && issue.votedBy.includes(username);
    const canVote = role === 'citizen' && issue.status === 'recent' && !hasVoted;

    card.innerHTML = `
      <div class="type">${capitalize(issue.type)}</div>
      <div class="description">${issue.description}</div>
      <div class="location">📍 ${issue.location}</div>
      <div class="coordinates">${formatCoords(issue.coordinates)}</div>
      <div class="votes">👍 ${issue.votes} votes</div>
      <div class="priority">Priority: ${PRIORITY_DISPLAY[issue.priority]}</div>
      <div class="department">Department: ${issue.department}</div>
      <div class="expense">Est. Cost: ${formatCurrency(issue.expense)}</div>
      ${issue.photo ? `<img src="${issue.photo}" alt="Photo of ${issue.type} issue at ${issue.location}" class="photo">` : ''}
      
      ${role === 'citizen' && issue.status === 'recent' ? `
        <button class="btn-upvote" ${hasVoted ? 'disabled' : ''}>
          ${hasVoted ? 'Voted ✓' : 'Upvote'}
        </button>
      ` : ''}
      
      ${role === 'admin' ? `
        <div class="admin-controls">
          <select class="priority-select" data-issue-id="${issue.id}">
            <option value="low" ${issue.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${issue.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="immediate" ${issue.priority === 'immediate' ? 'selected' : ''}>Immediate</option>
            <option value="urgent" ${issue.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
          </select>
          <button class="advance-status" data-issue-id="${issue.id}" 
                  ${issue.status === 'completed' ? 'disabled' : ''}>
            ${issue.status === 'completed' ? 'Completed' : 'Advance Status'}
          </button>
        </div>
      ` : ''}
    `;

    // Add event listeners
    if (role === 'citizen' && canVote) {
      const upvoteBtn = card.querySelector('.btn-upvote');
      upvoteBtn.addEventListener('click', () => handleUpvote(issue.id));
    }

    if (role === 'admin') {
      const prioritySelect = card.querySelector('.priority-select');
      const advanceBtn = card.querySelector('.advance-status');

      prioritySelect.addEventListener('change', (e) => 
        handlePriorityChange(issue.id, e.target.value)
      );

      if (issue.status !== 'completed') {
        advanceBtn.addEventListener('click', () => 
          handleStatusAdvance(issue.id)
        );
      }
    }

    return card;
  }

  // Handle citizen upvote
  function handleUpvote(issueId) {
    const issue = issues.find(i => i.id === issueId);
    if (issue && issue.status === 'recent') {
      if (!issue.votedBy) issue.votedBy = [];
      if (!issue.votedBy.includes(username)) {
        issue.votes++;
        issue.votedBy.push(username);
        saveIssues();
        renderBoardColumns();
        renderInsights();
      }
    }
  }

  // Handle admin priority change
  function handlePriorityChange(issueId, newPriority) {
    const issue = issues.find(i => i.id === issueId);
    if (issue && issue.priority !== newPriority) {
      issue.priority = newPriority;
      saveIssues();
      
      // Update the card's priority class
      const card = document.querySelector(`.issue-card[data-id="${issueId}"]`);
      if (card) {
        card.className = `issue-card ${priorityClass(newPriority)}`;
      }
    }
  }

  // Handle admin status advancement
  function handleStatusAdvance(issueId) {
    const issue = issues.find(i => i.id === issueId);
    if (issue && issue.status !== 'completed') {
      const currentIndex = STATUS_ORDER.indexOf(issue.status);
      if (currentIndex < STATUS_ORDER.length - 1) {
        issue.status = STATUS_ORDER[currentIndex + 1];
        saveIssues();
        renderBoardColumns();
        renderInsights();
      }
    }
  }

  // Render insights for citizens
  function renderInsights() {
    if (role !== 'citizen') return;

    const completedCount = issues.filter(i => i.status === 'completed').length;
    const totalSpending = issues
      .filter(i => i.status === 'completed')
      .reduce((sum, issue) => sum + issue.expense, 0);

    // Find top department (most issues completed)
    const deptCounts = {};
    issues
      .filter(i => i.status === 'completed')
      .forEach(issue => {
        deptCounts[issue.department] = (deptCounts[issue.department] || 0) + 1;
      });

    const topDept = Object.keys(deptCounts).length > 0 
      ? Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0][0]
      : 'None';

    insightsSection.innerHTML = `
      <h3>Community Insights</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1em; margin-top: 0.5em;">
        <div style="background: #e8f5e8; padding: 1em; border-radius: 6px;">
          <strong>Total Completed Works</strong><br>
          <span style="font-size: 1.5em; font-weight: bold;">${completedCount}</span>
        </div>
        <div style="background: #e3f2fd; padding: 1em; border-radius: 6px;">
          <strong>Top Department</strong><br>
          <span style="font-size: 1.2em; font-weight: bold;">${topDept}</span>
        </div>
        <div style="background: #fff3e0; padding: 1em; border-radius: 6px;">
          <strong>Total Spending</strong><br>
          <span style="font-size: 1.2em; font-weight: bold;">${formatCurrency(totalSpending)}</span>
        </div>
      </div>
    `;
  }

  // Start polling for live updates
  function startPolling() {
    pollTimer = setInterval(() => {
      const oldIssues = JSON.stringify(issues);
      loadIssues();
      const newIssues = JSON.stringify(issues);

      if (oldIssues !== newIssues) {
        renderBoardColumns();
        if (role === 'citizen') {
          renderInsights();
        }
      }
    }, POLL_INTERVAL_MS);
  }

  // Stop polling (cleanup)
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Initialize the app when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', stopPolling);

})();
