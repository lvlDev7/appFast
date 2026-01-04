// Set Datum
document.getElementById("today-date").textContent = new Date().toLocaleDateString("de-DE");

/**
 * DB LOGIC
 */
const DOC_TYPE = 'Arbeitsnachweis';

async function saveReportData() {
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

  const techCanvas = document.getElementById('signature-tech');
  const custCanvas = document.getElementById('signature-customer');

  // Customer Name extraction logic for list view
  const customerElem = document.getElementById('customer-info') || document.getElementById('customer-name');
  let customerName = 'Unbekannt';
  if (customerElem) {
    customerName = customerElem.value.split('\n')[0] || 'Unbekannt';
  }

  const signatures = {
    tech: techCanvas ? techCanvas.toDataURL() : null,
    customer: custCanvas ? custCanvas.toDataURL() : null
  };

  return await saveDocumentToDb(DOC_TYPE, customerName, formData, signatures);
}

async function loadReportData(id) {
  const entry = await loadDocumentFromDb(id);
  if (!entry) {
    alert("Zugriff verweigert oder Dokument existiert nicht.");
    return;
  }

  if (entry.data) {
    for (const [key, value] of Object.entries(entry.data)) {
      const elById = document.getElementById(key);
      if (elById) {
        if (elById.type === 'checkbox') elById.checked = true;
        else elById.value = value;
      } else if (key.includes(':')) {
        const parts = key.split(':');
        if (parts.length === 2) {
          const radio = document.querySelector(`input[name="${parts[0]}"][value="${parts[1]}"]`);
          if (radio) radio.checked = true;
        }
      }
    }
    // If material body was dynamic, we might need to re-render it if we saved the selection loop
    // For now basics are restored via inputs.
    // Special case: Job Type change triggers render.
    const jobType = entry.data['job-type'];
    if (jobType) {
      renderMaterials(jobType);
      // Re-fill dynamic inputs after render
      setTimeout(() => {
        for (const [key, value] of Object.entries(entry.data)) {
          // Try again for dynamic fields
          const el = document.getElementById(key);
          if (el) el.value = value;
        }
      }, 50);
    }
  }

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
  img.onload = () => ctx.drawImage(img, 0, 0);
  img.src = dataUrl;
}

// URL Check
const urlParams = new URLSearchParams(window.location.search);
const loadId = urlParams.get('id');
if (loadId) {
  setTimeout(() => loadReportData(loadId), 500);
}


// --- Original Material Logic ---
const jobPresets = {
  "daikin-heatpump": [
    { label: "Kupferrohr 35mm", unit: "m" },
    { label: "Kupferrohr 28mm", unit: "m" },
    { label: "Kupferrohr 22mm", unit: "m" },
    { label: "Isolierung 35mm", unit: "m" },
    { label: "Fittinge 35mm", unit: "Stk" },
    { label: "Fittinge 28mm", unit: "Stk" },
    { label: "Fittinge 22mm", unit: "Stk" },
    { label: "Kesselsicherheitsgruppe", unit: "Stk" },
    { label: "Schrägsitz-Absperrventil", unit: "Stk" },
    { label: "Erdleitung DN35", unit: "m" }
  ]
};

const jobTypeSelect = document.getElementById("job-type");
const materialsBody = document.getElementById("materials-body");

function renderMaterials(presetKey) {
  materialsBody.innerHTML = "";
  const list = jobPresets[presetKey];
  if (!list || list.length === 0) {
    materialsBody.innerHTML = '<div class="materials-placeholder">Keine Materialliste.</div>';
    return;
  }
  list.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "material-row";
    // Simplified rendering for brevity
    row.innerHTML = `<div class="material-label">${item.label}</div>
                     <input class="material-input" type="number" placeholder="0" id="mat-${index}">
                     <div class="material-unit">${item.unit}</div>`;
    materialsBody.appendChild(row);
  });
}

jobTypeSelect.addEventListener("change", (e) => {
  renderMaterials(e.target.value);
});


// --- Canvas Logic ---
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

  function start(e) {
    drawing = true;
    draw(e);
  }
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

const sigTech = initSignatureCanvas('signature-tech');
const sigCust = initSignatureCanvas('signature-customer');

document.querySelectorAll("[data-clear]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-clear");
    const cvs = document.getElementById(id);
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);
  });
});


/**
 * SAVE & PDF LOGIC
 */
const saveBtn = document.getElementById("send-button"); // ID from HTML
const successModal = document.getElementById('success-modal');
const emailLink = document.getElementById('email-btn-link');

function closeModal() { if (successModal) successModal.classList.remove('active'); }

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    try {
      await saveReportData();

      if (typeof html2pdf === 'undefined') {
        alert('Warnung: PDF-Lib fehlt. Gespeichert im Archiv.');
        return;
      }

      const element = document.getElementById("work-order"); // The wrapper ID
      const opt = {
        margin: 5,
        filename: 'Arbeitsnachweis.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save().then(() => {
        const email = "onur.doe@gmail.com";
        const subject = "Arbeitsnachweis";
        const body = "Anbei der Arbeitsnachweis.";

        if (emailLink) emailLink.href = `mailto:${email}?subject=${subject}&body=${body}`;
        if (successModal) successModal.classList.add('active');
      }).catch(err => {
        console.error("PDF Error:", err);
        alert('PDF Fehler: ' + (err.message || err) + '\n\nDaten wurden trotzdem gespeichert.');
      });

    } catch (e) {
      alert("Fehler: " + e.message);
      console.error(e);
    }
  });
}
