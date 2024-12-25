const pool = require("../config/database");

class FormService {
  // Get all sections with their fields
  async getSections() {
    try {
      console.log("Fetching all sections...");
      const [sections] = await pool.query(
        "SELECT * FROM form_sections ORDER BY order_index"
      );
      console.log("Found sections:", sections);

      for (let section of sections) {
        const [fields] = await pool.query(
          "SELECT * FROM form_fields WHERE section_id = ? ORDER BY order_index",
          [section.id]
        );
        section.fields = fields;
        console.log(`Fields for section ${section.id}:`, fields);
      }

      return sections;
    } catch (error) {
      console.error("Error in getSections:", error);
      throw error;
    }
  }

  // Add a new section
  async addSection(name) {
    try {
      console.log("Adding new section:", name);
      const [maxOrder] = await pool.query(
        "SELECT COALESCE(MAX(order_index), -1) as max_order FROM form_sections"
      );
      const newOrder = maxOrder[0].max_order + 1;

      const [result] = await pool.query(
        "INSERT INTO form_sections (name, order_index) VALUES (?, ?)",
        [name, newOrder]
      );
      console.log("Section added with ID:", result.insertId);

      return result.insertId;
    } catch (error) {
      console.error("Error in addSection:", error);
      throw error;
    }
  }

  // Add a new field to a section
  async addField(sectionId, fieldData) {
    try {
      console.log("Adding field to section:", sectionId, fieldData);

      // Parse sectionId as integer
      const sectionIdInt = parseInt(sectionId, 10);
      if (isNaN(sectionIdInt)) {
        throw new Error("Invalid section ID");
      }

      // First verify the section exists
      const [sections] = await pool.query(
        "SELECT id FROM form_sections WHERE id = ?",
        [sectionIdInt]
      );

      if (sections.length === 0) {
        throw new Error(`Section with ID ${sectionIdInt} not found`);
      }

      const [maxOrder] = await pool.query(
        "SELECT COALESCE(MAX(order_index), -1) as max_order FROM form_fields WHERE section_id = ?",
        [sectionIdInt]
      );
      const newOrder = maxOrder[0].max_order + 1;

      const [result] = await pool.query(
        `INSERT INTO form_fields 
        (section_id, name, display_name, field_type, is_required, options, order_index) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sectionIdInt,
          fieldData.name,
          fieldData.displayName,
          fieldData.type,
          Boolean(fieldData.required),
          fieldData.options ? JSON.stringify(fieldData.options) : null,
          newOrder,
        ]
      );
      console.log("Field added with ID:", result.insertId);

      return result.insertId;
    } catch (error) {
      console.error("Error in addField:", error);
      throw error;
    }
  }

  // Update an existing field
  async updateField(fieldId, fieldData) {
    try {
      const [result] = await pool.query(
        `UPDATE form_fields 
         SET name = ?, 
             display_name = ?, 
             field_type = ?, 
             is_required = ?, 
             options = ?
         WHERE id = ?`,
        [
          fieldData.name,
          fieldData.displayName,
          fieldData.type,
          fieldData.required,
          fieldData.options ? JSON.stringify(fieldData.options) : null,
          fieldId,
        ]
      );

      if (result.affectedRows === 0) {
        throw new Error("Field not found");
      }

      return true;
    } catch (error) {
      console.error("Error in updateField:", error);
      throw error;
    }
  }

  // Delete a section
  async deleteSection(sectionId) {
    try {
      await pool.query("DELETE FROM form_sections WHERE id = ?", [sectionId]);
      return true;
    } catch (error) {
      console.error("Error in deleteSection:", error);
      throw error;
    }
  }

  // Delete a field
  async deleteField(fieldId) {
    try {
      await pool.query("DELETE FROM form_fields WHERE id = ?", [fieldId]);
      return true;
    } catch (error) {
      console.error("Error in deleteField:", error);
      throw error;
    }
  }
}

module.exports = new FormService();
