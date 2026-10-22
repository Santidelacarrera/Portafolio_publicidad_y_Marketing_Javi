import { createClient } from "@supabase/supabase-js";

const expectedUrl = "https://ccufeziqbutxyikkcany.supabase.co";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url !== expectedUrl || !key) {
  throw new Error("Se requieren SUPABASE_URL del proyecto correcto y SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const bucket = "portafolio-media";
const { error: readError } = await supabase.storage.getBucket(bucket);
if (readError) throw readError;

const { error } = await supabase.storage.updateBucket(bucket, {
  public: true,
  fileSizeLimit: 50 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
    "video/mp4", "video/webm", "video/quicktime",
    "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/x-wav",
  ],
});
if (error) throw error;
console.log(`Restricciones aplicadas al bucket ${bucket}`);
