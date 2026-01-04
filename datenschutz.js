// Set Datum
document.getElementById("today-date").textContent = new Date().toLocaleDateString("de-DE");

/**
 * DB LOGIC
 */
const DOC_TYPE = 'Datenschutz';

async function saveConsentData() {
  const formData = {};
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(el => {
    if (el.type === 'checkbox') {
      if (el.checked) formData[el.id] = true;
    } else {
      formData[el.id] = el.value;
    }
  });

  const custCanvas = document.getElementById('signature-customer');
  const customerName = document.getElementById('customer-name').value || 'Unbekannt';

  const signatures = {
    customer: custCanvas ? custCanvas.toDataURL() : null
  };

  return await saveDocumentToDb(DOC_TYPE, customerName, formData, signatures);
}

async function loadConsentData(id) {
  const entry = await loadDocumentFromDb(id);
  if (!entry) {
    alert("Dokument nicht gefunden.");
    return;
  }

  if (entry.data) {
    for (const [key, value] of Object.entries(entry.data)) {
      const el = document.getElementById(key);
      if (el) {
        if (el.type === 'checkbox') el.checked = true;
        else el.value = value;
      }
    }
  }
  if (entry.signatures && entry.signatures.customer) {
    loadSignature('signature-customer', entry.signatures.customer);
  }
}

function loadSignature(id, dataUrl) {
  if (!dataUrl) return;
  const cvs = document.getElementById(id);
  const ctx = cvs.getContext('2d');
  const img = new Image();
  img.onload = () => ctx.drawImage(img, 0, 0);
  img.src = dataUrl;
}

const urlParams = new URLSearchParams(window.location.search);
const loadId = urlParams.get('id');
if (loadId) setTimeout(() => loadConsentData(loadId), 500);

// --- Canvas ---
function initSignatureCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  window.addEventListener('resize', resize);
  setTimeout(resize, 100);

  let drawing = false;

  function start(e) { drawing = true; draw(e); }
  function end() { drawing = false; ctx.beginPath(); }
  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', end);

  return { clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height) };
}

const sigCust = initSignatureCanvas('signature-customer');

document.querySelectorAll("[data-clear]").forEach(btn => {
  btn.addEventListener("click", () => {
    sigCust.clear();
  });
});


// --- Save ---
const saveBtn = document.getElementById("save-button");
const successModal = document.getElementById('success-modal');
const emailLink = document.getElementById('email-btn-link');

function closeModal() { if (successModal) successModal.classList.remove('active'); }

if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    try {
      await saveConsentData();

      if (typeof html2pdf === 'undefined') {
        alert('Warnung: PDF-Lib fehlt. Gespeichert im Archiv.');
        return;
      }

      const element = document.getElementById("consent-form");
      const opt = {
        margin: 10,
        filename: 'Datenschutz.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save().then(() => {
        const email = "onur.doe@gmail.com";
        const subject = "Datenschutzerklärung";
        const body = "Anbei die Datenschutzerklärung.";

        if (emailLink) emailLink.href = `mailto:${email}?subject=${subject}&body=${body}`;
        if (successModal) successModal.classList.add('active');
      });

    } catch (e) {
      alert("Error: " + e.message);
      console.error(e);
    }
  });
}
