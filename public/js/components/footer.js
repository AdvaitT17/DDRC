// Footer Component - Dynamically inject footer into pages
// Usage: Include this script and add <div id="site-footer"></div> where you want the footer

function renderFooter() {
    const footerHTML = `
    <footer role="contentinfo" aria-label="Site Footer">
        <div class="footer-content">
            <div class="footer-section">
                <h3>About</h3>
                <ul>
                    <li><a href="/about-ddrc" aria-label="Know more about DDRC">Know more about DDRC</a></li>
                    <li><a href="/schemes" aria-label="Schemes for Persons with Disabilities">Schemes for Persons with Disabilities</a></li>
                    <li><a href="/news" aria-label="News & Updates">News & Updates</a></li>
                    <li><a href="/events" aria-label="Latest Events">Latest Events</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h3>Quick Access Key</h3>
                <ul>
                    <li>H = Go to Home Page</li>
                    <li>S = Skip to main content</li>
                    <li>F = Site Search</li>
                    <li>T = Back to Top</li>
                </ul>
            </div>
            <div class="footer-section">
                <h3>Use keyboard for quick access</h3>
                <ul>
                    <li>Internet Explorer - [Alt] + accesskey</li>
                    <li>Chrome - [Alt] + accesskey</li>
                    <li>Firefox - [Alt] [Shift] + accesskey</li>
                    <li>Safari - [Alt] + accesskey</li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; Copyright ${new Date().getFullYear()} District Disability Rehabilitation Centre, Mumbai. All Rights Reserved.</p>
        </div>
        <div class="footer-links">
            <a href="/terms" aria-label="Terms and Conditions">Terms & Conditions</a>
            <a href="/privacy" aria-label="Privacy Policy">Privacy Policy</a>
            <a href="/copyright" aria-label="Copyright Policy">Copyright Policy</a>
            <a href="/accessibility" aria-label="Accessibility Statement">Accessibility Statement</a>
        </div>
    </footer>
    `;

    // Insert footer at the end of body or in site-footer div
    const footerContainer = document.getElementById('site-footer');
    if (footerContainer) {
        footerContainer.innerHTML = footerHTML;
    } else {
        document.body.insertAdjacentHTML('beforeend', footerHTML);
    }
}

// Auto-render on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderFooter);
} else {
    renderFooter();
}
