document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorElement = document.getElementById("login-error");
  errorElement.textContent = "";
  try {
    await loginWithEmail(document.getElementById("email").value, document.getElementById("password").value);
    location.replace("admin.html");
  } catch {
    errorElement.textContent = "No fue posible iniciar sesión. Revisa tus datos.";
  }
});

getCurrentSession().then((session) => {
  if (session) location.replace("admin.html");
});
