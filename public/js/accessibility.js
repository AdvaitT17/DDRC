/**
 * Accessibility features implementation
 * This file contains all the functionality for accessibility features like:
 * - Skip to main content
 * - Screen reader access
 * - Font size adjustments
 * - High contrast mode
 * - Keyboard navigation
 */

// Initialize all accessibility features
document.addEventListener("DOMContentLoaded", function () {
  // Initialize font size controls
  initFontSizeControls();

  // Initialize keyboard shortcuts
  initKeyboardShortcuts();

  // Initialize skip to main content
  initSkipToMain();

  // Initialize screen reader access
  initScreenReaderAccess();
});

// Font size adjustment
function initFontSizeControls() {
  const decreaseBtn = document.getElementById("decreaseFont");
  const resetBtn = document.getElementById("defaultFont");
  const increaseBtn = document.getElementById("increaseFont");

  if (!decreaseBtn || !resetBtn || !increaseBtn) return;

  // Get current font size level from localStorage or default to 'default'
  let currentFontSize = localStorage.getItem("fontSize") || "default";

  // Apply initial font size
  applyFontSize(currentFontSize);

  decreaseBtn.addEventListener("click", () => {
    if (currentFontSize === "medium") {
      currentFontSize = "default";
    } else if (currentFontSize === "default") {
      currentFontSize = "small";
    }
    applyFontSize(currentFontSize);
    announceScreenReaderMessage("Font size decreased");
  });

  resetBtn.addEventListener("click", () => {
    currentFontSize = "default";
    applyFontSize(currentFontSize);
    announceScreenReaderMessage("Font size reset to default");
  });

  increaseBtn.addEventListener("click", () => {
    if (currentFontSize === "small") {
      currentFontSize = "default";
    } else if (currentFontSize === "default") {
      currentFontSize = "medium";
    }
    applyFontSize(currentFontSize);
    announceScreenReaderMessage("Font size increased");
  });
}

function applyFontSize(level) {
  // Save the current level
  localStorage.setItem("fontSize", level);

  // Remove any previously applied scaling
  document.body.classList.remove("font-size-scaled");

  // Clear inline styles from previous scaling
  const allElements = document.querySelectorAll("*");
  allElements.forEach((el) => {
    if (el.style.fontSize) {
      el.style.removeProperty("fontSize");
    }
  });

  // Apply percentage-based scaling if not default
  if (level !== "default") {
    document.body.classList.add("font-size-scaled");

    // Get all text elements
    const textElements = document.querySelectorAll(
      "p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, label, button, input, textarea, select"
    );

    // Set scaling factor based on level
    const scaleFactor = level === "small" ? 0.9 : 1.1; // 90% or 110%

    textElements.forEach((element) => {
      // Get original size (computed style)
      const originalStyle = window.getComputedStyle(element);
      const originalSize = parseFloat(originalStyle.fontSize);

      // Apply scaled size
      element.style.fontSize = originalSize * scaleFactor + "px";
    });
  }
}



// Keyboard shortcuts
function initKeyboardShortcuts() {
  document.addEventListener("keydown", function (e) {
    // Check if Alt key is pressed along with another key
    if (e.altKey || e.metaKey) {
      // Add support for Command key on macOS
      switch (e.key.toLowerCase()) {
        case "h":
          // Go to home page
          window.location.href = "/";
          break;

        case "s":
          // Skip to main content
          skipToMain();
          break;

        case "f":
          // Focus on search (if exists)
          const searchInput = document.querySelector("input[type='search']");
          if (searchInput) {
            searchInput.focus();
            e.preventDefault();
          }
          break;

        case "t":
          // Back to top
          window.scrollTo({ top: 0, behavior: "smooth" });
          break;

        case "1":
          // Focus on main content
          const mainContent = document.querySelector("main");
          if (mainContent) {
            mainContent.focus();
            e.preventDefault();
          }
          break;

        case "2":
          // Focus on navigation
          const navMenu = document.querySelector(".main-nav");
          if (navMenu) {
            const firstNavItem = navMenu.querySelector("a");
            if (firstNavItem) {
              firstNavItem.focus();
              e.preventDefault();
            }
          }
          break;

        case "3":
          // Jump to footer
          const footer = document.querySelector("footer");
          if (footer) {
            footer.focus();
            footer.scrollIntoView({ behavior: "smooth" });
            e.preventDefault();
          }
          break;
      }
    }
  });

  // Add keyboard focus styles
  document.addEventListener("keydown", function (e) {
    if (e.key === "Tab") {
      document.body.classList.add("keyboard-navigation");
    }
  });

  document.addEventListener("mousedown", function () {
    document.body.classList.remove("keyboard-navigation");
  });
}

