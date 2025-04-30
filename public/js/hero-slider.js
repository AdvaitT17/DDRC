/**
 * Hero Slider Functionality
 * Manages the hero slider with automatic rotation and manual controls
 */

// Global variables
let currentHeroSlide = 0;
let heroSliderInterval;
let heroSliderPaused = false;
const heroSlideDelay = 6000; // 6 seconds between slides
const heroSlides = document.querySelectorAll(".hero-slide");
const heroIndicators = document.querySelectorAll(".hero-indicator");

// Initialize the hero slider when the document is loaded
document.addEventListener("DOMContentLoaded", () => {
  if (heroSlides.length > 0) {
    startHeroSlider();

    // Pause slider when user hovers over it
    const heroSection = document.querySelector(".hero-section");
    heroSection.addEventListener("mouseenter", pauseHeroSlider);
    heroSection.addEventListener("mouseleave", resumeHeroSlider);

    // Accessibility announcement for screen readers
    const screenReaderAnnouncer = document.getElementById(
      "screenReaderAnnouncer"
    );
    if (screenReaderAnnouncer) {
      announceHeroSlide(currentHeroSlide);
    }
  }
});

// Start the automatic slider
function startHeroSlider() {
  if (heroSlides.length <= 1) return;
  heroSliderInterval = setInterval(nextHeroSlide, heroSlideDelay);
}

// Show a specific slide
function showHeroSlide(index) {
  // Handle wrapping
  if (index >= heroSlides.length) index = 0;
  if (index < 0) index = heroSlides.length - 1;

  // Remove active class from all slides and indicators
  heroSlides.forEach((slide) => {
    slide.classList.remove("active");
    slide.setAttribute("aria-hidden", "true");
  });

  heroIndicators.forEach((indicator) => {
    indicator.classList.remove("active");
    indicator.setAttribute("aria-current", "false");
  });

  // Add active class to current slide and indicator
  heroSlides[index].classList.add("active");
  heroSlides[index].setAttribute("aria-hidden", "false");
  heroIndicators[index].classList.add("active");
  heroIndicators[index].setAttribute("aria-current", "true");

  // Update current slide index
  currentHeroSlide = index;

  // Announce to screen readers
  announceHeroSlide(index);
}

// Go to next slide
function nextHeroSlide() {
  showHeroSlide(currentHeroSlide + 1);
}

// Go to previous slide
function prevHeroSlide() {
  showHeroSlide(currentHeroSlide - 1);
}

// Jump to specific slide
function jumpToHeroSlide(index) {
  // Reset interval when manually changing slides
  clearInterval(heroSliderInterval);
  showHeroSlide(index);

  // Restart interval if not paused
  if (!heroSliderPaused) {
    heroSliderInterval = setInterval(nextHeroSlide, heroSlideDelay);
  }
}

// Pause the slider
function pauseHeroSlider() {
  clearInterval(heroSliderInterval);
  heroSliderPaused = true;
}

// Resume the slider
function resumeHeroSlider() {
  if (heroSliderPaused) {
    heroSliderInterval = setInterval(nextHeroSlide, heroSlideDelay);
    heroSliderPaused = false;
  }
}

// Announce current slide to screen readers
function announceHeroSlide(index) {
  const announcer = document.getElementById("screenReaderAnnouncer");
  if (announcer) {
    const heading = heroSlides[index].querySelector("h2").textContent;
    const message = `Current slide: ${heading}. Slide ${index + 1} of ${
      heroSlides.length
    }`;
    announcer.textContent = message;
  }
}

// Clean up when user leaves the page
window.addEventListener("beforeunload", () => {
  clearInterval(heroSliderInterval);
});
