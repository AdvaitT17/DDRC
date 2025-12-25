// Header Component - Reusable header for all pages
(function () {
  // Dynamically load translation.js if not already loaded
  if (typeof TranslationManager === 'undefined' && !document.querySelector('script[src="/js/translation.js"]')) {
    const translationScript = document.createElement('script');
    translationScript.src = '/js/translation.js';
    translationScript.async = true;
    document.head.appendChild(translationScript);
  }
  // Check if user is logged in using AuthManager
  let isAuthenticated = false;
  let userType = null;
  let userName = null;

  // Check authentication - need to check BOTH token types since AuthManager.getCurrentUserType()
  // is URL-based and won't find department tokens on public pages
  if (typeof AuthManager !== 'undefined') {
    // First try to detect department user (check departmentAuthToken directly)
    const departmentToken = localStorage.getItem('departmentAuthToken');
    const departmentUserInfo = localStorage.getItem('departmentUserInfo');

    if (departmentToken && departmentUserInfo) {
      isAuthenticated = true;
      try {
        const userInfo = JSON.parse(departmentUserInfo);
        userType = 'department';
        userName = userInfo?.name || userInfo?.email;
      } catch (e) {
        userType = 'department';
      }
    } else {
      // Then try applicant
      const applicantToken = localStorage.getItem('applicantAuthToken');
      const applicantUserInfo = localStorage.getItem('applicantUserInfo');

      if (applicantToken && applicantUserInfo) {
        isAuthenticated = true;
        try {
          const userInfo = JSON.parse(applicantUserInfo);
          userType = userInfo?.type || 'applicant';
          userName = userInfo?.name || userInfo?.email;
        } catch (e) {
          userType = 'applicant';
        }
      }
    }
  } else {
    // Fallback to direct localStorage check if AuthManager not loaded yet
    const token = localStorage.getItem('token');
    userType = localStorage.getItem('userType');
    userName = localStorage.getItem('userName');
    isAuthenticated = !!token;
  }

  // Check if we're on the dashboard page
  const isDashboardPage = window.location.pathname === '/dashboard' || window.location.pathname.startsWith('/dashboard/');

  // Build navigation links based on authentication status and page
  let navLinks = '';

  if (isDashboardPage && isAuthenticated) {
    // Dashboard-specific navigation
    const userEmail = userName || 'User';
    navLinks = `
      <a href="/" class="nav-icon" aria-label="Home">
        <img src="/images/home.svg" alt="Home" />
        <span class="nav-icon-text">Home</span>
      </a>
      <a href="/dashboard" aria-label="Dashboard">Dashboard</a>
      <a href="/dashboard/profile" aria-label="View Profile">Profile</a>
      <a href="/dashboard/documents" aria-label="Access Documents">Documents</a>
      <a href="/dashboard/equipment" aria-label="Request Equipment">Request Equipment</a>
      <div class="nav-spacer"></div>
      <span class="nav-user-email" aria-label="Logged in as ${userEmail}">Logged in as: ${userEmail}</span>
      <a href="#" class="nav-logout-btn" id="logoutBtn" aria-label="Logout">
        <img src="/images/logout.svg" alt="Logout Icon" />
        Logout
      </a>
    `;
  } else if (isAuthenticated && (userType === 'applicant' || userType === 'divyangjan')) {
    // Logged in divyangjan/applicant user
    const userEmail = userName || 'User';
    navLinks = `
      <a href="/" class="nav-icon" aria-label="Home">
        <img src="/images/home.svg" alt="Home" />
        <span class="nav-icon-text">Home</span>
      </a>
      <a href="/dashboard" aria-label="Dashboard">Dashboard</a>
      <a href="/track" aria-label="Track Your Application">Track Application</a>
      <a href="/schemes" aria-label="Government Schemes">Schemes</a>
      <a href="/media" aria-label="Media">Media</a>
      <a href="/faqs" aria-label="FAQs">FAQs</a>
      <a href="/contact" aria-label="Contact Us">Contact Us</a>
      <div class="nav-spacer"></div>
      <span class="nav-user-email" aria-label="Logged in as ${userEmail}">Logged in as: ${userEmail}</span>
      <a href="#" class="nav-logout-btn" id="logoutBtn" aria-label="Logout">
        <img src="/images/logout.svg" alt="Logout Icon" />
        Logout
      </a>
    `;
  } else if (isAuthenticated && userType === 'department') {
    // Logged in department user
    const userEmail = userName || 'Admin';
    navLinks = `
      <a href="/" class="nav-icon" aria-label="Home">
        <img src="/images/home.svg" alt="Home" />
        <span class="nav-icon-text">Home</span>
      </a>
      <a href="/admin" aria-label="Admin Dashboard">Admin Dashboard</a>
      <a href="/schemes" aria-label="Government Schemes">Schemes</a>
      <a href="/media" aria-label="Media">Media</a>
      <a href="/faqs" aria-label="FAQs">FAQs</a>
      <a href="/contact" aria-label="Contact Us">Contact Us</a>
      <div class="nav-spacer"></div>
      <span class="nav-user-email" aria-label="Logged in as ${userEmail}">Logged in as: ${userEmail}</span>
      <a href="#" class="nav-logout-btn" id="logoutBtn" aria-label="Logout">
        <img src="/images/logout.svg" alt="Logout Icon" />
        Logout
      </a>
    `;
  } else {
    // Not logged in
    navLinks = `
      <a href="/" class="nav-icon" aria-label="Home">
        <img src="/images/home.svg" alt="Home" />
        <span class="nav-icon-text">Home</span>
      </a>
      <a href="https://swavlambancard.gov.in/Applyforudid" class="external-link" target="_blank" aria-label="Apply For UDID">Apply For UDID</a>
      <a href="/track" aria-label="Track Your Application">Track Your Application</a>
      <a href="/schemes" aria-label="Government Schemes">Schemes</a>
      <a href="/media" aria-label="Media">Media</a>
      <a href="/faqs" aria-label="FAQs">FAQs</a>
      <a href="/contact" aria-label="Contact Us">Contact Us</a>
      <div class="nav-spacer"></div>
      <a href="/login" class="nav-login-btn" aria-label="Divyangjan Login">
        <img src="/images/login.svg" alt="Login Icon" />
        Divyangjan Login
      </a>
      <a href="/department-login" class="nav-login-btn" aria-label="Department User Login">
        <img src="/images/user-plus.svg" alt="User Icon" />
        Department User Login
      </a>
    `;
  }

  const headerHTML = `
    <!-- Accessibility Announcement for Screen Readers -->
    <div id="screenReaderAnnouncer" class="sr-only" role="alert" aria-live="polite"></div>
    
    <!-- Mobile Menu Overlay -->
    <div class="mobile-menu-overlay" id="mobileMenuOverlay"></div>
    
    <!-- Mobile Top Bar (visible only on mobile) -->
    <div class="mobile-top-bar">
      <div class="mobile-top-bar-left">
        <button id="mobileTopContrastToggle" class="mobile-contrast-toggle" aria-label="Toggle high contrast mode">
          <span class="contrast-icon">◐</span>
          <span class="contrast-text-short">Normal</span>
        </button>
        <select class="mobile-language-select" id="languageSelectMobileTop" aria-label="Select language">
          <option value="en">English</option>
          <option value="mr">मराठी</option>
          <option value="hi">हिन्दी</option>
          <option value="gu">ગુજરાતી</option>
          <option value="kn">ಕನ್ನಡ</option>
          <option value="te">తెలుగు</option>
        </select>
      </div>
      <button class="hamburger-menu" id="hamburgerBtn" aria-label="Toggle navigation menu" aria-expanded="false">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
    
    <!-- Top Bar (Desktop Only) -->
    <div class="top-bar" role="navigation" aria-label="Top Navigation">
      <div class="left-links">
        <a href="/" aria-label="Home">Home</a>
        <a href="/sitemap" aria-label="Sitemap">Sitemap</a>
      </div>
      <div class="right-links">
        <a href="#main-content" class="skip-main" aria-label="Skip to main content">Skip to Main Content</a>
        <a href="#" class="screen-reader" aria-label="Toggle screen reader mode">Screen Reader Access</a>
        <button id="contrastToggle" class="contrast-toggle" aria-label="Toggle high contrast mode">
          <span class="contrast-icon">◐</span> Normal Contrast
        </button>
        <select class="language-select" id="languageSelectDesktop" aria-label="Select language">
          <option value="en">English</option>
          <option value="mr">मराठी</option>
          <option value="hi">हिन्दी</option>
          <option value="gu">ગુજરાતી</option>
          <option value="kn">ಕನ್ನಡ</option>
          <option value="te">తెలుగు</option>
        </select>
      </div>
    </div>

    <!-- Main Header -->
    <header class="main-header" role="banner" aria-label="Site header">
      <div class="logo-section">
        <img
          src="/images/emblem.png"
          alt="Government of India Emblem"
          class="emblem-logo"
        />
        <div class="header-text">
          <!-- Desktop version -->
          <h1 class="header-title-desktop">District Disability Rehabilitation Centre, Mumbai</h1>
          <p class="header-subtitle-desktop">Department of Empowerment of Persons with Disabilities,</p>
          <p class="header-subtitle-desktop">Ministry of Social Justice and Empowerment, Govt. of India</p>
          
          <!-- Mobile version -->
          <h1 class="header-title-mobile">DDRC Mumbai</h1>
          <p class="header-subtitle-mobile">DEPwD, Ministry of Social Justice & Empowerment, Govt. of India</p>
        </div>
        <img src="/images/ddrc-logo.png" alt="DDRC Logo" class="ddrc-logo" />
      </div>
    </header>

    <!-- Navigation Menu -->
    <nav class="main-nav" id="mainNav" role="navigation" aria-label="Main Navigation">
      <!-- Mobile Menu Header (visible only on mobile) -->
      <div class="mobile-menu-header">
        <h2>Menu</h2>
        <button class="mobile-menu-close" id="mobileMenuClose" aria-label="Close menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <hr class="mobile-menu-divider" />
      
      ${navLinks}
      
      <hr class="mobile-menu-divider" />
      
      <!-- Mobile Accessibility Controls -->
      <div class="mobile-accessibility-controls">
        <button id="mobileContrastToggle" class="mobile-contrast-btn" aria-label="Toggle high contrast mode">
          <span class="contrast-icon">◐</span>
          <span class="contrast-text">Normal Contrast</span>
        </button>
      </div>
      
      
      <!-- Language Selector in Mobile Menu -->
      <div class="language-selector-mobile">
        <label for="languageSelectMobile">Language:</label>
        <select id="languageSelectMobile" aria-label="Select language">
          <option value="en">English</option>
          <option value="mr">मराठी</option>
          <option value="hi">हिन्दी</option>
          <option value="gu">ગુજરાતી</option>
          <option value="kn">ಕನ್ನಡ</option>
          <option value="te">తెలుగు</option>
        </select>
      </div>
    </nav>

    <!-- External Link Warning Modal -->
    <div id="externalLinkModal" class="external-modal" style="display: none;">
      <div class="external-modal-content">
        <div class="external-modal-header">
          <h3>External Website Notice</h3>
        </div>
        <div class="external-modal-body">
          <p>You are about to be redirected to an external website:</p>
          <p class="external-url" id="externalUrlDisplay"></p>
          <p>Please note that DDRC Mumbai is not responsible for the content or availability of external sites.</p>
        </div>
        <div class="external-modal-footer">
          <button class="modal-btn modal-btn-secondary" id="cancelExternal">Cancel</button>
          <button class="modal-btn modal-btn-primary" id="proceedExternal">Proceed</button>
        </div>
      </div>
    </div>
  `;

  // Insert header into the page
  const headerContainer = document.getElementById('site-header');
  if (headerContainer) {
    headerContainer.innerHTML = headerHTML;

    // Mobile Menu Functionality
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mainNav = document.getElementById('mainNav');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const body = document.body;

    // Toggle mobile menu
    function toggleMobileMenu() {
      const isOpen = mainNav.classList.contains('active');

      if (isOpen) {
        // Close menu
        mainNav.classList.remove('active');
        hamburgerBtn.classList.remove('active');
        mobileMenuOverlay.classList.remove('active');
        body.classList.remove('menu-open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      } else {
        // Open menu
        mainNav.classList.add('active');
        hamburgerBtn.classList.add('active');
        mobileMenuOverlay.classList.add('active');
        body.classList.add('menu-open');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
      }
    }

    // Hamburger button click
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', toggleMobileMenu);
    }

    // Mobile menu close button click
    if (mobileMenuClose) {
      mobileMenuClose.addEventListener('click', toggleMobileMenu);
    }

    // Overlay click to close
    if (mobileMenuOverlay) {
      mobileMenuOverlay.addEventListener('click', toggleMobileMenu);
    }

    // Close menu when clicking navigation links
    const navLinks = mainNav.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (mainNav.classList.contains('active')) {
          toggleMobileMenu();
        }
      });
    });

    // Close menu on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mainNav.classList.contains('active')) {
        toggleMobileMenu();
      }
    });

    // Close menu on window resize to desktop
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth > 767 && mainNav.classList.contains('active')) {
          toggleMobileMenu();
        }
      }, 250);
    });

    // Contrast Toggle Functionality
    const contrastToggle = document.getElementById('contrastToggle');
    const mobileContrastToggle = document.getElementById('mobileContrastToggle');
    const mobileTopContrastToggle = document.getElementById('mobileTopContrastToggle');

    // Check saved contrast preference
    const savedContrast = localStorage.getItem('highContrast');
    if (savedContrast === 'true') {
      body.classList.add('high-contrast');
      updateContrastButtons(true);
    }

    function updateContrastButtons(isHighContrast) {
      const text = isHighContrast ? 'High Contrast' : 'Normal Contrast';
      const shortText = isHighContrast ? 'High' : 'Normal';

      if (contrastToggle) {
        contrastToggle.innerHTML = `<span class="contrast-icon">◐</span> ${text}`;
      }

      if (mobileContrastToggle) {
        const textSpan = mobileContrastToggle.querySelector('.contrast-text');
        if (textSpan) {
          textSpan.textContent = text;
        }
      }

      if (mobileTopContrastToggle) {
        const textSpan = mobileTopContrastToggle.querySelector('.contrast-text-short');
        if (textSpan) {
          textSpan.textContent = shortText;
        }
      }
    }

    function toggleContrast() {
      const isHighContrast = body.classList.toggle('high-contrast');
      localStorage.setItem('highContrast', isHighContrast);
      updateContrastButtons(isHighContrast);

      // Announce to screen readers
      const announcer = document.getElementById('screenReaderAnnouncer');
      if (announcer) {
        announcer.textContent = isHighContrast ? 'High contrast mode enabled' : 'Normal contrast mode enabled';
      }
    }

    if (contrastToggle) {
      contrastToggle.addEventListener('click', toggleContrast);
    }

    if (mobileContrastToggle) {
      mobileContrastToggle.addEventListener('click', toggleContrast);
    }

    if (mobileTopContrastToggle) {
      mobileTopContrastToggle.addEventListener('click', toggleContrast);
    }

    // Sync language selectors (desktop, mobile top, mobile menu)
    const languageSelectDesktop = document.getElementById('languageSelectDesktop');
    const languageSelectMobileTop = document.getElementById('languageSelectMobileTop');
    const languageSelectMobile = document.getElementById('languageSelectMobile');

    // Set initial value from saved preference
    const savedLang = localStorage.getItem('selectedLanguage') || 'en';
    if (languageSelectDesktop) languageSelectDesktop.value = savedLang;
    if (languageSelectMobileTop) languageSelectMobileTop.value = savedLang;
    if (languageSelectMobile) languageSelectMobile.value = savedLang;

    function syncLanguageSelectors(value) {
      if (languageSelectDesktop) languageSelectDesktop.value = value;
      if (languageSelectMobileTop) languageSelectMobileTop.value = value;
      if (languageSelectMobile) languageSelectMobile.value = value;

      // Trigger translation if TranslationManager is available
      if (typeof TranslationManager !== 'undefined') {
        TranslationManager.translatePage(value).then(() => {
          // Re-setup MutationObserver for dynamic content in the new language
          TranslationManager.setupMutationObserver();
        });
      }
    }

    if (languageSelectDesktop) {
      languageSelectDesktop.addEventListener('change', (e) => syncLanguageSelectors(e.target.value));
    }

    if (languageSelectMobileTop) {
      languageSelectMobileTop.addEventListener('change', (e) => syncLanguageSelectors(e.target.value));
    }

    if (languageSelectMobile) {
      languageSelectMobile.addEventListener('change', (e) => syncLanguageSelectors(e.target.value));
    }

    // Add logout functionality if logout button exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();

        // Use AuthManager if available, otherwise fallback to manual cleanup
        if (typeof AuthManager !== 'undefined') {
          AuthManager.logout();
        } else {
          // Fallback: clear all possible auth-related items
          localStorage.removeItem('token');
          localStorage.removeItem('userType');
          localStorage.removeItem('userName');
          localStorage.removeItem('userId');
          localStorage.removeItem('applicantAuthToken');
          localStorage.removeItem('applicantUserInfo');
          localStorage.removeItem('departmentAuthToken');
          localStorage.removeItem('departmentUserInfo');
          window.location.href = '/';
        }
      });
    }

    // Add external link warning functionality
    let pendingExternalUrl = null;
    const modal = document.getElementById('externalLinkModal');
    const cancelBtn = document.getElementById('cancelExternal');
    const proceedBtn = document.getElementById('proceedExternal');

    // Helper functions to handle high contrast mode and modal positioning
    // CSS filter on body breaks position: fixed, so we move modal outside body temporarily
    const originalParent = modal.parentElement;

    function showModal() {
      // If high contrast is enabled, move modal to html element so it's not affected by body's filter
      if (body.classList.contains('high-contrast')) {
        document.documentElement.appendChild(modal);
        modal.classList.add('high-contrast-modal');
      }
      modal.style.display = 'flex';
    }

    function hideModal() {
      modal.style.display = 'none';
      pendingExternalUrl = null;
      // Move modal back to original parent if we moved it
      if (modal.classList.contains('high-contrast-modal')) {
        originalParent.appendChild(modal);
        modal.classList.remove('high-contrast-modal');
      }
    }

    // Helper function to check if URL is truly external
    function isExternalUrl(url) {
      // Relative URLs (starting with / or not starting with http) are internal
      if (!url || url.startsWith('/') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
        return false;
      }

      // Check if it's an absolute URL with a different host
      try {
        const urlObj = new URL(url, window.location.origin);
        return urlObj.origin !== window.location.origin;
      } catch (e) {
        // If URL parsing fails, assume it's internal
        return false;
      }
    }

    // Handle all links with target="_blank" or class="external-link"
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[target="_blank"], a.external-link');
      if (link && link.getAttribute('href')) {
        const href = link.getAttribute('href');

        // Only show warning for truly external URLs
        if (isExternalUrl(href)) {
          e.preventDefault();
          pendingExternalUrl = href;

          // Display the URL in the modal
          const urlDisplay = document.getElementById('externalUrlDisplay');
          if (urlDisplay) {
            urlDisplay.textContent = pendingExternalUrl;
          }

          showModal();
        }
        // For internal URLs, let them proceed normally (don't prevent default)
      }
    });

    // Cancel button
    cancelBtn.addEventListener('click', function () {
      hideModal();
    });

    // Proceed button
    proceedBtn.addEventListener('click', function () {
      if (pendingExternalUrl) {
        window.open(pendingExternalUrl, '_blank');
        hideModal();
      }
    });

    // Close modal on outside click
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        hideModal();
      }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        hideModal();
      }
    });
  }
})();
