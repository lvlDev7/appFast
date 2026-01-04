
// Auth Guard - Protects pages from unauthorized access
async function checkSession() {
    if (!window.supabaseClient) return;

    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (!session) {
        // User is not logged in
        // Redirect to login page if not already there
        if (!window.location.href.includes('login.html')) {
            window.location.href = 'login.html';
        }
    } else {
        // User IS logged in
        // If on login page, redirect to index
        if (window.location.href.includes('login.html')) {
            window.location.href = 'index.html';
        }
    }
}

// Run check on load
window.addEventListener('load', checkSession);
