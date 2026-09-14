/**
 * Autenticación del panel admin usando Supabase Auth.
 * Los usuarios reales viven en Supabase Auth con un email real;
 * aquí sólo mapeamos el "usuario" visible (Admin / Javi) a ese email.
 *
 * Debes crear estos usuarios en Supabase Dashboard > Authentication > Users:
 *   Admin  -> santiagodelacarrera2018@gmail.com  / d852401S
 *   Javi   -> Jgurruchagaz@icloud.com             / Javiera2005@
 */
const USERNAME_TO_EMAIL = {
  admin: "santiagodelacarrera2018@gmail.com",
  javi: "Jgurruchagaz@icloud.com",
};

async function loginWithUsername(username, password) {
  const email = USERNAME_TO_EMAIL[username.trim().toLowerCase()];
  if (!email) {
    throw new Error("Usuario no reconocido.");
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

async function logout() {
  await supabaseClient.auth.signOut();
}

async function getCurrentSession() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}

/** Redirige a login.html si no hay sesión activa. Usar en admin.html */
async function requireAuth() {
  const session = await getCurrentSession();
  if (!session) {
    window.location.href = "login.html";
  }
  return session;
}
