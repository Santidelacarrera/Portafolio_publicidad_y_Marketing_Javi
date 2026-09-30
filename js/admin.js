/**
 * Lógica del panel de administración:
 *  - Protección de ruta (requiere sesión)
 *  - CRUD de proyectos (con subida de archivos a Storage)
 *  - Módulo de estadísticas
 *  - Configuración de contacto (footer)
 */

let editingProjectId = null;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const safeMediaUrl = (value) => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
const uniqueValues = (values) => [...new Set((values || []).filter(Boolean))];
const mediaKey = (url) => storagePathFromPublicUrl(url) || String(url || "");
const emptyMediaState = () => ({ images: [], videos: [], audios: [], removed: { images: new Set(), videos: new Set(), audios: new Set() } });
let projectMediaState = emptyMediaState();

function videoMimeFromPath(path) {
  const extension = path.split(".").pop()?.toLowerCase();
  return ({ mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" })[extension] || "";
}
function mediaStateFromProject(project = {}) {
  project ??= {};
  const images = uniqueValues(project.images).map((url) => ({ url, path: storagePathFromPublicUrl(url) }));
  const audios = uniqueValues(project.audios).map((url) => ({ url, path: storagePathFromPublicUrl(url) }));
  const videosByUrl = new Map();
  (project.video_assets || []).forEach((asset) => {
    const url = asset?.url || asset?.original_url;
    const path = storagePathFromPublicUrl(url);
    if (path && (!asset?.source || asset.source === "storage")) videosByUrl.set(url, { ...asset, source: "storage", url, path, mime_type: asset.mime_type || videoMimeFromPath(path) });
  });
  (project.videos || []).forEach((url) => {
    const path = storagePathFromPublicUrl(url);
    if (path && !videosByUrl.has(url)) videosByUrl.set(url, { source: "storage", url, original_url: url, mime_type: videoMimeFromPath(path), title: "Video", path });
  });
  return {
    images,
    videos: [...videosByUrl.values()],
    audios,
    removed: { images: new Set(), videos: new Set(), audios: new Set() },
  };
}
function mediaLabel(item) {
  try { return decodeURIComponent(new URL(item.url).pathname.split("/").pop()) || "Archivo"; } catch { return "Archivo"; }
}
function renderExistingMedia(type, containerId) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  const items = projectMediaState[type];
  if (!items.length) return;
  items.forEach((item) => {
    const key = mediaKey(item.url);
    const marked = projectMediaState.removed[type].has(key);
    const row = document.createElement("div");
    row.className = `flex items-center gap-3 rounded-lg border p-2 ${marked ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50"}`;
    if (type === "images" && safeMediaUrl(item.url)) {
      const preview = document.createElement("img");
      preview.src = item.url;
      preview.alt = "Imagen actual del proyecto";
      preview.className = "h-14 w-14 rounded object-cover";
      row.append(preview);
    } else if (type === "audios" && safeMediaUrl(item.url)) {
      const audio = document.createElement("audio");
      audio.src = item.url;
      audio.controls = true;
      audio.className = "max-w-40";
      row.append(audio);
    } else {
      const icon = document.createElement("span");
      icon.className = "flex h-10 w-10 items-center justify-center rounded bg-pink-50 text-brand";
      icon.textContent = "▶";
      row.append(icon);
    }
    const description = document.createElement("p");
    description.className = "min-w-0 flex-1 truncate text-xs text-gray-600";
    description.textContent = marked ? `${mediaLabel(item)} · Marcado para eliminar` : mediaLabel(item);
    const button = document.createElement("button");
    button.type = "button";
    button.className = marked ? "text-xs font-semibold text-brand hover:underline" : "text-xs font-semibold text-red-500 hover:underline";
    button.textContent = marked ? "Restaurar" : "Eliminar";
    button.addEventListener("click", () => {
      if (marked) projectMediaState.removed[type].delete(key);
      else projectMediaState.removed[type].add(key);
      renderExistingMedia(type, containerId);
    });
    row.append(description, button);
    container.append(row);
  });
}
function renderProjectMedia() {
  renderExistingMedia("images", "project-existing-images");
  renderExistingMedia("videos", "project-existing-videos");
  renderExistingMedia("audios", "project-existing-audios");
}
function showProjectActionStatus(message) {
  const status = document.getElementById("project-action-status");
  status.textContent = message;
  status.classList.remove("hidden");
}

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
    console.error("Error loading projects:", error);
    list.innerHTML = `<p class="text-red-600 text-sm">No fue posible cargar los proyectos. Intenta nuevamente.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<p class="text-gray-400 text-sm">Aún no creaste ningún proyecto.</p>`;
    return;
  }

  list.innerHTML = data.map((p) => `
    <div class="bg-white rounded-2xl border border-pink-50 p-4 flex gap-4">
      ${p.images && safeMediaUrl(p.images[0])
        ? `<img src="${escapeHtml(safeMediaUrl(p.images[0]))}" alt="" class="w-20 h-20 rounded-xl object-cover flex-shrink-0" />`
        : `<div class="w-20 h-20 rounded-xl bg-pink-50 flex-shrink-0"></div>`}
      <div class="flex-1 min-w-0">
        <p class="tag">${escapeHtml(p.category || "General")}</p>
        <h4 class="font-semibold text-ink truncate">${escapeHtml(p.title)}</h4>
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
  projectMediaState = mediaStateFromProject(project);
  document.getElementById("project-form-title").textContent = project ? "Editar proyecto" : "Nuevo proyecto";
  document.getElementById("project-id").value = project?.id || "";
  document.getElementById("project-title").value = project?.title || "";
  document.getElementById("project-description").value = project?.description || "";
  document.getElementById("project-category").value = project?.category || "";
  document.getElementById("project-role").value = project?.role || "";
  document.getElementById("project-year").value = project?.year || "";
  document.getElementById("project-tools").value = project?.tools || "";
  document.getElementById("project-credits").value = project?.credits || "";
  document.getElementById("project-rights").value = project?.rights || "";
  document.getElementById("project-videos-embed").value = (project?.videos || []).filter((url) => !storagePathFromPublicUrl(url)).join("\n");
  document.getElementById("project-links").value = (project?.links || []).join(", ");
  document.getElementById("project-form-error").classList.add("hidden");
  document.getElementById("project-form-progress").classList.add("hidden");
  renderProjectMedia();
  document.getElementById("project-form-modal").classList.remove("hidden");
}

function closeProjectForm() {
  document.getElementById("project-form-modal").classList.add("hidden");
  document.getElementById("project-form").reset();
  editingProjectId = null;
  projectMediaState = emptyMediaState();
  renderProjectMedia();
}

async function editProject(id) {
  const { data, error } = await supabaseClient.from(TABLES.PROJECTS).select("*").eq("id", id).single();
  if (error) {
    console.error("Error loading project for editing:", error);
    alert("No se pudo cargar el proyecto. Intenta nuevamente.");
    return;
  }
  openProjectForm(data);
}

async function deleteProject(id) {
  if (!confirm("¿Eliminar este proyecto? Esta acción no se puede deshacer.")) return;
  const { data: project, error: readError } = await supabaseClient
    .from(TABLES.PROJECTS).select("images, videos, audios, video_assets").eq("id", id).single();
  if (readError) {
    console.error("Error loading project media before deletion:", readError);
    alert("No se pudo verificar el contenido del proyecto. No se eliminó nada.");
    return;
  }
  const media = mediaStateFromProject(project);
  const storagePaths = uniqueValues([
    ...media.images.map((item) => item.path),
    ...media.videos.map((item) => item.path),
    ...media.audios.map((item) => item.path),
  ]);
  const { error } = await supabaseClient.from(TABLES.PROJECTS).delete().eq("id", id);
  if (error) {
    console.error("Error deleting project:", error);
    alert("No se pudo eliminar el proyecto. Intenta nuevamente.");
    return;
  }
  let storageCleanupFailed = false;
  try {
    await removeFilesFromStorage(storagePaths);
  } catch (storageError) {
    storageCleanupFailed = true;
    console.error("Project deleted but Storage cleanup failed:", storageError);
    alert("El proyecto fue eliminado, pero algunos archivos podrían haber quedado en Storage.");
  }
  await loadAdminProjects();
  showProjectActionStatus(storageCleanupFailed ? "Proyecto eliminado; algunos archivos podrían requerir revisión en Storage." : "Proyecto eliminado correctamente.");
}

async function handleProjectSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("project-form-submit");
  const errorEl = document.getElementById("project-form-error");
  const progressEl = document.getElementById("project-form-progress");
  errorEl.classList.add("hidden");

  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando...";

  const uploadedPaths = [];
  let databaseSaved = false;
  try {
    const title = document.getElementById("project-title").value.trim();
    const description = document.getElementById("project-description").value.trim();
    const category = document.getElementById("project-category").value.trim();
    const role = document.getElementById("project-role").value.trim();
    const year = document.getElementById("project-year").value.trim();
    const tools = document.getElementById("project-tools").value.trim();
    const credits = document.getElementById("project-credits").value.trim();
    const rights = document.getElementById("project-rights").value.trim();

    const imageFiles = Array.from(document.getElementById("project-images-file").files);
    const videoFiles = Array.from(document.getElementById("project-videos-file").files);
    const audioFiles = Array.from(document.getElementById("project-audios-file").files);

    const embedVideos = document.getElementById("project-videos-embed").value
      .split("\n").map((s) => s.trim()).filter(Boolean);
    const links = document.getElementById("project-links").value
      .split(",").map((s) => s.trim()).filter(Boolean);

    let verifiedMedia = emptyMediaState();
    if (editingProjectId) {
      const { data: existing, error: existingError } = await supabaseClient
        .from(TABLES.PROJECTS).select("images, videos, audios, video_assets").eq("id", editingProjectId).single();
      if (existingError || !existing) {
        console.error("Error loading project media before saving:", existingError);
        throw new Error("No se pudo verificar el contenido existente. El proyecto no fue modificado.");
      }
      verifiedMedia = mediaStateFromProject(existing);
    }

    // Subida de archivos a Supabase Storage
    progressEl.textContent = "Subiendo archivos multimedia...";
    progressEl.classList.remove("hidden");

    const uploadAndTrack = async (files, upload) => {
      const results = await Promise.allSettled(files.map(async (file) => {
        const result = await upload(file);
        const url = typeof result === "string" ? result : result.url;
        const path = storagePathFromPublicUrl(url);
        if (!path) throw new Error("No se pudo verificar la ruta del archivo subido.");
        uploadedPaths.push(path);
        return result;
      }));
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
      return results.map((result) => result.value);
    };
    const uploadedImages = await uploadAndTrack(imageFiles, (file) => uploadFileToStorage(file, "images"));
    const uploadedVideos = await uploadAndTrack(videoFiles, (file) => uploadVideoToStorage(file, (percent) => {
      progressEl.textContent = percent === null ? `Subiendo ${file.name}...` : `Subiendo ${file.name}: ${percent}%`;
    }));
    const uploadedAudios = await uploadAndTrack(audioFiles, (file) => uploadFileToStorage(file, "audios"));

    progressEl.textContent = "Guardando proyecto en la base de datos...";

    const keep = (type) => verifiedMedia[type].filter((item) => !projectMediaState.removed[type].has(mediaKey(item.url)));
    const keptImages = keep("images");
    const keptVideos = keep("videos");
    const keptAudios = keep("audios");
    const externalVideos = uniqueValues(embedVideos.filter((url) => !storagePathFromPublicUrl(url)));
    const allVideoAssets = [...keptVideos, ...uploadedVideos];

    const payload = {
      title,
      description,
      category,
      role,
      year,
      tools,
      credits,
      rights,
      images: uniqueValues([...keptImages.map((item) => item.url), ...uploadedImages]),
      videos: uniqueValues([...externalVideos, ...keptVideos.map((item) => item.url), ...uploadedVideos.map((video) => video.url)]),
      video_assets: uniqueValues(allVideoAssets.map((video) => video.url)).map((url) => allVideoAssets.find((video) => video.url === url)),
      audios: uniqueValues([...keptAudios.map((item) => item.url), ...uploadedAudios]),
      links: uniqueValues(links),
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
    databaseSaved = true;
    const removedPaths = uniqueValues([
      ...verifiedMedia.images.filter((item) => projectMediaState.removed.images.has(mediaKey(item.url))).map((item) => item.path),
      ...verifiedMedia.videos.filter((item) => projectMediaState.removed.videos.has(mediaKey(item.url))).map((item) => item.path),
      ...verifiedMedia.audios.filter((item) => projectMediaState.removed.audios.has(mediaKey(item.url))).map((item) => item.path),
    ]);
    try {
      await removeFilesFromStorage(removedPaths);
    } catch (storageError) {
      console.error("Project saved but selected Storage cleanup failed:", storageError);
      alert("El proyecto fue guardado, pero algunos archivos marcados podrían haber quedado en Storage.");
    }

    closeProjectForm();
    await loadAdminProjects();
    showProjectActionStatus("Proyecto guardado correctamente.");
  } catch (err) {
    console.error("Error saving project or uploading media:", err);
    let cleanupFailed = false;
    if (!databaseSaved && uploadedPaths.length) {
      try {
        await removeFilesFromStorage(uploadedPaths);
      } catch (cleanupError) {
        cleanupFailed = true;
        console.error("Unable to clean up newly uploaded files:", cleanupError);
      }
    }
    errorEl.textContent = cleanupFailed
      ? "No se pudo guardar el proyecto y algunos archivos nuevos podrían haber quedado en Storage."
      : (err.message || "No se pudo guardar el proyecto. Revisa los datos e inténtalo nuevamente.");
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
  const [visitsResult, durationsResult, projectsCountResult, projectsResult] = await Promise.all([
    supabaseClient.from(TABLES.STATS_VISITS).select("*", { count: "exact", head: true }),
    supabaseClient.from(TABLES.STATS_TIME).select("duration_seconds"),
    supabaseClient.from(TABLES.PROJECTS).select("*", { count: "exact", head: true }),
    supabaseClient.from(TABLES.PROJECTS).select("title, views").order("views", { ascending: false }),
  ]);

  if (visitsResult.error || durationsResult.error || projectsCountResult.error || projectsResult.error) {
    console.error("Error loading admin statistics:", { visits: visitsResult.error, durations: durationsResult.error, projects: projectsCountResult.error || projectsResult.error });
  }
  const visitsCount = visitsResult.count;
  const durations = durationsResult.data;
  const projectsCount = projectsCountResult.count;
  const projects = projectsResult.data;

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
        <span class="text-sm text-ink">${escapeHtml(p.title)}</span>
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
