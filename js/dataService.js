 
const SUPABASE_BUCKET = 'issue-photos';

function mapDbIssueToClient(issueRow, userVotedIssues, username) { // raw database row (issueRow) to a format that the frontend can use directly.
  const votedBy = userVotedIssues.has(issueRow.id) ? [username] : [];
  const voteCount = issueRow.votes?.[0]?.count || 0;
  return {
    id: issueRow.id,
    type: issueRow.type,
    description: issueRow.description,
    location: issueRow.location,
    coordinates: { lat: issueRow.latitude, lng: issueRow.longitude },
    photo: issueRow.photo_url || '',
    votes: voteCount,
    priority: issueRow.priority,
    status: issueRow.status,
    department: issueRow.department || '',
    expense: issueRow.expense || 0,
    createdAt: new Date(issueRow.created_at).getTime(),
    votedBy
  };
}

async function fetchAllIssuesWithVotes(username) {
  const sb = getSupabase();
  const [issuesRes, votesRes] = await Promise.all([
    sb.from('issues').select('*').order('created_at', { ascending: false }),
    sb.from('votes').select('issue_id').eq('user_name', username)
  ]);
  if (issuesRes.error) throw issuesRes.error;
  if (votesRes.error) throw votesRes.error;

  const userVotedIssues = new Set(votesRes.data.map(v => v.issue_id));

  const result = (issuesRes.data || []).map(row => mapDbIssueToClient(row, userVotedIssues, username));

  return result;
}

async function uploadPhotoIfNeeded(file) { // Uploading photos to Supabase Storage
  if (!file || !file.size) return '';
  const sb = getSupabase();
  const fileExt = (file.name && file.name.split('.').pop()) || 'jpg';
  const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const { error } = await sb.storage.from(SUPABASE_BUCKET).upload(filePath, file, { upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(SUPABASE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function createIssue(payload) {
  const sb = getSupabase();
  const { data, error } = await sb.from('issues').insert([payload]).select('*').single();
  if (error) throw error;
  return data;
}

async function addVote(issueId, userName) {
  const sb = getSupabase();
  // Prevent duplicate by checking existing
  const existing = await sb.from('votes').select('*', { count: 'exact', head: true })
    .eq('issue_id', issueId).eq('user_name', userName);
  if (existing.error) throw existing.error;
  if ((existing.count || 0) > 0) return { already: true };
  const { error } = await sb.from('votes').insert([{ issue_id: issueId, user_name: userName }]);
  if (error) throw error;
  return { ok: true };
}

async function updateIssue(issueId, fields) {
  const sb = getSupabase();
  const { error } = await sb.from('issues').update(fields).eq('id', issueId);
  if (error) throw error;
}

async function deleteIssue(issueId) {
  const sb = getSupabase();
  const { error } = await sb.from('issues').delete().eq('id', issueId);
  if (error) throw error;
}

async function logLogin(username, role) {
  const sb = getSupabase();
  // Insert new login record
  const { error } = await sb.from('login_logs').insert([{ username, role }]);
  if (error) throw error;
}

async function logLogout(username) {
  const sb = getSupabase();
  // Update the latest active login record to set logged_out_at
  const { data: activeLogins, error: fetchError } = await sb
    .from('login_logs')
    .select('*')
    .eq('username', username)
    .is('logged_out_at', null)
    .order('timestamp', { ascending: false })
  if (fetchError) throw fetchError;
  if (activeLogins && activeLogins.length > 0) {
    const { error } = await sb
      .from('login_logs')
      .update({ logged_out_at: new Date().toISOString() })
      .eq('id', activeLogins[0].id);
    if (error) throw error;
  }
}

async function registerUser(username, email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        username: username,
        role: 'citizen'
      }
    }
  });
  if (error) throw error;
  return data;
}

function subscribeRealtime(onChange) {
  const sb = getSupabase();
  const channel = sb.channel('issues-and-votes');
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, onChange);
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, onChange);
  channel.subscribe();
  return () => sb.removeChannel(channel);
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


