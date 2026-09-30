const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value, max) => typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) : "";

export default async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try { body = await request.json(); }
  catch { return new Response("Invalid request", { status: 400 }); }

  if (body["bot-field"] || body.company) return new Response(null, { status: 204 });

  const name = clean(body.name, 100);
  const email = clean(body.email, 254).toLowerCase();
  const message = clean(body.message, 2000);
  if (!name || !emailPattern.test(email) || !message || body.privacy_consent !== "on") {
    return new Response("Invalid request", { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("Service unavailable", { status: 503 });

  try {
    const response = await fetch(`${url}/rest/v1/contact_messages`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ name, email, message }),
    });
    if (!response.ok) throw new Error("Database rejected request");
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Contact message storage failed", { message: error.message });
    return new Response("Unable to process request", { status: 502 });
  }
};
