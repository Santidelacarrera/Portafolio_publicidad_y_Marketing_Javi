async function loginWithEmail(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  return data;
}
async function logout() { await supabaseClient.auth.signOut(); }
async function getCurrentSession() { const { data } = await supabaseClient.auth.getSession(); return data.session; }
async function requireAuth() { const session = await getCurrentSession(); if (!session) window.location.replace("login.html"); return session; }
