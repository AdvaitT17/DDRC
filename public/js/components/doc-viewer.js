// Reusable Document Viewer Component
// Depends on Bootstrap 5 and expects global styling in style.css

function openDocument(event, url, type, title) {
  if (type !== "image" && type !== "pdf") return true; // Default to new tab for other types

  event.preventDefault();

  // HTML escape utility to prevent XSS
  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Remove existing modal if any
  const existingModal = document.getElementById("documentPreviewModal");
  if (existingModal) {
    existingModal.remove();
  }

  // Sanitize inputs
  const safeUrl = escapeHtml(url);
  const safeType = escapeHtml(type);
  const safeTitle = escapeHtml(title);

  // Use Bootstrap XL modal (widest) but limited height in CSS
  const modalHtml = `
      <div class="modal fade" id="documentPreviewModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
        <div class="modal-dialog modal-xl modal-dialog-centered">
          <div class="modal-content" style="max-height: 85vh;">
            <div class="modal-header border-bottom py-2">
              <h5 class="modal-title h6 fw-bold text-truncate" style="max-width: 60%;">${safeTitle}</h5>
              <div class="ms-auto d-flex align-items-center gap-2">
                <a href="${safeUrl}" download target="_blank" class="btn btn-sm btn-outline-primary d-flex align-items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </a>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
            </div>
            <div class="modal-body p-0 bg-light d-flex justify-content-center align-items-center" style="overflow: hidden; height: 75vh;">
               ${safeType === "image"
      ? `<img src="${safeUrl}" class="img-fluid" style="max-height: 100%; max-width: 100%; object-fit: contain;">`
      : `<iframe src="${safeUrl}#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>`
    }
            </div>
          </div>
        </div>
      </div>
    `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const modal = new bootstrap.Modal(
    document.getElementById("documentPreviewModal"),
    {
      backdrop: "static",
      keyboard: false,
    }
  );
  modal.show();

  // Clean up on modal hide
  document
    .getElementById("documentPreviewModal")
    .addEventListener("hidden.bs.modal", function () {
      this.remove();
    });

  return false;
}

// Make globally available if not already (for direct onclick handlers)
if (typeof window !== "undefined") {
  window.openDocument = openDocument;
}
