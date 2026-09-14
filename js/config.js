/**
 * =========================================================
 *  CONFIGURACIÓN DE SUPABASE
 * =========================================================
 *  Reemplaza los valores de abajo con los datos de TU
 *  proyecto de Supabase (Project Settings > API).
 *
 *  ¡IMPORTANTE! La "anon key" es pública y segura de exponer
 *  en el frontend SIEMPRE que tengas configuradas las
 *  Row Level Security (RLS) policies correctas en tus tablas
 *  (ver sql/schema.sql).
 * =========================================================
 */
const SUPABASE_CONFIG = {
  URL: "https://ccufeziqbutxyikkcany.supabase.co",      // <-- SUPABASE_URL
  ANON_KEY: "sb_publishable_pHhsyoXz3SN5vd-zVtJqIQ_lFYQTpT8",         // <-- SUPABASE_ANON_KEY
  BUCKET: "portafolio-media",                   // Bucket de Storage para archivos
};

// Nombres de tablas usadas en toda la app (para evitar strings sueltos)
const TABLES = {
  PROJECTS: "projects",
  CONTACT: "site_settings",
  STATS_VISITS: "site_visits",
  STATS_TIME: "session_durations",
  PROJECT_VIEWS: "project_views",
};
