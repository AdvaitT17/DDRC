// Mobile menu functionality for admin pages
(function() {
  'use strict';
  
  // Initialize mobile menu when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const leftLinks = document.getElementById('leftLinks');
    
    if (!mobileMenuToggle || !leftLinks) return;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'mobile-menu-overlay';
    document.body.appendChild(overlay);
    
    // Toggle menu function
    function toggleMobileMenu() {
      const isOpen = leftLinks.classList.contains('mobile-menu-open');
      
      if (isOpen) {
        leftLinks.classList.remove('mobile-menu-open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      } else {
        leftLinks.classList.add('mobile-menu-open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }
    
    // Event listeners
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    overlay.addEventListener('click', toggleMobileMenu);
    
    // Close menu when clicking a link
    leftLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function() {
        if (window.innerWidth <= 992) {
          toggleMobileMenu();
        }
      });
    });
    
    // Close menu on window resize if opened
    window.addEventListener('resize', function() {
      if (window.innerWidth > 992 && leftLinks.classList.contains('mobile-menu-open')) {
        toggleMobileMenu();
      }
    });
  });
})();

