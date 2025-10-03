(() => {
  /* ===========================
     Constants & Demo Data
     =========================== */
  const AUTOSUGGEST_DEBOUNCE_MS = 300;
  const DUPLICATE_DISTANCE_THRESHOLD = 0.0005;
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  const LOCATION_SUGGESTIONS = [
    'Janpath Road','Sahid Nagar','Nayapalli','Jaydev Vihar','Chandrasekharpur','Khandagiri',
    'Patia','Bapuji Nagar','Bomikhal','CRP Square','KIIT Road','Baramunda','Unit-1 Market',
    'Vani Vihar','Rasulgarh','Laxmi Sagar','Acharya Vihar','Jagamara','Palasuni','Mancheswar',
  ];

  const ISSUE_TYPES = {
    roads: ["pothole", "sidewalk damage", "traffic management", "abandoned vehicles", "parking hazards"],
    utilities: ["water leak", "streetlight", "traffic signal", "streetlights", "piped water supply", "water quality", "leakages", "supply disruptions", "streetlight outages", "public electrical hazards", "power outages affecting civic services"],
    sanitation: ["garbage", "drainage", "solid waste", "sanitation", "street cleaning", "drains", "sewerage", "sewer rehabilitation", "major sanitation projects", "rural sanitation", "vector control", "sanitation health hazards", "garbage collection lapses", "illegal dumping", "dump site complaints"],
    public_space: ["parks maintenance", "graffiti", "park maintenance in development areas"],
    environment: ["noise complaint", "pollution complaints", "tree/greenbelt issues", "environmental violations", "river embankments", "urban flooding", "storm drainage"],
    others: ["others", "municipal services", "urban planning", "ULB grievances", "licensing", "property tax", "disaster relief", "post-disaster infrastructure repair", "emergency coordination", "rural water supply", "panchayat-level civic works", "public health outbreaks", "illegal construction", "planning violations", "public housing maintenance", "allotment complaints", "slum-upgrade civic issues"]
  };

  const STATUS_ORDER = ['recent', 'queue', 'inprogress', 'completed'];

  const PRIORITY_DISPLAY = {
    low: 'Low',
    medium: 'Medium',
    immediate: 'Immediate',
    urgent: 'Urgent',
  };

  const PRIORITY_RANK = { urgent: 3, immediate: 2, medium: 1, low: 0 };

  const DEPARTMENTS = [
    "Housing & Urban Development Department",
    "Directorate of Municipal Administration",
    "Orissa Water Supply & Sewerage Board (OWSSB)",
    "Public Health Engineering Organization (PHEO)",
    "Public Works / Works Department (PWD)",
    "Water Resources Department",
    "Revenue & Disaster Management",
    "Panchayati Raj & Drinking Water",
    "Forest, Environment & Climate Change",
    "Health & Family Welfare",
    "Energy Departmetion Utilities",
    "Transport / Commerce & Transport",
    "Home / Police / Traffic Police",
    "Development Authorities (BDA/CDA etc.)",
    "Odisha Urban Housing Mission / State Housing Board",
    "ULB Solid Waste / Sanitation Cells"
  ];

  /* ===========================
     App State & DOM refs
     =========================== */
  let issues = [];
  let username = null;
  let role = null;
  let autosuggestTimer = null;
  let unsubscribeRealtime = null;
  let inactivityTimer = null;

  // DOM refs set in init
  let userGreetingEl, logoutBtn, leftPanel, recentColumn, queueColumn, inprogressColumn, completedColumn, insightsSection;

  /* ===========================
     Utilities
     =========================== */

  // Detect current page type
  function getCurrentPageType() {
    const path = window.location.pathname;
    if (path.includes('dashboard.html')) return 'dashboard';
    if (path.includes('recent.html')) return 'recent';
    if (path.includes('queue.html')) return 'queue';
    if (path.includes('inprogress.html')) return 'inprogress';
    if (path.includes('completed.html')) return 'completed';
    if (path.includes('history.html')) return 'history';
    return 'dashboard'; // default
  }

  async function refreshIssuesFromServer(force = false) {
    try {
      const list = await window.dataService.fetchAllIssuesWithVotes(username, force);
      issues = list;

      const pageType = getCurrentPageType();
      if (pageType === 'dashboard') {
        renderBoardColumns();
      } else {
        // For individual status pages, render only that status with pagination
        renderStatusPage(pageType);
      }

      if (role === 'citizen') renderInsights();
      else if (role === 'admin') renderLeftPanel();

      // Update modal content if open
      if (currentOpenModalStatus) {
        renderModalContent(currentOpenModalStatus);
      }
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

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      // Auto logout due to inactivity
      try {
        await window.dataService.logLogout(username);
      } catch (error) {
        console.error('Failed to log logout on inactivity:', error);
      }
      sessionStorage.clear();
      window.location.href = 'index.html';
    }, INACTIVITY_TIMEOUT_MS);
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
            ${Object.values(ISSUE_TYPES).flat().map(type => `<option value="${capitalize(type)}"></option>`).join('')}
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
    const completedIssues = issues.filter(i => i.status === 'completed');
    const priorityCounts = { low: 0, medium: 0, immediate: 0, urgent: 0 };
    completedIssues.forEach(issue => {
      priorityCounts[issue.priority] = (priorityCounts[issue.priority] || 0) + 1;
    });
    const deptCounts = {};
    completedIssues.forEach(issue => {
      deptCounts[issue.department] = (deptCounts[issue.department] || 0) + 1;
    });
    const topDept = Object.keys(deptCounts).length > 0 ? Object.entries(deptCounts).sort((a,b)=>b[1]-a[1])[0][0] : 'None';
    const totalSpending = completedIssues.reduce((s, it) => s + (it.expense || 0), 0);

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
        <div class="admin-insights" style="margin-top: 2em; padding: 1em; background: #f0f8ff; border-radius: 6px;">
          <h3>Admin Insights</h3>
          <div style="margin-top: 0.5em;">
            <strong>Issues Solved by Priority:</strong><br>
            Low: ${priorityCounts.low}, Medium: ${priorityCounts.medium}, Immediate: ${priorityCounts.immediate}, Urgent: ${priorityCounts.urgent}
          </div>
          <div style="margin-top: 0.5em;">
            <strong>Top Performing Department:</strong> ${escapeHtml(topDept)}
          </div>
          <div style="margin-top: 0.5em;">
            <strong>Total Spendings:</strong> ${formatCurrency(totalSpending)}
          </div>
        </div>
      </div>
    `;
  }

  // Pagination state
  const PAGE_SIZE = 10;
  let currentPage = 1;

  // New state for completed page filters and sorting
  let completedFilterPriority = '';
  let completedFilterDepartment = '';
  let completedSortOrder = 'createdAt_desc';

  // New state for history page filters and sorting
  let historyFilterStatus = '';
  let historyFilterPriority = '';
  let historyFilterDepartment = '';
  let historySortOrder = 'createdAt_desc';

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

    // Update column headers with counts
    const recentHeader = document.querySelector('.board-column[data-status="recent"] h2');
    const queueHeader = document.querySelector('.board-column[data-status="queue"] h2');
    const inprogressHeader = document.querySelector('.board-column[data-status="inprogress"] h2');
    const completedHeader = document.querySelector('.board-column[data-status="completed"] h2');

    if (recentHeader) recentHeader.textContent = `Recent (${recentList.length})`;
    if (queueHeader) queueHeader.textContent = `Queue (${queueList.length})`;
    if (inprogressHeader) inprogressHeader.textContent = `In Progress (${inprogressList.length})`;
    if (completedHeader) completedHeader.textContent = `Completed (${completedList.length})`;

    recentList.forEach(i => recentColumn.appendChild(createIssueCard(i)));
    queueList.forEach(i => queueColumn.appendChild(createIssueCard(i)));
    inprogressList.forEach(i => inprogressColumn.appendChild(createIssueCard(i)));
    completedList.forEach(i => completedColumn.appendChild(createIssueCard(i)));
  }

  // Helper: apply filters and sorting to completed issues list
  function getFilteredSortedCompletedIssues() {
    let filtered = issues.filter(i => i.status === 'completed');

    if (completedFilterPriority) {
      filtered = filtered.filter(i => i.priority === completedFilterPriority);
    }
    if (completedFilterDepartment) {
      filtered = filtered.filter(i => i.department === completedFilterDepartment);
    }

    switch (completedSortOrder) {
      case 'createdAt_asc':
        filtered.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        break;
      case 'createdAt_desc':
        filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      case 'priority_asc':
        filtered.sort((a, b) => (PRIORITY_RANK[a.priority] || 0) - (PRIORITY_RANK[b.priority] || 0));
        break;
      case 'priority_desc':
        filtered.sort((a, b) => (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0));
        break;
      case 'votes_asc':
        filtered.sort((a, b) => (a.votes || 0) - (b.votes || 0));
        break;
      case 'votes_desc':
        filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        break;
      default:
        break;
    }

    return filtered;
  }

  // Helper: apply filters and sorting to history issues list
  function getFilteredSortedHistoryIssues() {
    let filtered = issues;

    if (historyFilterStatus) {
      filtered = filtered.filter(i => i.status === historyFilterStatus);
    }
    if (historyFilterPriority) {
      filtered = filtered.filter(i => i.priority === historyFilterPriority);
    }
    if (historyFilterDepartment) {
      filtered = filtered.filter(i => i.department === historyFilterDepartment);
    }

    switch (historySortOrder) {
      case 'createdAt_asc':
        filtered.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        break;
      case 'createdAt_desc':
        filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      case 'priority_asc':
        filtered.sort((a, b) => (PRIORITY_RANK[a.priority] || 0) - (PRIORITY_RANK[b.priority] || 0));
        break;
      case 'priority_desc':
        filtered.sort((a, b) => (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0));
        break;
      case 'votes_asc':
        filtered.sort((a, b) => (a.votes || 0) - (b.votes || 0));
        break;
      case 'votes_desc':
        filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        break;
      case 'status_asc':
        filtered.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
        break;
      case 'status_desc':
        filtered.sort((a, b) => (b.status || '').localeCompare(a.status || ''));
        break;
      default:
        break;
    }

    return filtered;
  }

  // Modified renderStatusPage to support filtering and sorting for completed page
  function renderStatusPage(status) {
    currentStatus = status;
    const containerId = status + 'Column';
    const container = document.getElementById(containerId);
    if (!container) return;

    let pagedIssues;
    let totalIssues;

    if (status === 'completed') {
      const filteredSorted = getFilteredSortedCompletedIssues();
      totalIssues = filteredSorted.length;
      const start = (currentPage - 1) * PAGE_SIZE;
      pagedIssues = filteredSorted.slice(start, start + PAGE_SIZE);
    } else {
      const allIssues = sortIssuesForColumn(issues, status);
      totalIssues = allIssues.length;
      const start = (currentPage - 1) * PAGE_SIZE;
      pagedIssues = allIssues.slice(start, start + PAGE_SIZE);
    }

    container.innerHTML = '';
    pagedIssues.forEach(issue => container.appendChild(createIssueCard(issue)));

    renderPaginationControls(totalIssues, currentPage, (newPage) => {
      currentPage = newPage;
      renderStatusPage(status);
    });
  }

  // Export filtered completed issues as CSV
  function exportCompletedIssues() {
    const data = getFilteredSortedCompletedIssues();
    if (!data.length) {
      notify('No data to export');
      return;
    }

    const headers = ['ID', 'Type', 'Description', 'Location', 'Latitude', 'Longitude', 'Votes', 'Priority', 'Status', 'Department', 'Expense', 'Created At'];
    const rows = data.map(issue => [
      issue.id,
      issue.type,
      issue.description.replace(/[\n\r]+/g, ' '),
      issue.location,
      issue.coordinates?.lat || '',
      issue.coordinates?.lng || '',
      issue.votes || 0,
      issue.priority,
      issue.status,
      issue.department,
      issue.expense || 0,
      new Date(issue.createdAt).toLocaleString()
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `completed_issues_${Date.now()}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Export filtered history issues as CSV
  function exportHistoryIssues() {
    const data = getFilteredSortedHistoryIssues();
    if (!data.length) {
      notify('No data to export');
      return;
    }

    const headers = ['ID', 'Type', 'Description', 'Location', 'Latitude', 'Longitude', 'Votes', 'Priority', 'Status', 'Department', 'Expense', 'Created At'];
    const rows = data.map(issue => [
      issue.id,
      issue.type,
      issue.description.replace(/[\n\r]+/g, ' '),
      issue.location,
      issue.coordinates?.lat || '',
      issue.coordinates?.lng || '',
      issue.votes || 0,
      issue.priority,
      issue.status,
      issue.department,
      issue.expense || 0,
      new Date(issue.createdAt).toLocaleString()
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `history_issues_${Date.now()}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Setup event listeners for completed page controls
  function setupCompletedPageControls() {
    const filterPriorityEl = document.getElementById('filterPriority');
    const filterDepartmentEl = document.getElementById('filterDepartment');
    const sortOrderEl = document.getElementById('sortOrder');
    const exportBtn = document.getElementById('exportBtn');

    if (filterPriorityEl) {
      filterPriorityEl.addEventListener('change', (e) => {
        completedFilterPriority = e.target.value;
        currentPage = 1;
        renderStatusPage('completed');
      });
    }
    if (filterDepartmentEl) {
      filterDepartmentEl.addEventListener('change', (e) => {
        completedFilterDepartment = e.target.value;
        currentPage = 1;
        renderStatusPage('completed');
      });
    }
    if (sortOrderEl) {
      sortOrderEl.addEventListener('change', (e) => {
        completedSortOrder = e.target.value;
        currentPage = 1;
        renderStatusPage('completed');
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportCompletedIssues();
      });
    }
  }

  // Setup event listeners for history page controls
  function setupHistoryPageControls() {
    const filterStatusEl = document.getElementById('filterStatus');
    const filterPriorityEl = document.getElementById('filterPriority');
    const filterDepartmentEl = document.getElementById('filterDepartment');
    const sortOrderEl = document.getElementById('sortOrder');
    const exportBtn = document.getElementById('exportBtn');

    if (filterStatusEl) {
      filterStatusEl.addEventListener('change', (e) => {
        historyFilterStatus = e.target.value;
        currentPage = 1;
        renderStatusPage('history');
      });
    }
    if (filterPriorityEl) {
      filterPriorityEl.addEventListener('change', (e) => {
        historyFilterPriority = e.target.value;
        currentPage = 1;
        renderStatusPage('history');
      });
    }
    if (filterDepartmentEl) {
      filterDepartmentEl.addEventListener('change', (e) => {
        historyFilterDepartment = e.target.value;
        currentPage = 1;
        renderStatusPage('history');
      });
    }
    if (sortOrderEl) {
      sortOrderEl.addEventListener('change', (e) => {
        historySortOrder = e.target.value;
        currentPage = 1;
        renderStatusPage('history');
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportHistoryIssues();
      });
    }
  }

  // Call setupCompletedPageControls during init if on completed page
  const originalInit = init;
  init = function() {
    originalInit();
    if (getCurrentPageType() === 'completed') {
      setupCompletedPageControls();
    }
    if (getCurrentPageType() === 'history') {
      setupHistoryPageControls();
    }
  };

  function renderPaginationControls(totalItems, page, onPageChange) {
    const container = document.getElementById('paginationControls');
    if (!container) return;
    container.innerHTML = '';

    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = page <= 1;
    prevBtn.addEventListener('click', () => onPageChange(page - 1));
    container.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = `Page ${page} of ${totalPages}`;
    container.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.disabled = page >= totalPages;
    nextBtn.addEventListener('click', () => onPageChange(page + 1));
    container.appendChild(nextBtn);
  }

  // Render issues for a specific status page with pagination
  function renderStatusPage(status) {
    currentStatus = status;
    const containerId = status + 'Column';
    const container = document.getElementById(containerId);
    if (!container) return;

    let pagedIssues;
    let totalIssues;

    if (status === 'completed') {
      const filteredSorted = getFilteredSortedCompletedIssues();
      totalIssues = filteredSorted.length;
      const start = (currentPage - 1) * PAGE_SIZE;
      pagedIssues = filteredSorted.slice(start, start + PAGE_SIZE);
    } else if (status === 'history') {
      const filteredSorted = getFilteredSortedHistoryIssues();
      totalIssues = filteredSorted.length;
      const start = (currentPage - 1) * PAGE_SIZE;
      pagedIssues = filteredSorted.slice(start, start + PAGE_SIZE);
    } else {
      const allIssues = sortIssuesForColumn(issues, status);
      totalIssues = allIssues.length;
      const start = (currentPage - 1) * PAGE_SIZE;
      pagedIssues = allIssues.slice(start, start + PAGE_SIZE);
    }

    container.innerHTML = '';
    pagedIssues.forEach(issue => container.appendChild(createIssueCard(issue)));

    renderPaginationControls(totalIssues, currentPage, (newPage) => {
      currentPage = newPage;
      renderStatusPage(status);
    });
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
    const canVote = role === 'citizen' && ['recent', 'queue', 'inprogress'].includes(issue.status) && !hasVoted;

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
      ${role === 'citizen' ? `<div style="font-size:0.85em; color:#444; margin-top:0.4rem;">Department: ${escapeHtml(issue.department)} • Est. Cost: ${formatCurrency(issue.expense)}</div>` : ''}
      ${issue.photo ? `<img class="photo" src="${issue.photo}" alt="Photo of ${escapeHtml(issue.type)} at ${escapeHtml(issue.location)}">` : ''}
      <div class="card-controls" style="margin-top:0.6rem; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        ${role === 'citizen' && ['recent', 'queue', 'inprogress'].includes(issue.status) ? `<button class="btn-upvote" data-id="${issue.id}" ${hasVoted ? 'disabled' : ''} aria-pressed="${hasVoted ? 'true' : 'false'}">${hasVoted ? 'Voted ✓' : 'Upvote'}</button>` : ''}
        ${role === 'admin' ? `
          <select class="priority-select" data-issue-id="${issue.id}" aria-label="Change priority" ${issue.status === 'completed' ? 'disabled' : ''}>
            <option value="low" ${issue.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${issue.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="immediate" ${issue.priority === 'immediate' ? 'selected' : ''}>Immediate</option>
            <option value="urgent" ${issue.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
          </select>
          <button class="advance-status" data-issue-id="${issue.id}" ${issue.status === 'completed' ? 'disabled' : ''}>${issue.status === 'completed' ? 'Completed' : 'Advance Status'}</button>
          <button class="revert-status" data-issue-id="${issue.id}" ${issue.status === 'recent' || issue.status === 'completed' ? 'disabled' : ''}>Revert Status</button>
          <button class="delete-issue" data-issue-id="${issue.id}">Delete Issue</button>
          <select class="dept-select" data-issue-id="${issue.id}" aria-label="Change department" ${issue.status === 'completed' ? 'disabled' : ''}>
            ${DEPARTMENTS.map(dept => `<option value="${dept}" ${issue.department === dept ? 'selected' : ''}>${dept}</option>`).join('')}
          </select>
          <input type="number" class="expense-input" data-issue-id="${issue.id}" value="${issue.expense || 0}" aria-label="Change expense" style="width:80px;" ${issue.status === 'completed' ? 'disabled' : ''}>
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
    const completedIssues = issues.filter(i => i.status === 'completed');
    const completedCount = completedIssues.length;
    const totalSpending = completedIssues.reduce((s, it) => s + (it.expense || 0), 0);
    const deptCounts = {};
    completedIssues.forEach(issue => {
      deptCounts[issue.department] = (deptCounts[issue.department] || 0) + 1;
    });
    const topDept = Object.keys(deptCounts).length > 0 ? Object.entries(deptCounts).sort((a,b)=>b[1]-a[1])[0][0] : 'None';
    const priorityCounts = { low: 0, medium: 0, immediate: 0, urgent: 0 };
    completedIssues.forEach(issue => {
      priorityCounts[issue.priority] = (priorityCounts[issue.priority] || 0) + 1;
    });

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
        <div style="background:#f0f8ff; padding:1em; border-radius:6px;">
          <strong>Issues Solved by Priority</strong><br>
          <small>Low: ${priorityCounts.low}, Medium: ${priorityCounts.medium}, Immediate: ${priorityCounts.immediate}, Urgent: ${priorityCounts.urgent}</small>
        </div>
      </div>
    `;
  }

  /* ===========================
     Modal Functions
     =========================== */
  let currentOpenModalStatus = null;

  function openModal(status) {
    const modal = document.getElementById(`modal-${status}`);
    if (!modal) return;
    currentOpenModalStatus = status;
    renderModalContent(status);
    modal.style.display = 'block';
  }

  function closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.style.display = 'none');
    currentOpenModalStatus = null;
  }

  function renderModalContent(status) {
    const body = document.getElementById(`modal-${status}-body`);
    if (!body) return;
    body.innerHTML = '';
    const filteredIssues = sortIssuesForColumn(issues, status);
    filteredIssues.forEach(issue => {
      body.appendChild(createIssueCard(issue));
    });
  }

  // Make functions global
  window.openModal = openModal;
  window.closeModal = closeModal;

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
        if (photoFile.size > 5 * 1024 * 1024) {
          statusEl.textContent = 'Photo file size must be less than 5MB.';
          return;
        }
        // Resize image before upload
        const resizedFile = await resizeImageFile(photoFile, 800, 600, 0.8);
        photo_url = await window.dataService.uploadPhotoIfNeeded(resizedFile);
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

  // Resize image file utility
  async function resizeImageFile(file, maxWidth, maxHeight, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const resizedFile = new File([blob], file.name, { type: file.type });
                resolve(resizedFile);
              } else {
                reject(new Error('Canvas is empty'));
              }
            },
            file.type,
            quality
          );
        };
        img.onerror = (err) => reject(err);
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // Upvote (citizen)
  async function handleUpvote(issueId) {
    const issue = findIssueById(issueId);
    if (!issue) return;
    if (!['recent', 'queue', 'inprogress'].includes(issue.status)) return;
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
    if (issue.status === 'completed') return;
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

  // Admin: revert status
  async function handleRevert(issueId) {
    const issue = findIssueById(issueId);
    if (!issue) return;
    if (issue.status === 'completed') return;
    const idx = STATUS_ORDER.indexOf(issue.status);
    if (idx <= 0) return;
    const prev = STATUS_ORDER[idx - 1];
    try {
      await window.dataService.updateIssue(issueId, { status: prev });
    } catch (e) {
      console.error('Status revert failed', e);
      notify('Failed to revert status');
    }
  }

  // Admin: delete issue
  async function handleDelete(issueId) {
    if (!confirm('Are you sure you want to delete this issue?')) return;
    try {
      await window.dataService.deleteIssue(issueId);
      await refreshIssuesFromServer();
      notify('Issue deleted successfully');
    } catch (e) {
      console.error('Delete failed', e);
      notify('Failed to delete issue');
    }
  }

  // Admin: change department
  async function handleDeptChange(issueId, newDept) {
    const issue = findIssueById(issueId);
    if (!issue) return;
    if (issue.status === 'completed') return;
    if (issue.department === newDept) return;
    try {
      await window.dataService.updateIssue(issueId, { department: newDept });
    } catch (e) {
      console.error('Department update failed', e);
      notify('Failed to update department');
    }
  }

  // Admin: change expense
  async function handleExpenseChange(issueId, newExpense) {
    const issue = findIssueById(issueId);
    if (!issue) return;
    if (issue.status === 'completed') return;
    const num = parseFloat(newExpense) || 0;
    if (issue.expense === num) return;
    try {
      await window.dataService.updateIssue(issueId, { expense: num });
    } catch (e) {
      console.error('Expense update failed', e);
      notify('Failed to update expense');
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
    const rev = e.target.closest('.revert-status');
    if (rev) {
      const id = rev.getAttribute('data-issue-id');
      handleRevert(id);
      return;
    }
    const del = e.target.closest('.delete-issue');
    if (del) {
      const id = del.getAttribute('data-issue-id');
      handleDelete(id);
      return;
    }
  }

  function globalChangeHandler(e) {
    const sel = e.target.closest('.priority-select');
    if (sel) {
      const id = sel.getAttribute('data-issue-id');
      handlePriorityChange(id, sel.value);
      return;
    }
    const deptSel = e.target.closest('.dept-select');
    if (deptSel) {
      const id = deptSel.getAttribute('data-issue-id');
      handleDeptChange(id, deptSel.value);
      return;
    }
    const expInp = e.target.closest('.expense-input');
    if (expInp) {
      const id = expInp.getAttribute('data-issue-id');
      handleExpenseChange(id, expInp.value);
      return;
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
      logoutBtn.addEventListener('click', async () => {
        clearTimeout(inactivityTimer);
        try {
          await window.dataService.logLogout(username);
        } catch (error) {
          console.error('Failed to log logout:', error);
        }
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

    // Initialize inactivity timer and event listeners
    resetInactivityTimer();
    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('keydown', resetInactivityTimer);
    document.addEventListener('click', resetInactivityTimer);
    document.addEventListener('scroll', resetInactivityTimer);
  }

  // Clean up
  window.addEventListener('beforeunload', async () => {
    if (username) {
      try {
        await window.dataService.logLogout(username);
      } catch (e) {
        console.error('Failed to log logout on close:', e);
      }
    }
    stopRealtime();
  });

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
