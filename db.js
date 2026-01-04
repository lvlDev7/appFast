
/**
 * DB Helper - Central Logic for Supabase Document Handling
 */

async function saveDocumentToDb(type, customer, data, signatures) {
    if (!window.supabaseClient) {
        alert("Datenbank-Verbindung fehlt! (Supabase Client nicht initialisiert)");
        return null;
    }

    // Get current user
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) {
        alert("Nicht eingeloggt! Speichern nicht möglich.");
        return null;
    }

    const { data: result, error } = await window.supabaseClient
        .from('documents')
        .insert({
            user_id: user.id,
            type: type,
            customer_name: customer,
            data: data,
            signatures: signatures
        })
        .select()
        .single();

    if (error) {
        console.error("DB Error:", error);
        alert("Fehler beim Speichern in der Datenbank: " + error.message);
        throw error;
    }

    return result;
}

async function fetchDocumentsFromDb() {
    if (!window.supabaseClient) return [];

    // RLS ensures we only see what we are allowed to see
    const { data, error } = await window.supabaseClient
        .from('documents')
        .select('id, type, customer_name, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Fetch Error:", error);
        return [];
    }
    return data;
}

async function loadDocumentFromDb(id) {
    const { data, error } = await window.supabaseClient
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error("Load Error:", error);
        return null;
    }
    return data;
}
