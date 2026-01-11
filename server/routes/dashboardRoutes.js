const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const pool = require("../config/database");
const {
  requireCompletedRegistration,
} = require("../middleware/registrationMiddleware");

// Apply middleware to all dashboard routes
// Note: authentication and registration check are already applied in server.js
// router.use(requireCompletedRegistration);

// Get dashboard data
router.get("/data", authenticateToken, async (req, res) => {
  try {
    // Get user's completed application details
    const [applications] = await pool.query(
      `SELECT 
        rp.id,
        rp.application_id,
        rp.status,
        rp.completed_at,
        rp.updated_at,
        rp.service_status
       FROM registration_progress rp
       WHERE rp.user_id = ? AND rp.status = 'completed'
       ORDER BY rp.completed_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: "No application found" });
    }

    const application = applications[0];


    // Get form responses for this application
    const [responses] = await pool.query(
      `SELECT 
        ff.name,
        rr.value
       FROM registration_responses rr
       JOIN form_fields ff ON rr.field_id = ff.id
       WHERE rr.registration_id = ?`,
      [application.id]
    );

    // Convert responses to an object
    const formData = responses.reduce((acc, curr) => {
      acc[curr.name] = curr.value;
      return acc;
    }, {});

    res.json({
      applicationId: application.application_id,
      status: application.service_status || application.status || "submitted",
      submittedDate: application.completed_at,
      lastUpdated: application.updated_at,
      applicantName: `${formData.firstname || ""} ${formData.lastname || ""
        }`.trim(),
      formData: formData,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Error fetching dashboard data" });
  }
});

// Get user profile data
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    // Get user's completed registration
    const [applications] = await pool.query(
      `SELECT id FROM registration_progress 
       WHERE user_id = ? AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: "No application found" });
    }

    const registrationId = applications[0].id;

    const tokenManager = require("../utils/temporaryAccess");

    // Get all form responses
    const [responses] = await pool.query(
      `SELECT 
        ff.name,
        ff.display_name,
        ff.field_type,
        rr.value,
        fs.name as section_name
       FROM registration_responses rr
       JOIN form_fields ff ON rr.field_id = ff.id
       JOIN form_sections fs ON ff.section_id = fs.id
       WHERE rr.registration_id = ?
       ORDER BY fs.order_index, ff.order_index`,
      [registrationId]
    );

    // Group by section
    const profileData = responses.reduce((acc, curr) => {
      if (!acc[curr.section_name]) {
        acc[curr.section_name] = [];
      }

      let value = curr.value;
      let token = null;

      // Generate token for files
      if (curr.field_type === 'file' && value) {
        let storagePath = value;
        if (storagePath.startsWith('uploads/')) {
          storagePath = storagePath.substring(8);
        }
        token = tokenManager.generateToken(storagePath, req.user.id);
      }

      acc[curr.section_name].push({
        label: curr.display_name,
        value: value,
        name: curr.name,
        type: curr.field_type,
        token: token
      });
      return acc;
    }, {});

    res.json(profileData);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// Get user documents
router.get("/documents", authenticateToken, async (req, res) => {
  try {
    const [applications] = await pool.query(
      `SELECT id FROM registration_progress 
       WHERE user_id = ? AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: "No application found" });
    }

    const tokenManager = require("../utils/temporaryAccess");

    // Get file fields
    const [documents] = await pool.query(
      `SELECT 
        ff.display_name,
        rr.value as file_path
       FROM registration_responses rr
       JOIN form_fields ff ON rr.field_id = ff.id
       WHERE rr.registration_id = ? AND ff.field_type = 'file'`,
      [applications[0].id]
    );

    // Generate temporary access tokens for each document
    const documentsWithTokens = documents.map(doc => {
      // Ensure path is consistent (remove 'uploads/' if present in DB)
      // We want paths like 'forms/filename.pdf' or just 'filename.pdf' 
      // But server.js expects 'forms/filename.pdf' key in token for /uploads/forms route

      let storagePath = doc.file_path;

      // If DB stores 'uploads/forms/file.pdf', strip 'uploads/'
      if (storagePath.startsWith('uploads/')) {
        storagePath = storagePath.substring(8); // Remove 'uploads/'
      }

      // If DB stores 'forms/file.pdf', keep it. 
      // Server.js constructs key as `forms/${req.url_filename}`.

      const token = tokenManager.generateToken(storagePath, req.user.id);
      return {
        ...doc,
        token
      };
    });

    res.json({ documents: documentsWithTokens });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ message: "Error fetching documents" });
  }
});

// Generate and download PDF
router.get("/download-pdf", authenticateToken, async (req, res) => {
  try {
    // Get user's completed application (same as /profile)
    const [applications] = await pool.query(
      `SELECT * FROM registration_progress 
       WHERE user_id = ? AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: "No application found" });
    }

    const application = applications[0];
    const registrationId = application.id;

    // Get all form responses (same query as /profile endpoint)
    const [responses] = await pool.query(
      `SELECT 
        ff.name,
        ff.display_name,
        ff.field_type,
        rr.value,
        fs.name as section_name
       FROM registration_responses rr
       JOIN form_fields ff ON rr.field_id = ff.id
       JOIN form_sections fs ON ff.section_id = fs.id
       WHERE rr.registration_id = ?
       ORDER BY fs.order_index, ff.order_index`,
      [registrationId]
    );

    // Find disabled_photo for PDF
    let photoBase64 = null;
    let disabledPhotoPath = null;
    const photoField = responses.find(r => r.name === 'disabled_photo' && r.value);

    if (photoField && photoField.value) {
      const storageService = require('../services/storageService');
      const path = require('path');

      try {
        console.log('Dashboard - Fetching photo for PDF:', photoField.value);

        // Check if file exists in storage (Azure/Local)
        // Clean path (remove 'uploads/' prefix if present)
        const relativePath = photoField.value.replace(/^\/?uploads\//, '');

        // Helper to convert stream to buffer
        const streamToBuffer = async (readableStream) => {
          return new Promise((resolve, reject) => {
            const chunks = [];
            readableStream.on('data', (data) => chunks.push(data instanceof Buffer ? data : Buffer.from(data)));
            readableStream.on('end', () => resolve(Buffer.concat(chunks)));
            readableStream.on('error', reject);
          });
        };

        const fileStream = await storageService.getFileStream(relativePath);
        if (fileStream) {
          const buffer = await streamToBuffer(fileStream);
          const ext = path.extname(relativePath).toLowerCase();
          const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
          photoBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
          console.log('Dashboard - Photo fetched and converted to base64');
        } else {
          console.warn('Dashboard - Photo stream not available for:', relativePath);
          // Fallback logic for legacy/local paths if not found in storage service
          const fs = require('fs');
          let localPath = photoField.value;
          if (!localPath.startsWith('/')) {
            localPath = path.join(__dirname, '../uploads', relativePath);
          }
          if (fs.existsSync(localPath)) {
            disabledPhotoPath = localPath; // Legacy behavior
            console.log('Dashboard - Found local fallback:', localPath);
          }
        }
      } catch (err) {
        console.error('Dashboard - Error fetching photo for PDF:', err.message);
      }
    }

    // Group by section (same as /profile endpoint)
    const profileData = responses.reduce((acc, curr) => {
      if (!acc[curr.section_name]) {
        acc[curr.section_name] = [];
      }

      // Skip file fields for PDF
      if (curr.field_type !== 'file') {
        acc[curr.section_name].push({
          label: curr.display_name,
          value: curr.value,
          name: curr.name,
          type: curr.field_type
        });
      }
      return acc;
    }, {});

    // Find applicant name from responses (combine first + last name)
    const firstNameField = responses.find(r => r.name === 'disabled_name' || r.name === 'firstname');
    const lastNameField = responses.find(r => r.name === 'last_name' || r.name === 'lastname');
    const firstName = firstNameField ? firstNameField.value : '';
    const lastName = lastNameField ? lastNameField.value : '';
    const applicantName = `${firstName} ${lastName}`.trim() || 'Applicant';

    // Prepare application data
    const applicationData = {
      applicationId: application.application_id,
      status: application.service_status || application.status || "submitted",
      submittedDate: application.completed_at,
      lastUpdated: application.updated_at,
      disabledPhoto: disabledPhotoPath,
      photoBase64: photoBase64,
      applicantName: applicantName
    };

    // Generate PDF using Puppeteer
    const { generateApplicationPDF } = require('../utils/pdfGenerator');
    const pdfBuffer = await generateApplicationPDF(applicationData, profileData);

    // Ensure it's a proper Buffer
    const buffer = Buffer.from(pdfBuffer);

    // Set response headers for PDF download
    const filename = `DDRC_Application_${applicationData.applicationId || 'download'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send the PDF buffer and end response
    res.end(buffer);

  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ message: "Error generating PDF" });
  }
});

module.exports = router;
