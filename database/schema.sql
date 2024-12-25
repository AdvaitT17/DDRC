CREATE DATABASE IF NOT EXISTS ddrc;
USE ddrc;

-- Core user authentication table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin', 'service_provider') DEFAULT 'user',
    status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Dynamic form fields configuration (for admin to manage form structure)
CREATE TABLE form_sections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    section_name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE form_fields (
    id INT PRIMARY KEY AUTO_INCREMENT,
    section_id INT,
    field_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    field_type ENUM('text', 'number', 'date', 'select', 'radio', 'checkbox', 'file', 'textarea'),
    is_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    validation_rules JSON, -- Store validation rules as JSON
    options JSON, -- For dropdown/radio/checkbox options
    dependencies JSON, -- For conditional fields
    display_order INT NOT NULL,
    FOREIGN KEY (section_id) REFERENCES form_sections(id)
);

-- Store user's registration form data
CREATE TABLE user_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    gender ENUM('male', 'female', 'other'),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Store address information
CREATE TABLE user_addresses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    pincode VARCHAR(10),
    district VARCHAR(100),
    taluka VARCHAR(100),
    ward VARCHAR(100),
    sector VARCHAR(100),
    gram_panchayat VARCHAR(100),
    address_type ENUM('permanent', 'correspondence') DEFAULT 'permanent',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Store identification documents
CREATE TABLE user_documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    document_type VARCHAR(50),
    document_number VARCHAR(100),
    document_file_path VARCHAR(255),
    verified BOOLEAN DEFAULT false,
    verification_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Store financial information
CREATE TABLE user_financial_info (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE,
    bank_account_number VARCHAR(50),
    bank_name VARCHAR(100),
    bank_branch VARCHAR(100),
    ifsc_code VARCHAR(20),
    annual_income DECIMAL(12,2),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Store disability information
CREATE TABLE user_disability_info (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE,
    disability_type VARCHAR(100),
    certificate_number VARCHAR(50),
    certificate_date DATE,
    disability_percentage INT,
    chronic_illness TEXT,
    special_skills TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Store dynamic form responses
CREATE TABLE form_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    field_id INT,
    response_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (field_id) REFERENCES form_fields(id)
);

-- Store enumeration options
CREATE TABLE enum_options (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category VARCHAR(50) NOT NULL, -- e.g., 'district', 'disability_type'
    value VARCHAR(100) NOT NULL,
    parent_id INT, -- For hierarchical data like district->taluka
    is_active BOOLEAN DEFAULT true,
    display_order INT
); 