/**
 * Inicialización del cliente de Supabase.
 * Requiere que se haya cargado antes:
 *   1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 (UMD -> window.supabase)
 *   2. js/config.js (define SUPABASE_CONFIG y TABLES)
 */
const { createClient } = window.supabase;

const supabaseClient = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

/**
 * Sube un archivo al bucket de Storage y devuelve su URL pública.
 * @param {File} file
 * @param {string} folder - subcarpeta dentro del bucket (ej: "images", "videos", "audios")
 * @returns {Promise<string>} URL pública del archivo
 */
async function uploadFileToStorage(file, folder = "misc") {
  const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${folder}/${Date.now()}_${cleanName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(SUPABASE_CONFIG.BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabaseClient.storage
    .from(SUPABASE_CONFIG.BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}
