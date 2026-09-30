const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value, max) => typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) : "";
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const supabaseHeaders = (key) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

async function saveMessage(url, key, message) {
  const response = await fetch(`${url}/rest/v1/contact_messages`, {
    method: "POST", headers: { ...supabaseHeaders(key), Prefer: "return=minimal" }, body: JSON.stringify(message),
  });
  if (!response.ok) throw new Error("Database rejected request");
}

async function contactRecipient(url, key) {
  const response = await fetch(`${url}/rest/v1/site_settings?id=eq.1&select=contact_email&limit=1`, { headers: supabaseHeaders(key) });
  if (!response.ok) throw new Error("Could not load contact settings");
  const [settings] = await response.json();
  const recipient = clean(settings?.contact_email, 254).toLowerCase();
  return emailPattern.test(recipient) ? recipient : "";
}

async function sendNotification({ recipient, name, email, message }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = clean(process.env.RESEND_FROM_EMAIL, 320);
  if (!apiKey || !from || !recipient) return false;
  const receivedAt = new Date().toISOString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [recipient], reply_to: email, subject: `Nuevo contacto: ${name}`,
      text: `Nuevo mensaje de contacto\n\nNombre: ${name}\nEmail: ${email}\nFecha: ${receivedAt}\n\nMensaje:\n${message}`,
      html: `<h1>Nuevo mensaje de contacto</h1><p><strong>Nombre:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Fecha:</strong> ${escapeHtml(receivedAt)}</p><p><strong>Mensaje:</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend rejected request (${response.status})`);
  return true;
}

export default async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid request", { status: 400 }); }
  if (body.company) return new Response(null, { status: 204 });

  const name = clean(body.name, 100);
  const email = clean(body.email, 254).toLowerCase();
  const message = clean(body.message, 2000);
  if (!name || !emailPattern.test(email) || !message || body.privacy_consent !== "on") return new Response("Invalid request", { status: 400 });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("Service unavailable", { status: 503 });
  try { await saveMessage(url, key, { name, email, message }); }
  catch (error) { console.error("Contact message storage failed", { message: error.message }); return new Response("Unable to process request", { status: 502 }); }

  try {
    const recipient = await contactRecipient(url, key);
    if (!await sendNotification({ recipient, name, email, message })) {
      console.error("Contact notification skipped: recipient or Resend configuration unavailable");
      return new Response("Message saved; notification pending", { status: 202 });
    }
  } catch (error) {
    console.error("Contact notification failed", { message: error.message });
    return new Response("Message saved; notification pending", { status: 202 });
  }
  return new Response(null, { status: 204 });
};