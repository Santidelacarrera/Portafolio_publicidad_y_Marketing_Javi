/**
 * Lógica de la vista pública: galería, filtro, modal y footer.
 * También registra visitas y tiempo de permanencia para el módulo
 * de estadísticas del panel admin.
 */

let ALL_PROJECTS = [];
let sessionStart = Date.now();

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("footer-year").textContent = new Date().getFullYear();

  loadProjects();
  loadSiteSettings();
  registerVisit();
  bindModalEvents();
  bindFilterEvents();
  trackSessionDuration();
});

/** Convierte un link de YouTube/Canva en su URL embebible */
function toEmbedUrl(url) {
  if (!url) return url;
  const ytMatch = url.match(/(?:youtu\.be\/|watch\?v=)([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  if (url.includes("canva.com") && !url.includes("/watch")) return `${url}${url.includes("?") ? "&" : "?"}embed`;
  return url;
}

async function loadProjects() {
  const loading = document.getElementById("loading-state");
  const empty = document.getElementById("empty-state");
  const grid = document.getElementById("projects-grid");

  const { data, error } = await supabaseClient
    .from(TABLES.PROJECTS)
    .select("*")
    .order("created_at", { ascending: false });

  loading.classList.add("hidden");

  if (error) {
    console.error("Error cargando proyectos:", error);
    empty.textContent = "Ocurrió un error al cargar los proyectos.";
    empty.classList.remove("hidden");
    return;
  }

  ALL_PROJECTS = data || [];

  if (ALL_PROJECTS.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  populateCategoryFilter(ALL_PROJECTS);
  renderProjects(ALL_PROJECTS);

  // Suscripción en tiempo real a cambios en la tabla de proyectos
  supabaseClient
    .channel("public:projects")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.PROJECTS }, () => {
      loadProjects();
    })
    .subscribe();
}

function populateCategoryFilter(projects) {
  const select = document.getElementById("category-filter");
  const categories = [...new Set(projects.map((p) => p.category).filter(Boolean))];
  select.innerHTML = `<option value="">Todas las categorías</option>` +
    categories.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function bindFilterEvents() {
  document.getElementById("category-filter").addEventListener("change", (e) => {
    const category = e.target.value;
    const filtered = category ? ALL_PROJECTS.filter((p) => p.category === category) : ALL_PROJECTS;
    renderProjects(filtered);
  });
}

function renderProjects(projects) {
  const grid = document.getElementById("projects-grid");
  const empty = document.getElementById("empty-state");

  if (projects.length === 0) {
    grid.innerHTML = "";
    empty.textContent = "No hay proyectos en esta categoría.";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  grid.innerHTML = projects.map((p) => {
    const cover = p.images && p.images.length > 0
      ? `<img src="${p.images[0]}" alt="${p.title}" class="w-full h-48 object-cover rounded-t-2xl" />`
      : `<div class="w-full h-48 rounded-t-2xl bg-gradient-to-br from-brand-light/30 to-brand/20 flex items-center justify-center text-brand font-display font-bold text-xl">
           ${p.title.charAt(0).toUpperCase()}
         </div>`;

    return `
      <article class="project-card bg-white rounded-2xl shadow-sm border border-pink-50 overflow-hidden cursor-pointer"
        data-id="${p.id}">
        ${cover}
        <div class="p-5">
          <span class="tag">${p.category || "General"}</span>
          <h4 class="mt-2 font-display font-bold text-lg text-ink line-clamp-1">${p.title}</h4>
          <p class="mt-1 text-sm text-gray-500 line-clamp-2">${p.description || ""}</p>
          <p class="mt-3 text-xs text-gray-400">👁 ${p.views || 0} vistas</p>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", () => openProjectModal(card.dataset.id));
  });
}

function bindModalEvents() {
  document.getElementById("modal-close").addEventListener("click", closeProjectModal);
  document.getElementById("modal-backdrop").addEventListener("click", closeProjectModal);
}

async function openProjectModal(id) {
  const project = ALL_PROJECTS.find((p) => p.id === id);
  if (!project) return;

  const modal = document.getElementById("project-modal");
  const content = document.getElementById("modal-content");

  const imagesHtml = (project.images || [])
    .map((url) => `<img src="${url}" class="w-full rounded-xl mb-3 object-cover max-h-96" />`)
    .join("");

  const videosHtml = (project.videos || [])
    .map((url) => `
      <div class="mb-3 aspect-video">
        <iframe src="${toEmbedUrl(url)}" class="w-full h-full rounded-xl" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
      </div>`)
    .join("");

  const audiosHtml = (project.audios || [])
    .map((url) => `<audio controls class="w-full mb-3"><source src="${url}" /></audio>`)
    .join("");

  const linksHtml = (project.links || [])
    .map((url) => `<a href="${url}" target="_blank" rel="noopener" class="text-brand underline text-sm block mb-1">${url}</a>`)
    .join("");

  content.innerHTML = `
    <span class="tag">${project.category || "General"}</span>
    <h3 class="font-display font-extrabold text-2xl mt-2 mb-3 text-ink">${project.title}</h3>
    <p class="text-gray-600 whitespace-pre-line mb-6">${project.description || ""}</p>
    ${imagesHtml}
    ${videosHtml}
    ${audiosHtml}
    ${linksHtml ? `<div class="mt-4 pt-4 border-t border-gray-100">${linksHtml}</div>` : ""}
  `;

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Incrementar contador de vistas del proyecto (no bloqueante)
  supabaseClient.rpc("increment_project_views", { project_id: id }).then(({ error }) => {
    if (error) console.warn("No se pudo registrar la vista:", error.message);
  });
}

function closeProjectModal() {
  document.getElementById("project-modal").classList.add("hidden");
  document.body.style.overflow = "";
}

async function loadSiteSettings() {
  const { data, error } = await supabaseClient
    .from(TABLES.CONTACT)
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) return;

  const igLink = document.getElementById("footer-instagram");
  const emailLink = document.getElementById("footer-email");

  if (data.instagram_url) igLink.href = data.instagram_url;
  if (data.contact_email) emailLink.href = `mailto:${data.contact_email}`;
}

/** Registra una visita al cargar la página (para estadísticas del admin) */
async function registerVisit() {
  try {
    await supabaseClient.from(TABLES.STATS_VISITS).insert({});
  } catch (err) {
    console.warn("No se pudo registrar la visita:", err);
  }
}

/** Registra el tiempo de permanencia al salir/cerrar la pestaña */
function trackSessionDuration() {
  let sent = false;

  const sendDuration = () => {
    if (sent) return;
    const seconds = Math.round((Date.now() - sessionStart) / 1000);
    if (seconds < 1) return;
    sent = true;

    // sendBeacon no permite headers custom, así que usamos fetch con
    // keepalive:true, que sí sigue funcionando aunque la pestaña se cierre.
    fetch(`${SUPABASE_CONFIG.URL}/rest/v1/${TABLES.STATS_TIME}`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_CONFIG.ANON_KEY,
        Authorization: `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
      },
      body: JSON.stringify({ duration_seconds: seconds }),
    }).catch(() => {});
  };

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sendDuration();
  });
  window.addEventListener("pagehide", sendDuration);
}