// Skip to main content functionality
function initSkipToMain() {
  const skipLink = document.querySelector(".skip-main");

  if (skipLink) {
    skipLink.addEventListener("click", function (e) {
      e.preventDefault();
      skipToMain();
    });
  }
}

function skipToMain() {
  const mainContent =
    document.querySelector("main") || document.getElementById("main-content");

  if (mainContent) {
    // Set tabindex to make it focusable if it isn't already
    if (!mainContent.hasAttribute("tabindex")) {
      mainContent.setAttribute("tabindex", "-1");
    }

    // Focus and scroll to the main content
    mainContent.focus();
    mainContent.scrollIntoView({ behavior: "smooth" });

    // Announce to screen readers
    announceScreenReaderMessage("Skipped to main content");
  }
}

// Screen reader access
function initScreenReaderAccess() {
  const screenReaderLink = document.querySelector(".screen-reader");

  if (screenReaderLink) {
    screenReaderLink.addEventListener("click", function (e) {
      e.preventDefault();

      // Toggle screen-reader-mode class
      const enabled = document.body.classList.toggle("screen-reader-mode");

      // Save preference
      localStorage.setItem("screenReaderMode", enabled);

      // Apply necessary ARIA adjustments
      if (enabled) {
        // Add appropriate ARIA attributes throughout the page
        document
          .querySelectorAll("nav, main, header, footer, section")
          .forEach((element) => {
            if (
              !element.hasAttribute("aria-label") &&
              !element.hasAttribute("aria-labelledby")
            ) {
              // Set appropriate ARIA label based on element type
              if (element.tagName === "NAV") {
                element.setAttribute("aria-label", "Main navigation");
              } else if (element.tagName === "MAIN") {
                element.setAttribute("aria-label", "Main content");
              } else if (element.tagName === "HEADER") {
                element.setAttribute("aria-label", "Page header");
              } else if (element.tagName === "FOOTER") {
                element.setAttribute("aria-label", "Page footer");
              }
            }
          });

        announceScreenReaderMessage("Screen reader mode enabled");
      } else {
        announceScreenReaderMessage("Screen reader mode disabled");
      }
    });
  }

  // Check if screen reader mode was previously enabled
  const screenReaderEnabled =
    localStorage.getItem("screenReaderMode") === "true";
  if (screenReaderEnabled) {
    document.body.classList.add("screen-reader-mode");
  }
}

// Utility function for screen reader announcements
function announceScreenReaderMessage(message) {
  let announcer = document.getElementById("screenReaderAnnouncer");

  if (!announcer) {
    // Create the announcer element if it doesn't exist
    announcer = document.createElement("div");
    announcer.id = "screenReaderAnnouncer";
    announcer.setAttribute("role", "alert");
    announcer.setAttribute("aria-live", "polite");
    announcer.className = "sr-only";
    document.body.appendChild(announcer);
  }

  // Set the message
  announcer.textContent = message;

  // Clear after a short delay
  setTimeout(() => {
    announcer.textContent = "";
  }, 3000);
}

// Expose the announceScreenReaderMessage function globally
window.announceScreenReaderMessage = announceScreenReaderMessage;
