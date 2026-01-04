// Set Date
const docDateInput = document.getElementById('doc-date');
if (docDateInput && !docDateInput.value) {
    docDateInput.valueAsDate = new Date();
}

/**
 * DB LOGIC Replaces Storage Logic
 */
async function saveProtocolData() {
    // Collect Data
    const formData = {};
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(el => {
        if (el.type === 'checkbox' || el.type === 'radio') {
            if (el.checked) formData[el.id || el.name + ':' + el.value] = true;
        } else {
            formData[el.id] = el.value;
        }
    });

    // Signatures
    const techCanvas = document.getElementById('signature-tech');
    const custCanvas = document.getElementById('signature-customer');

    const customer = document.getElementById('customer-address').value.split('\n')[0] || 'Unbekannt';
    const signatures = {
        tech: techCanvas ? techCanvas.toDataURL() : null,
        customer: custCanvas ? custCanvas.toDataURL() : null
    };

    // Save to Supabase
    const entry = await saveDocumentToDb('Abnahmeprotokoll', customer, formData, signatures);
    return entry;
}

async function loadProtocolData(id) {
    const entry = await loadDocumentFromDb(id);
    if (!entry) {
        alert("Dokument nicht gefunden oder Zugriff verweigert.");
        return;
    }

    // Restore Fields
    if (entry.data) {
        for (const [key, value] of Object.entries(entry.data)) {
            const elById = document.getElementById(key);
            if (elById) {
                if (elById.type === 'checkbox') {
                    elById.checked = true;
                } else {
                    elById.value = value;
                }
            } else {
                if (key.includes(':')) {
                    const parts = key.split(':');
                    if (parts.length === 2) {
                        const radio = document.querySelector(`input[name="${parts[0]}"][value="${parts[1]}"]`);
                        if (radio) radio.checked = true;
                    }
                }
            }
        }
    }

    // Restore Signatures
    if (entry.signatures) {
        loadSignature('signature-tech', entry.signatures.tech);
        loadSignature('signature-customer', entry.signatures.customer);
    }
}

function loadSignature(id, dataUrl) {
    if (!dataUrl) return;
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
}


// Check URL params on Load
const urlParams = new URLSearchParams(window.location.search);
const loadId = urlParams.get('id');
if (loadId) {
    // Small delay to ensure auth is ready
    setTimeout(() => loadProtocolData(loadId), 500);
}


/**
 * PDF & Email Logic
 */
const saveBtn = document.getElementById('save-btn');
const successModal = document.getElementById('success-modal');
const emailLink = document.getElementById('email-btn-link');

function closeModal() {
    if (successModal) successModal.classList.remove('active');
}

if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
        try {
            // 1. Save to DB
            await saveProtocolData();

            // Check if PDF library is loaded
            if (typeof html2pdf === 'undefined') {
                alert('Warnung: PDF-Generator konnte nicht geladen werden.\nProtokoll nur im Archiv gespeichert.');
                return;
            }

            const element = document.getElementById('protocol-form');
            const opt = {
                margin: [10, 10, 10, 10],
                filename: 'Abnahmeprotokoll_WP.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // 2. Generate PDF
            html2pdf().set(opt).from(element).save().then(() => {
                // Prepare Mail Link
                const email = "onur.doe@gmail.com";
                const subject = "Abnahmeprotokoll WP";
                const body = "Hallo,\n\nanbei das Abnahmeprotokoll als PDF.\n\n(Bitte die soeben heruntergeladene PDF-Datei manuell anhängen.)";

                emailLink.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

                // Show Modal
                if (successModal) successModal.classList.add('active');

            }).catch(err => {
                console.error("PDF Error:", err);
                alert('Fehler bei der PDF-Erstellung. Daten im Archiv gesichert.\n\nDetail: ' + (err.message || err));
            });

        } catch (e) {
            console.error(e);
            alert('Fehler: ' + e.message);
        }
    });
}


/**
 * Canvas Logic 
 */
function setupCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let painting = false;

    // Resize to fit parent
    function resizeCanvas() {
        const parent = canvas.parentElement;
        if (parent) {
            // Only resize if empty to avoid wiping restored signature on window resize? 
            // Better strategy: Use a backing store or just clear/redraw. 
            // For simplicity here: Resize clears. User should sign last.
            // If loading, we drawImage after this anyway.
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#000';
        }
    }
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 100);

    function startPosition(e) {
        painting = true;
        draw(e);
    }
    function endPosition() {
        painting = false;
        ctx.beginPath();
    }
    function draw(e) {
        if (!painting) return;
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();

        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    // Event Listeners
    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', endPosition);
    canvas.addEventListener('mousemove', draw);

    canvas.addEventListener('touchstart', startPosition, { passive: false });
    canvas.addEventListener('touchend', endPosition);
    canvas.addEventListener('touchmove', draw, { passive: false });
}

setupCanvas('signature-tech');
setupCanvas('signature-customer');

document.querySelectorAll('[data-clear]').forEach(btn => {
    btn.addEventListener('click', function () {
        const targetId = this.getAttribute('data-clear');
        const canvas = document.getElementById(targetId);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
});
