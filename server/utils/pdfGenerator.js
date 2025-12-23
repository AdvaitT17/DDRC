const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

/**
 * Generate a styled PDF for an application using Puppeteer
 * Renders HTML to PDF with full Devanagari support
 */
async function generateApplicationPDF(applicationData, profileData) {
    // Logo paths
    const emblemPath = path.join(__dirname, '../../public/images/emblem.png');
    const ddrcLogoPath = path.join(__dirname, '../../public/images/ddrc-logo.png');

    // Convert images to base64 for embedding
    const emblemBase64 = fs.existsSync(emblemPath)
        ? `data:image/png;base64,${fs.readFileSync(emblemPath).toString('base64')}`
        : '';
    const ddrcLogoBase64 = fs.existsSync(ddrcLogoPath)
        ? `data:image/png;base64,${fs.readFileSync(ddrcLogoPath).toString('base64')}`
        : '';

    // Generate QR code with just the application ID (simple, scannable)
    let qrCodeBase64 = '';
    try {
        qrCodeBase64 = await QRCode.toDataURL(applicationData.applicationId || 'N/A', {
            width: 50,
            margin: 0,
            errorCorrectionLevel: 'M',
            color: { dark: '#1a237e', light: '#ffffff' }
        });
    } catch (err) {
        console.error('Error generating QR code:', err.message);
    }

    // Convert disabled photo to base64 if available
    let disabledPhotoBase64 = '';
    console.log('PDF Generator - disabledPhoto path:', applicationData.disabledPhoto);
    if (applicationData.disabledPhoto && fs.existsSync(applicationData.disabledPhoto)) {
        const ext = path.extname(applicationData.disabledPhoto).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        disabledPhotoBase64 = `data:${mimeType};base64,${fs.readFileSync(applicationData.disabledPhoto).toString('base64')}`;
        console.log('PDF Generator - Photo converted to base64, length:', disabledPhotoBase64.length);
    } else {
        console.log('PDF Generator - Photo file not found or path is null');
    }

    // Helper functions
    const formatDate = (dateStr) => {
        if (!dateStr) return 'Not available';
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'long', year: 'numeric'
            });
        } catch { return dateStr; }
    };

    const getStatusColor = (status) => {
        const colors = {
            'approved': '#28a745', 'pending': '#ffc107', 'rejected': '#dc3545',
            'processing': '#17a2b8', 'submitted': '#6c757d', 'completed': '#28a745',
            'under_review': '#17a2b8'
        };
        return colors[status?.toLowerCase()] || '#6c757d';
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    const status = applicationData.status || 'submitted';
    const statusColor = getStatusColor(status);

    // Generate sections HTML
    let sectionsHtml = '';
    let isFirstSection = true;

    for (const sectionName of Object.keys(profileData)) {
        const fields = profileData[sectionName];
        if (!fields || fields.length === 0) continue;

        let fieldsHtml = '';
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            if (field.type === 'file') continue;

            const label = escapeHtml(field.label || field.name || 'Field');
            let value = field.value;

            if (value === null || value === undefined || value === '') {
                value = 'Not provided';
            }

            // Mask Aadhaar
            if (field.name && field.name.toLowerCase().includes('aadhar')) {
                const clean = String(value).replace(/\D/g, '');
                if (clean.length >= 12) {
                    value = 'XXXX-XXXX-' + clean.slice(-4);
                }
            }

            fieldsHtml += `
                <tr class="${i % 2 === 0 ? 'alt-row' : ''}">
                    <td class="label">${label}</td>
                    <td class="value">${escapeHtml(value)}</td>
                </tr>
            `;
        }

        sectionsHtml += `
            <div class="section">
                <div class="section-header">${escapeHtml(sectionName)}</div>
                <table class="fields-table">
                    ${fieldsHtml}
                </table>
            </div>
        `;

        isFirstSection = false;
    }

    // Complete HTML template
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Noto Sans', 'Noto Sans Devanagari', sans-serif;
            font-size: 10px;
            color: #333;
            line-height: 1.4;
        }
        
        .header {
            display: flex;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 2px solid #e0e0e0;
            background: #fff;
        }
        
        .header-logo {
            height: 55px;
            margin-right: 12px;
        }
        
        .header-text {
            flex: 1;
        }
        
        .header-title {
            font-size: 16px;
            font-weight: 700;
            color: #1a237e;
            margin-bottom: 4px;
        }
        
        .header-subtitle {
            font-size: 9px;
            color: #666;
            line-height: 1.3;
        }
        
        .header-logo-right {
            height: 55px;
        }
        
        .app-info {
            background: #1a237e;
            color: white;
            padding: 10px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .app-info-title {
            font-weight: 700;
            font-size: 11px;
        }
        
        .app-info-id {
            font-size: 10px;
        }
        
        .status-badge {
            background: ${statusColor};
            color: white;
            padding: 4px 12px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .dates-bar {
            background: #f8f9fa;
            padding: 8px 20px;
            display: flex;
            gap: 40px;
            font-size: 9px;
            color: #666;
            border-bottom: 1px solid #dee2e6;
        }
        
        .content {
            padding: 15px 20px;
        }
        
        .section {
            margin-bottom: 15px;
            page-break-inside: avoid;
        }
        
        .applicant-card {
            display: flex;
            padding: 12px 20px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-bottom: 2px solid #1a237e;
            align-items: center;
            gap: 15px;
        }
        
        .applicant-photo img {
            width: 70px;
            height: 85px;
            object-fit: cover;
            border: 2px solid #1a237e;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .applicant-name {
            font-size: 14px;
            font-weight: 700;
            color: #1a237e;
            margin-bottom: 4px;
        }
        
        .applicant-id {
            font-size: 10px;
            color: #666;
            margin-bottom: 4px;
        }
        
        .status-badge-small {
            background: ${statusColor};
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .signature-seal {
            margin-left: auto;
            padding: 6px 8px;
            border: 2px solid #1a237e;
            border-radius: 4px;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            background: #fff;
            position: relative;
        }
        
        .signature-seal::before {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            right: 2px;
            bottom: 2px;
            border: 1px solid #1a237e;
            border-radius: 2px;
            pointer-events: none;
        }
        
        .seal-qr {
            position: relative;
            z-index: 1;
        }
        
        .seal-qr img {
            width: 45px;
            height: 45px;
        }
        
        .seal-content {
            text-align: center;
            position: relative;
            z-index: 1;
        }
        
        .seal-text-top {
            font-size: 6px;
            font-weight: 700;
            color: #1a237e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
        }
        
        .seal-icon {
            font-size: 12px;
            color: #28a745;
            font-weight: bold;
        }
        
        .seal-text-main {
            font-size: 5px;
            font-weight: 800;
            color: #1a237e;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-top: 1px;
        }
        
        .seal-date {
            font-size: 5px;
            color: #666;
            margin-top: 2px;
        }
        
        .section-header {
            background: #1a237e;
            color: white;
            padding: 6px 12px;
            font-weight: 600;
            font-size: 10px;
            text-transform: uppercase;
        }
        
        .fields-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .fields-table tr {
            border-bottom: 1px solid #dee2e6;
        }
        
        .fields-table td {
            padding: 6px 10px;
            vertical-align: top;
        }
        
        .fields-table .label {
            width: 40%;
            font-weight: 600;
            color: #495057;
        }
        
        .fields-table .value {
            width: 60%;
            color: #333;
        }
        
        .alt-row {
            background: #f8f9fa;
        }
        
        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 10px 20px;
            border-top: 2px solid #1a237e;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #666;
            background: white;
        }
    </style>
</head>
<body>
    <div class="header">
        ${emblemBase64 ? `<img src="${emblemBase64}" class="header-logo" alt="Emblem">` : ''}
        <div class="header-text">
            <div class="header-title">District Disability Rehabilitation Centre, Mumbai</div>
            <div class="header-subtitle">
                Department of Empowerment of Persons with Disabilities,<br>
                Ministry of Social Justice and Empowerment, Govt. of India
            </div>
        </div>
        ${ddrcLogoBase64 ? `<img src="${ddrcLogoBase64}" class="header-logo-right" alt="DDRC Logo">` : ''}
    </div>
    
    <div class="app-info">
        <span class="app-info-title">APPLICATION SUMMARY</span>
        <span class="app-info-id">Application ID: ${escapeHtml(applicationData.applicationId || 'N/A')}</span>
        <span class="status-badge">${escapeHtml(status.replace(/_/g, ' '))}</span>
    </div>
    
    <div class="dates-bar">
        <span>Submitted: ${formatDate(applicationData.submittedDate)}</span>
        <span>Updated: ${formatDate(applicationData.lastUpdated)}</span>
        <span>Generated: ${new Date().toLocaleDateString('en-IN')}</span>
    </div>
    
    ${disabledPhotoBase64 ? `
    <div class="applicant-card">
        <div class="applicant-photo">
            <img src="${disabledPhotoBase64}" alt="Applicant Photo">
        </div>
        <div class="applicant-details">
            <div class="applicant-name">${escapeHtml(applicationData.applicantName || 'Applicant')}</div>
            <div class="applicant-id">Application ID: ${escapeHtml(applicationData.applicationId || 'N/A')}</div>
            <div class="applicant-status">
                <span class="status-badge-small">${escapeHtml(status.replace(/_/g, ' '))}</span>
            </div>
        </div>
        <div class="signature-seal">
            ${qrCodeBase64 ? `<div class="seal-qr"><img src="${qrCodeBase64}" alt="QR"></div>` : ''}
            <div class="seal-content">
                <div class="seal-text-top">DDRC Mumbai</div>
                <div class="seal-icon">✓</div>
                <div class="seal-text-main">Digitally Signed</div>
                <div class="seal-date">${new Date().toLocaleDateString('en-IN')}</div>
            </div>
        </div>
    </div>
    ` : ''}
    
    <div class="content">
        ${sectionsHtml}
    </div>
    
    <div class="footer">
        <span>This is a digitally signed computer-generated document.</span>
        <span>Ref: ${escapeHtml(applicationData.applicationId)}</span>
    </div>
</body>
</html>
    `;

    // Launch Puppeteer
    // On Azure: chromium is installed via startup script (apt-get install chromium)
    // Locally: puppeteer bundles its own Chromium
    const puppeteer = require('puppeteer');
    const { signPDF } = require('./pdfSigner');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', bottom: '20mm', left: '0', right: '0' }
        });

        // Sign the PDF with DDRC certificate
        const signedPdfBuffer = await signPDF(pdfBuffer);

        return signedPdfBuffer;
    } finally {
        await browser.close();
    }
}

module.exports = { generateApplicationPDF };
