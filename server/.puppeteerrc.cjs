const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Change the cache directory for Puppeteer to /home (persists on Azure App Service)
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
