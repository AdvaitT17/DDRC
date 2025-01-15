async function handleFileUpload(input) {
  const fieldId = input.dataset.fieldId;
  const maxSize = parseInt(input.dataset.maxSize);
  const file = input.files[0];
  const container = input.closest(".file-upload-container");

  if (!file) return;

  // Validate file size
  if (file.size > maxSize) {
    alert(
      `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
    );
    input.value = "";
    return;
  }

  try {
    // Show loading state
    container.classList.add("uploading");

    // Create form data
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fieldId", fieldId);

    // Upload file
    const response = await fetch("/api/registration/upload-file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AuthManager.getAuthToken()}`,
      },
      body: formData,
    });

    if (!response.ok) throw new Error("Upload failed");

    const data = await response.json();

    // Update UI
    const inputWrapper = container.querySelector(".file-input-wrapper");
    const preview = container.querySelector(".file-preview");
    const fileName = preview.querySelector(".file-name");

    inputWrapper.classList.add("hidden");
    preview.classList.remove("hidden");
    fileName.textContent = data.fileName;

    // Update saved responses in the form renderer
    window.formRenderer.savedResponses[fieldId] = data.fileName;
  } catch (error) {
    console.error("File upload error:", error);
    alert("Failed to upload file. Please try again.");
    input.value = "";
  } finally {
    container.classList.remove("uploading");
  }
}

async function handleFileDelete(fieldId) {
  try {
    const response = await fetch(`/api/registration/delete-file/${fieldId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${AuthManager.getAuthToken()}`,
      },
    });

    if (!response.ok) throw new Error("Delete failed");

    // Update UI
    const container = document
      .querySelector(`[data-field-id="${fieldId}"]`)
      .closest(".file-upload-container");
    const inputWrapper = container.querySelector(".file-input-wrapper");
    const preview = container.querySelector(".file-preview");
    const fileInput = container.querySelector('input[type="file"]');

    inputWrapper.classList.remove("hidden");
    preview.classList.add("hidden");
    fileInput.value = "";

    // Remove from saved responses
    delete window.formRenderer.savedResponses[fieldId];
  } catch (error) {
    console.error("File delete error:", error);
    alert("Failed to delete file. Please try again.");
  }
}
