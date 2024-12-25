const express = require("express");
const router = express.Router();
const formService = require("../services/formService");
const pool = require("../config/database");

// Get all sections with their fields
router.get("/sections", async (req, res) => {
  try {
    const sections = await formService.getSections();
    res.json(sections);
  } catch (error) {
    console.error("Route error - get sections:", error);
    res.status(500).json({
      error: "Failed to get form sections",
      details: error.message,
    });
  }
});

// Add new section
router.post("/sections", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Section name is required" });
    }
    const sectionId = await formService.addSection(name);
    res.status(201).json({ id: sectionId });
  } catch (error) {
    console.error("Route error - add section:", error);
    res.status(500).json({
      error: "Failed to add section",
      details: error.message,
    });
  }
});

// Add field to section
router.post("/sections/:sectionId/fields", async (req, res) => {
  try {
    const { sectionId } = req.params;
    const fieldId = await formService.addField(sectionId, req.body);
    res.status(201).json({ id: fieldId });
  } catch (error) {
    console.error("Route error - add field:", error);
    res.status(500).json({
      error: "Failed to add field",
      details: error.message,
    });
  }
});

// Update field
router.put("/fields/:id", async (req, res) => {
  try {
    await formService.updateField(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("Route error - update field:", error);
    res.status(500).json({
      error: "Failed to update field",
      details: error.message,
    });
  }
});

// Delete section
router.delete("/sections/:id", async (req, res) => {
  try {
    await formService.deleteSection(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Route error - delete section:", error);
    res.status(500).json({
      error: "Failed to delete section",
      details: error.message,
    });
  }
});

// Delete field
router.delete("/fields/:id", async (req, res) => {
  try {
    await formService.deleteField(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Route error - delete field:", error);
    res.status(500).json({
      error: "Failed to delete field",
      details: error.message,
    });
  }
});

// Add a route to test section creation
router.post("/test/section", async (req, res) => {
  try {
    const result = await pool.query(
      "INSERT INTO form_sections (name, order_index) VALUES (?, ?)",
      ["Test Section", 0]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Test section creation error:", error);
    res.status(500).json({ error: "Test failed", details: error.message });
  }
});

// Add a test route to verify our database connection
router.get("/test", async (req, res) => {
  try {
    const [result] = await pool.query("SELECT 1 as test");
    res.json({
      success: true,
      message: "Database connection successful",
      data: result,
    });
  } catch (error) {
    console.error("Test route error:", error);
    res.status(500).json({
      error: "Test failed",
      details: error.message,
    });
  }
});

module.exports = router;
