 
// Local storage keys
const ISSUES_KEY = 'issues';
const VOTES_KEY = 'votes';
const LOGIN_LOGS_KEY = 'loginLogs';
const USERS_KEY = 'users';

function getStoredData(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function setStoredData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function mapIssueToClient(issue, userVotedIssues, username) {
  const votedBy = userVotedIssues.has(issue.id) ? [username] : [];
  const voteCount = userVotedIssues.has(issue.id) ? 1 : 0; // Simplified, assuming one vote per user
  return {
    id: issue.id,
    type: issue.type,
    description: issue.description,
    location: issue.location,
    coordinates: { lat: issue.latitude, lng: issue.longitude },
    photo: issue.photo_url || '',
    votes: voteCount,
    priority: issue.priority,
    status: issue.status,
    department: issue.department || '',
    expense: issue.expense || 0,
    createdAt: issue.created_at,
    votedBy
  };
}

async function fetchAllIssuesWithVotes(username) {
  const issues = getStoredData(ISSUES_KEY);
  const votes = getStoredData(VOTES_KEY);
  const userVotedIssues = new Set(votes.filter(v => v.user_name === username).map(v => v.issue_id));

  const result = issues.map(issue => mapIssueToClient(issue, userVotedIssues, username));
  return result;
}

async function uploadPhotoIfNeeded(file) {
  if (!file || !file.size) return '';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function createIssue(payload) {
  const issues = getStoredData(ISSUES_KEY);
  const newIssue = { ...payload, id: Date.now().toString(), created_at: Date.now() };
  issues.push(newIssue);
  setStoredData(ISSUES_KEY, issues);
  return newIssue;
}

async function addVote(issueId, userName) {
  const votes = getStoredData(VOTES_KEY);
  const existing = votes.find(v => v.issue_id === issueId && v.user_name === userName);
  if (existing) return { already: true };
  votes.push({ issue_id: issueId, user_name: userName });
  setStoredData(VOTES_KEY, votes);
  return { ok: true };
}

async function updateIssue(issueId, fields) {
  const issues = getStoredData(ISSUES_KEY);
  const index = issues.findIndex(i => i.id === issueId);
  if (index !== -1) {
    issues[index] = { ...issues[index], ...fields };
    setStoredData(ISSUES_KEY, issues);
  }
}

async function deleteIssue(issueId) {
  let issues = getStoredData(ISSUES_KEY);
  issues = issues.filter(i => i.id !== issueId);
  setStoredData(ISSUES_KEY, issues);

  let votes = getStoredData(VOTES_KEY);
  votes = votes.filter(v => v.issue_id !== issueId);
  setStoredData(VOTES_KEY, votes);
}

async function logLogin(username, role) {
  const logs = getStoredData(LOGIN_LOGS_KEY);
  logs.push({ username, role, timestamp: new Date().toISOString() });
  setStoredData(LOGIN_LOGS_KEY, logs);
}

async function logLogout(username) {
  const logs = getStoredData(LOGIN_LOGS_KEY);
  const activeLogins = logs.filter(l => l.username === username && !l.logged_out_at);
  if (activeLogins.length > 0) {
    activeLogins[activeLogins.length - 1].logged_out_at = new Date().toISOString();
    setStoredData(LOGIN_LOGS_KEY, logs);
  }
}

async function registerUser(username, email, password, district, town) {
  const users = getStoredData(USERS_KEY);
  const existing = users.find(u => u.username === username || u.email === email);
  if (existing) throw new Error('User already exists');
  const newUser = { username, email, password, district, town, role: 'citizen' };
  users.push(newUser);
  setStoredData(USERS_KEY, users);
  return newUser;
}

function subscribeRealtime(onChange) {
  // No-op for local storage
  return () => {};
}

window.dataService = {
  fetchAllIssuesWithVotes,
  uploadPhotoIfNeeded,
  createIssue,
  addVote,
  updateIssue,
  deleteIssue,
  logLogin,
  logLogout,
  registerUser,
  subscribeRealtime
};


