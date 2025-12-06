// Header Component - Reusable header for all pages
(function () {
  // Check if user is logged in
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');
  const userName = localStorage.getItem('userName');

  // Build navigation links based on authentication status
  let navLinks = '';

  if (token && userType === 'divyangjan') {
    // Logged in divyangjan user
    navLinks = `
      <a href="/" class="nav-icon" aria-label="Home">
        <img src="/images/home-icons.png" alt="Home" />
      </a>
      <a href="/dashboard" aria-label="Dashboard">Dashboard</a>
      <a href="/track" aria-label="Track Your Application">Track Application</a>
      <a href="/schemes" aria-label="Government Schemes">Schemes</a>
      <a href="/media" aria-label="Media">Media</a>
      <a href="/faqs" aria-label="FAQs">FAQs</a>
      <a href="/contact" aria-label="Contact Us">Contact Us</a>
      <div class="nav-spacer"></div>
      <a href="#" class="nav-logout-btn" id="logoutBtn" aria-label="Logout">
        <img src="/images/logout.svg" alt="Logout Icon" />
        Logout
      </a>
    `;
  } else if (token && userType === 'department') {
    // Logged in department user
    navLinks = `
      <a href="/" class="nav-icon" aria-label="Home">
        <img src="/images/home-icons.png" alt="Home" />
      </a>
      <a href="/admin" aria-label="Admin Dashboard">Admin Dashboard</a>
      <a href="/schemes" aria-label="Government Schemes">Schemes</a>
      <a href="/media" aria-label="Media">Media</a>
      <a href="/faqs" aria-label="FAQs">FAQs</a>
      <a href="/contact" aria-label="Contact Us">Contact Us</a>
      <div class="nav-spacer"></div>
      <a href="#" class="nav-logout-btn" id="logoutBtn" aria-label="Logout">
        <img src="/images/logout.svg" alt="Logout Icon" />
        Logout
      </a>
    `;
  } else {
    // Not logged in
    navLinks = `
      <a href="/" class="nav-icon" aria-label="Home">
        <img src="/images/home-icons.png" alt="Home" />
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
    
    <!-- Top Bar -->
    <div class="top-bar" role="navigation" aria-label="Top Navigation">
      <div class="left-links">
        <a href="/" aria-label="Home">Home</a>
        <a href="/sitemap" aria-label="Sitemap">Sitemap</a>
      </div>
      <div class="right-links">
        <a href="#main-content" class="skip-main" aria-label="Skip to main content">Skip to Main Content</a>
        <a href="#" class="screen-reader" aria-label="Toggle screen reader optimized view">Screen Reader Access</a>
        <select class="language-select" id="languageSelect" aria-label="Select language">
          <option value="en">English</option>
          <option value="hi">हिंदी</option>
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
          <h1>District Disability Rehabilitation Centre, Mumbai</h1>
          <p>Department of Empowerment of Persons with Disabilities,</p>
          <p>Ministry of Social Justice and Empowerment, Govt. of India</p>
        </div>
        <img src="/images/ddrc-logo.png" alt="DDRC Logo" class="ddrc-logo" />
      </div>
    </header>

    <!-- Navigation Menu -->
    <nav class="main-nav" role="navigation" aria-label="Main Navigation">
      ${navLinks}
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

    // Add logout functionality if logout button exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();

        // Clear all auth data
        localStorage.removeItem('token');
        localStorage.removeItem('userType');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');

        // Redirect to home page
        window.location.href = '/';
      });
    }

    // Add external link warning functionality
    let pendingExternalUrl = null;
    const modal = document.getElementById('externalLinkModal');
    const cancelBtn = document.getElementById('cancelExternal');
    const proceedBtn = document.getElementById('proceedExternal');

    // Handle all links with target="_blank" or class="external-link"
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[target="_blank"], a.external-link');
      if (link && link.getAttribute('href')) {
        e.preventDefault();
        pendingExternalUrl = link.getAttribute('href');

        // Display the URL in the modal
        const urlDisplay = document.getElementById('externalUrlDisplay');
        if (urlDisplay) {
          urlDisplay.textContent = pendingExternalUrl;
        }

        modal.style.display = 'flex';
      }
    });

    // Cancel button
    cancelBtn.addEventListener('click', function () {
      modal.style.display = 'none';
      pendingExternalUrl = null;
    });

    // Proceed button
    proceedBtn.addEventListener('click', function () {
      if (pendingExternalUrl) {
        window.open(pendingExternalUrl, '_blank');
        modal.style.display = 'none';
        pendingExternalUrl = null;
      }
    });

    // Close modal on outside click
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.style.display = 'none';
        pendingExternalUrl = null;
      }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        modal.style.display = 'none';
        pendingExternalUrl = null;
      }
    });
  }
})();
