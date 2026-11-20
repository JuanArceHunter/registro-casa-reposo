// js/supabase-client.js
const SUPABASE_URL = 'https://lamxdyewvblllhlhclks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbXhkeWV3dmJsbGxobGhjbGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxODQxNTIsImV4cCI6MjExMDc2MDE1Mn0.8NT6ZOm-Oy3w6rCPDbSqQHbpd0ML-oQhkrP239h6LfQ';

// Inicializamos el cliente global de Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función auxiliar para verificar si el usuario tiene sesión activa
async function verificarSesion() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// Función para cerrar sesión
async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}