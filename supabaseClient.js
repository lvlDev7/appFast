
// Supabase Client Initialization
// Documentation: https://supabase.com/docs/reference/javascript/initializing

const SUPABASE_URL = 'https://tujpbohyeapiauaqhbiq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1anBib2h5ZWFwaWF1YXFoYmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MDU2NTYsImV4cCI6MjA4MzA4MTY1Nn0.xAhr-JqYmnadCE4nZRDevoWrNRHVfemmeGDcxTSBBZQ';

// Ensure the library is loaded before initializing
if (typeof supabase !== 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase initialized");
} else {
    console.error("Supabase JS library not found!");
}
