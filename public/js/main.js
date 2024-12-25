// Font size controls
function increaseFontSize() {
  document.body.style.fontSize =
    parseFloat(getComputedStyle(document.body).fontSize) * 1.1 + "px";
}

function decreaseFontSize() {
  document.body.style.fontSize =
    parseFloat(getComputedStyle(document.body).fontSize) * 0.9 + "px";
}

// Language change
function changeLanguage(lang) {
  // To be implemented with i18n
  console.log("Language changed to:", lang);
}
