const signer = require('node-signpdf').default;
const { plainAddPlaceholder } = require('node-signpdf/dist/helpers');

// Certificate from environment variables
const CERT_BASE64 = process.env.PDF_CERT_BASE64;
const CERT_PASSWORD = process.env.PDF_CERT_PASSWORD;

/**
 * Sign a PDF buffer with the DDRC certificate
 * @param {Buffer} pdfBuffer - Unsigned PDF buffer
 * @returns {Promise<Buffer>} - Signed PDF buffer
 */
async function signPDF(pdfBuffer) {
    try {
        // Check if certificate is configured
        if (!CERT_BASE64 || !CERT_PASSWORD) {
            console.warn('PDF signing not configured (missing PDF_CERT_BASE64 or PDF_CERT_PASSWORD). Returning unsigned PDF.');
            return pdfBuffer;
        }

        // Decode certificate from base64
        const p12Buffer = Buffer.from(CERT_BASE64, 'base64');

        // Add signature placeholder to PDF
        const pdfWithPlaceholder = plainAddPlaceholder({
            pdfBuffer: Buffer.from(pdfBuffer),
            reason: 'Official document of DDRC Mumbai',
            contactInfo: 'DDRC Mumbai, DEPwD',
            name: 'DDRC Mumbai',
            location: 'Mumbai, India',
        });

        // Sign the PDF
        const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer, {
            passphrase: CERT_PASSWORD
        });

        console.log('PDF signed successfully');
        return signedPdf;

    } catch (error) {
        console.error('Error signing PDF:', error.message);
        // Return unsigned PDF on error
        return pdfBuffer;
    }
}

module.exports = { signPDF };
