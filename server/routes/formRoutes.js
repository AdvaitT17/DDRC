const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const {
  authenticateToken,
  requireRole,
} = require("../middleware/authMiddleware");

// Get all form sections with their fields
router.get("/sections", async (req, res) => {
  try {
    const [sections] = await pool.query(
      `SELECT id, name, order_index 
       FROM form_sections 
       ORDER BY order_index`
    );

    // Get fields for all sections
    const [fields] = await pool.query(
      `SELECT id, section_id, name, display_name, field_type, is_required, 
              options, order_index, max_file_size, allowed_types, validation_rules
       FROM form_fields 
       ORDER BY order_index`
    );

    // Group fields by section
    const sectionsWithFields = sections.map((section) => ({
      ...section,
      fields: fields.filter((field) => field.section_id === section.id),
    }));

    res.json(sectionsWithFields);
  } catch (error) {
    console.error("Error fetching form sections:", error);
    res.status(500).json({ message: "Error fetching form sections" });
  }
});

// Create new section
router.post(
  "/sections",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Section name is required" });
      }

      // Get max order_index
      const [maxOrder] = await pool.query(
        "SELECT MAX(order_index) as max FROM form_sections"
      );
      const orderIndex = (maxOrder[0].max || 0) + 1;

      const [result] = await pool.query(
        "INSERT INTO form_sections (name, order_index) VALUES (?, ?)",
        [name, orderIndex]
      );

      res.status(201).json({
        id: result.insertId,
        name,
        order_index: orderIndex,
      });
    } catch (error) {
      console.error("Error creating section:", error);
      res.status(500).json({ message: "Error creating section" });
    }
  }
);

// Delete section
router.delete(
  "/sections/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      await pool.query("DELETE FROM form_sections WHERE id = ?", [
        req.params.id,
      ]);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting section:", error);
      res.status(500).json({ message: "Error deleting section" });
    }
  }
);

// Create new field
router.post(
  "/sections/:sectionId/fields",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const {
        name,
        display_name,
        field_type,
        is_required,
        options,
        max_file_size,
        allowed_types,
      } = req.body;

      // Get max order_index
      const [maxOrder] = await pool.query(
        "SELECT COALESCE(MAX(order_index), -1) as max FROM form_fields WHERE section_id = ?",
        [req.params.sectionId]
      );
      const orderIndex = maxOrder[0].max + 1;

      // For radio fields, structure the options object
      let optionsToStore = options;
      if (field_type === "radio" && typeof options === "object") {
        optionsToStore = {
          options: options.options || [],
          conditionalLogic: options.conditionalLogic || {},
        };
      }

      const [result] = await pool.query(
        `INSERT INTO form_fields 
         (section_id, name, display_name, field_type, is_required, options, order_index, max_file_size, allowed_types, validation_rules) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.sectionId,
          name,
          display_name,
          field_type,
          is_required,
          JSON.stringify(optionsToStore),
          orderIndex,
          field_type === "file" ? max_file_size : null,
          field_type === "file" ? allowed_types : null,
          validation_rules ? JSON.stringify(validation_rules) : null,
        ]
      );

      res.json({
        id: result.insertId,
        name,
        display_name,
        field_type,
        is_required,
        options: optionsToStore,
        max_file_size,
        allowed_types,
        order_index: orderIndex,
      });
    } catch (error) {
      console.error("Error creating field:", error);
      res.status(500).json({ message: "Error creating field" });
    }
  }
);

// Get field details
router.get("/fields/:id", authenticateToken, async (req, res) => {
  try {
    const [fields] = await pool.query(
      "SELECT * FROM form_fields WHERE id = ?",
      [req.params.id]
    );

    if (fields.length === 0) {
      return res.status(404).json({ message: "Field not found" });
    }

    const field = fields[0];
    if (field.options) {
      field.options = JSON.parse(field.options);
    }

    res.json(field);
  } catch (error) {
    console.error("Error fetching field:", error);
    res.status(500).json({ message: "Error fetching field" });
  }
});

// Delete field
router.delete(
  "/fields/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      await pool.query("DELETE FROM form_fields WHERE id = ?", [req.params.id]);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting field:", error);
      res.status(500).json({ message: "Error deleting field" });
    }
  }
);

// Update field
router.put(
  "/fields/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const {
        name,
        display_name,
        field_type,
        is_required,
        options,
        max_file_size,
        allowed_types,
        validation_rules,
      } = req.body;

      // For radio fields, structure the options object
      let optionsToStore = options;
      if (field_type === "radio" && typeof options === "object") {
        optionsToStore = {
          options: options.options || [],
          conditionalLogic: options.conditionalLogic || {},
        };
      }

      const [result] = await pool.query(
        `UPDATE form_fields 
       SET name = ?, 
           display_name = ?, 
           field_type = ?, 
           is_required = ?, 
           options = ?,
           max_file_size = ?,
           allowed_types = ?,
           validation_rules = ?
       WHERE id = ?`,
        [
          name,
          display_name,
          field_type,
          is_required,
          JSON.stringify(optionsToStore),
          field_type === "file" ? max_file_size : null,
          field_type === "file" ? allowed_types : null,
          validation_rules ? JSON.stringify(validation_rules) : null,
          req.params.id,
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Field not found" });
      }

      res.json({
        id: parseInt(req.params.id),
        name,
        display_name,
        field_type,
        is_required,
        options: optionsToStore,
        max_file_size,
        allowed_types,
      });
    } catch (error) {
      console.error("Error updating field:", error);
      res.status(500).json({ message: "Error updating field" });
    }
  }
);

module.exports = router;
