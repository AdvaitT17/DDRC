const pool = require('../config/database');

/**
 * Validation Service
 * Validates form field values against their defined validation rules
 */

class ValidationService {
  /**
   * Validate form data against field validation rules
   * @param {Object} formData - The form data to validate (key: fieldId, value: field value)
   * @param {number} sectionId - Optional section ID to validate only specific section fields
   * @returns {Object} - { isValid: boolean, errors: Array }
   */
  async validateFormData(formData, sectionId = null) {
    try {
      const errors = [];

      // Get all fields with their validation rules
      let query = `
        SELECT id, name, display_name, field_type, is_required, 
               validation_rules, options
        FROM form_fields
      `;

      const params = [];
      if (sectionId) {
        query += ' WHERE section_id = ?';
        params.push(sectionId);
      }

      const [fields] = await pool.query(query, params);

      // Create a map for quick field lookup
      const fieldsMap = new Map();
      fields.forEach(field => {
        fieldsMap.set(field.id.toString(), field);
      });

      // Validate each submitted field
      for (const [fieldId, value] of Object.entries(formData)) {
        const field = fieldsMap.get(fieldId);

        // Skip if field not found (might be a non-field value)
        if (!field) continue;

        // Convert value to string for validation
        const stringValue = value === null || value === undefined ? '' : String(value);

        // Check required validation
        if (field.is_required && (!stringValue || stringValue.trim() === '')) {
          errors.push({
            fieldId: field.id,
            fieldName: field.display_name,
            message: `${field.display_name} is required`,
            type: 'required'
          });
          continue; // Skip other validations if required check fails
        }

        // Skip further validation if field is empty and not required
        if (!stringValue || stringValue.trim() === '') {
          continue;
        }

        // Parse validation rules if they exist
        let validationRules = {};
        if (field.validation_rules) {
          try {
            validationRules = typeof field.validation_rules === 'string'
              ? JSON.parse(field.validation_rules)
              : field.validation_rules;
          } catch (e) {
            console.error(`Error parsing validation rules for field ${field.id}:`, e);
          }
        }

        // Validate based on field type and validation rules
        const fieldErrors = this.validateField(field, stringValue, validationRules);
        if (fieldErrors.length > 0) {
          errors.push(...fieldErrors);
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      console.error('Error in validation service:', error);
      throw error;
    }
  }

  /**
   * Validate a single field value
   * @param {Object} field - The field configuration
   * @param {string} value - The value to validate
   * @param {Object} validationRules - The validation rules
   * @returns {Array} - Array of error objects
   */
  validateField(field, value, validationRules) {
    const errors = [];

    // Ensure value is a string for string operations
    const stringValue = String(value);

    // Pattern validation
    if (validationRules.pattern) {
      // Strip ^ and $ if present (they're added automatically in HTML)
      let pattern = validationRules.pattern
        .replace(/^\^/, '')
        .replace(/\$$/, '');

      try {
        const regex = new RegExp(`^${pattern}$`);
        if (!regex.test(stringValue)) {
          errors.push({
            fieldId: field.id,
            fieldName: field.display_name,
            message: validationRules.message || `${field.display_name} does not match the required format`,
            type: 'pattern',
            pattern: validationRules.pattern
          });
        }
      } catch (e) {
        console.error(`Invalid regex pattern for field ${field.id}:`, e);
        errors.push({
          fieldId: field.id,
          fieldName: field.display_name,
          message: `Invalid validation pattern configured for ${field.display_name}`,
          type: 'pattern_error'
        });
      }
    }

    // Length validation
    if (validationRules.minLength && stringValue.length < validationRules.minLength) {
      errors.push({
        fieldId: field.id,
        fieldName: field.display_name,
        message: validationRules.message || `${field.display_name} must be at least ${validationRules.minLength} characters`,
        type: 'min_length',
        minLength: validationRules.minLength
      });
    }

    if (validationRules.maxLength && stringValue.length > validationRules.maxLength) {
      errors.push({
        fieldId: field.id,
        fieldName: field.display_name,
        message: validationRules.message || `${field.display_name} must be at most ${validationRules.maxLength} characters`,
        type: 'max_length',
        maxLength: validationRules.maxLength
      });
    }

    // Number validation (for number fields)
    if (field.field_type === 'number') {
      const numValue = parseFloat(value);

      if (isNaN(numValue)) {
        errors.push({
          fieldId: field.id,
          fieldName: field.display_name,
          message: `${field.display_name} must be a valid number`,
          type: 'number_format'
        });
      } else {
        if (validationRules.min !== undefined && numValue < validationRules.min) {
          errors.push({
            fieldId: field.id,
            fieldName: field.display_name,
            message: validationRules.message || `${field.display_name} must be at least ${validationRules.min}`,
            type: 'min_value',
            minValue: validationRules.min
          });
        }

        if (validationRules.max !== undefined && numValue > validationRules.max) {
          errors.push({
            fieldId: field.id,
            fieldName: field.display_name,
            message: validationRules.message || `${field.display_name} must be at most ${validationRules.max}`,
            type: 'max_value',
            maxValue: validationRules.max
          });
        }
      }
    }

    // Email validation (basic check for email fields without custom pattern)
    if (field.field_type === 'email' && !validationRules.pattern) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(stringValue)) {
        errors.push({
          fieldId: field.id,
          fieldName: field.display_name,
          message: `${field.display_name} must be a valid email address`,
          type: 'email_format'
        });
      }
    }

    // Date validation
    if (field.field_type === 'date') {
      const dateValue = new Date(value);

      if (isNaN(dateValue.getTime())) {
        errors.push({
          fieldId: field.id,
          fieldName: field.display_name,
          message: `${field.display_name} must be a valid date`,
          type: 'date_format'
        });
      } else {
        if (validationRules.minDate) {
          const minDate = new Date(validationRules.minDate);
          if (dateValue < minDate) {
            errors.push({
              fieldId: field.id,
              fieldName: field.display_name,
              message: validationRules.message || `${field.display_name} must be on or after ${validationRules.minDate}`,
              type: 'min_date',
              minDate: validationRules.minDate
            });
          }
        }

        if (validationRules.maxDate) {
          const maxDate = new Date(validationRules.maxDate);
          if (dateValue > maxDate) {
            errors.push({
              fieldId: field.id,
              fieldName: field.display_name,
              message: validationRules.message || `${field.display_name} must be on or before ${validationRules.maxDate}`,
              type: 'max_date',
              maxDate: validationRules.maxDate
            });
          }
        }
      }
    }

    return errors;
  }
}

module.exports = new ValidationService();

