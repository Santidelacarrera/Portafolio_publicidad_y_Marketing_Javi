/**
 * Lógica del panel de administración:
 *  - Protección de ruta (requiere sesión)
 *  - CRUD de proyectos (con subida de archivos a Storage)
 *  - Módulo de estadísticas
 *  - Configuración de contacto (footer)
 */

let editingProjectId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth();
  if (!session) return;

  document.getElementById("current-user").textContent = session.user.email;

  bindTabs();
  bindLogout();
  bindProjectModal();
  bindSettingsForm();

  loadAdminProjects();
  loadStats();
  loadSettingsIntoForm();
});

/* ============================================================
 *  TABS
 * ============================================================ */
function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active-tab"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
      btn.classList.add("active-tab");
      document.getElementById(btn.dataset.tab).classList.remove("hidden");
      if (btn.dataset.tab === "tab-stats") loadStats();
    });
  });
}

function bindLogout() {
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await logout();
    window.location.href = "login.html";
  });
}

/* ============================================================
 *  GESTOR DE PROYECTOS
 * ============================================================ */
async function loadAdminProjects() {
  const list = document.getElementById("admin-projects-list");
  const { data, error } = await supabaseClient
    .from(TABLES.PROJECTS)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<p class="text-red-600 text-sm">Error al cargar proyectos: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<p class="text-gray-400 text-sm">Aún no creaste ningún proyecto.</p>`;
    return;
  }

  list.innerHTML = data.map((p) => `
    <div class="bg-white rounded-2xl border border-pink-50 p-4 flex gap-4">
      ${p.images && p.images[0]
        ? `<img src="${p.images[0]}" class="w-20 h-20 rounded-xl object-cover flex-shrink-0" />`
        : `<div class="w-20 h-20 rounded-xl bg-pink-50 flex-shrink-0"></div>`}
      <div class="flex-1 min-w-0">
        <p class="tag">${p.category || "General"}</p>
        <h4 class="font-semibold text-ink truncate">${p.title}</h4>
        <p class="text-xs text-gray-400 mt-1">👁 ${p.views || 0} vistas</p>
        <div class="flex gap-3 mt-2">
          <button class="text-xs font-semibold text-brand hover:underline" onclick="editProject('${p.id}')">Editar</button>
          <button class="text-xs font-semibold text-red-500 hover:underline" onclick="deleteProject('${p.id}')">Eliminar</button>
        </div>
      </div>
    </div>
  `).join("");
}

function bindProjectModal() {
  document.getElementById("new-project-btn").addEventListener("click", () => openProjectForm());
  document.getElementById("project-form-close").addEventListener("click", closeProjectForm);
  document.getElementById("project-form-backdrop").addEventListener("click", closeProjectForm);
  document.getElementById("project-form-cancel").addEventListener("click", closeProjectForm);
  document.getElementById("project-form").addEventListener("submit", handleProjectSubmit);
}

function openProjectForm(project = null) {
  editingProjectId = project?.id || null;
  document.getElementById("project-form-title").textContent = project ? "Editar proyecto" : "Nuevo proyecto";
  document.getElementById("project-id").value = project?.id || "";
  document.getElementById("project-title").value = project?.title || "";
  document.getElementById("project-description").value = project?.description || "";
  document.getElementById("project-category").value = project?.category || "";
  document.getElementById("project-videos-embed").value = (project?.videos || []).join("\n");
  document.getElementById("project-links").value = (project?.links || []).join(", ");
  document.getElementById("project-form-error").classList.add("hidden");
  document.getElementById("project-form-progress").classList.add("hidden");
  document.getElementById("project-form-modal").classList.remove("hidden");
}

function closeProjectForm() {
  document.getElementById("project-form-modal").classList.add("hidden");
  document.getElementById("project-form").reset();
  editingProjectId = null;
}

async function editProject(id) {
  const { data, error } = await supabaseClient.from(TABLES.PROJECTS).select("*").eq("id", id).single();
  if (error) {
    alert("No se pudo cargar el proyecto: " + error.message);
    return;
  }
  openProjectForm(data);
}

async function deleteProject(id) {
  if (!confirm("¿Eliminar este proyecto? Esta acción no se puede deshacer.")) return;

  const { error } = await supabaseClient.from(TABLES.PROJECTS).delete().eq("id", id);
  if (error) {
    alert("Error al eliminar: " + error.message);
    return;
  }
  loadAdminProjects();
}

async function handleProjectSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("project-form-submit");
  const errorEl = document.getElementById("project-form-error");
  const progressEl = document.getElementById("project-form-progress");
  errorEl.classList.add("hidden");

  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando...";

  try {
    const title = document.getElementById("project-title").value.trim();
    const description = document.getElementById("project-description").value.trim();
    const category = document.getElementById("project-category").value.trim();

    const imageFiles = Array.from(document.getElementById("project-images-file").files);
    const videoFiles = Array.from(document.getElementById("project-videos-file").files);
    const audioFiles = Array.from(document.getElementById("project-audios-file").files);

    const embedVideos = document.getElementById("project-videos-embed").value
      .split("\n").map((s) => s.trim()).filter(Boolean);
    const links = document.getElementById("project-links").value
      .split(",").map((s) => s.trim()).filter(Boolean);

    // Subida de archivos a Supabase Storage
    progressEl.textContent = "Subiendo archivos multimedia...";
    progressEl.classList.remove("hidden");

    const uploadedImages = await Promise.all(imageFiles.map((f) => uploadFileToStorage(f, "images")));
    const uploadedVideos = await Promise.all(videoFiles.map((f) => uploadFileToStorage(f, "videos")));
    const uploadedAudios = await Promise.all(audioFiles.map((f) => uploadFileToStorage(f, "audios")));

    progressEl.textContent = "Guardando proyecto en la base de datos...";

    // Si estamos editando, conservamos los archivos previos y agregamos los nuevos
    let existingImages = [], existingVideos = [], existingAudios = [];
    if (editingProjectId) {
      const { data: existing } = await supabaseClient
        .from(TABLES.PROJECTS).select("images, videos, audios").eq("id", editingProjectId).single();
      if (existing) {
        existingImages = existing.images || [];
        existingVideos = existing.videos || [];
        existingAudios = existing.audios || [];
      }
    }

    const payload = {
      title,
      description,
      category,
      images: [...existingImages, ...uploadedImages],
      // El campo de embeds se reescribe completo desde el textarea en cada guardado;
      // los archivos de video subidos se agregan a lo ya existente.
      videos: [...embedVideos, ...existingVideos, ...uploadedVideos],
      audios: [...existingAudios, ...uploadedAudios],
      links,
    };

    let dbError;
    if (editingProjectId) {
      const { error } = await supabaseClient.from(TABLES.PROJECTS).update(payload).eq("id", editingProjectId);
      dbError = error;
    } else {
      const { error } = await supabaseClient.from(TABLES.PROJECTS).insert(payload);
      dbError = error;
    }

    if (dbError) throw dbError;

    closeProjectForm();
    loadAdminProjects();
  } catch (err) {
    errorEl.textContent = "Error: " + err.message;
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar proyecto";
    progressEl.classList.add("hidden");
  }
}

/* ============================================================
 *  ESTADÍSTICAS
 * ============================================================ */
async function loadStats() {
  const [{ count: visitsCount }, { data: durations }, { count: projectsCount }, { data: projects }] = await Promise.all([
    supabaseClient.from(TABLES.STATS_VISITS).select("*", { count: "exact", head: true }),
    supabaseClient.from(TABLES.STATS_TIME).select("duration_seconds"),
    supabaseClient.from(TABLES.PROJECTS).select("*", { count: "exact", head: true }),
    supabaseClient.from(TABLES.PROJECTS).select("title, views").order("views", { ascending: false }),
  ]);

  document.getElementById("stat-visits").textContent = visitsCount ?? 0;
  document.getElementById("stat-projects-count").textContent = projectsCount ?? 0;

  const avgSeconds = durations && durations.length
    ? Math.round(durations.reduce((sum, d) => sum + d.duration_seconds, 0) / durations.length)
    : 0;
  document.getElementById("stat-avg-time").textContent = formatDuration(avgSeconds);

  const viewsList = document.getElementById("stat-project-views");
  if (!projects || projects.length === 0) {
    viewsList.innerHTML = `<p class="text-gray-400 text-sm p-4">Sin datos todavía.</p>`;
  } else {
    viewsList.innerHTML = projects.map((p) => `
      <div class="flex items-center justify-between px-5 py-3">
        <span class="text-sm text-ink">${p.title}</span>
        <span class="text-sm font-semibold text-brand">${p.views || 0} vistas</span>
      </div>
    `).join("");
  }
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

/* ============================================================
 *  CONFIGURACIÓN DE CONTACTO
 * ============================================================ */
async function loadSettingsIntoForm() {
  const { data } = await supabaseClient.from(TABLES.CONTACT).select("*").eq("id", 1).single();
  if (!data) return;
  document.getElementById("settings-instagram").value = data.instagram_url || "";
  document.getElementById("settings-email").value = data.contact_email || "";
}

function bindSettingsForm() {
  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("settings-msg");
    msg.classList.add("hidden");

    const instagram_url = document.getElementById("settings-instagram").value.trim();
    const contact_email = document.getElementById("settings-email").value.trim();

    const { error } = await supabaseClient
      .from(TABLES.CONTACT)
      .update({ instagram_url, contact_email, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (error) {
      alert("Error al guardar: " + error.message);
      return;
    }

    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2500);
  });
}
