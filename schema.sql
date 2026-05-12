-- Alaba Cluster Management Database Schema
-- Standard MySQL / MariaDB compatible

CREATE DATABASE IF NOT EXISTS alaba;
USE alaba;

-- 1. Administrative Users (Super Admins)
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    status ENUM('active', 'inactive', 'locked') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- 2. Service Tiers (Hosting Plans)
CREATE TABLE IF NOT EXISTS plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price_usd DECIMAL(10, 2) NOT NULL,
    specs JSON, 
    status ENUM('active', 'retired') DEFAULT 'active',
    disk_space_mb INT NOT NULL DEFAULT 0,
    bandwidth_mb INT NOT NULL DEFAULT 0,
    max_databases INT NOT NULL DEFAULT 0,
    max_db_users INT NOT NULL DEFAULT 0,
    max_email_accounts INT NOT NULL DEFAULT 0,
    max_ftp_accounts INT NOT NULL DEFAULT 0,
    max_addon_domains INT NOT NULL DEFAULT 0,
    max_subdomains INT NOT NULL DEFAULT 0,
    free_ssl TINYINT(1) DEFAULT 1,
    litespeed_enabled TINYINT(1) DEFAULT 0,
    redis_enabled TINYINT(1) DEFAULT 0,
    dedicated_ip_allowed TINYINT(1) DEFAULT 0,
    backups_enabled TINYINT(1) DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Customer Accounts
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    country VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Hosting Instances (Websites/Accounts)
CREATE TABLE IF NOT EXISTS hosting_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    domain VARCHAR(255) UNIQUE NOT NULL,
    user VARCHAR(100) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    ip VARCHAR(45),
    package VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    status_reason TEXT,
    manual_approved BOOLEAN DEFAULT FALSE,
    disk_usage FLOAT DEFAULT 0,
    disk_limit FLOAT DEFAULT 1024,
    bw_usage FLOAT DEFAULT 0,
    bw_limit FLOAT DEFAULT 100,
    ram_usage INT DEFAULT 0,
    ram_limit INT DEFAULT 1024,
    cpu_usage INT DEFAULT 0,
    cpu_limit INT DEFAULT 100,
    db_count INT DEFAULT 0,
    email_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 4.1 Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    subject VARCHAR(255) NOT NULL,
    department VARCHAR(100) DEFAULT 'General',
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    status ENUM('open', 'answered', 'customer-reply', 'closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    sender_type ENUM('customer', 'admin') NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

-- 5. Finance Records (Transactions & Invoices)
CREATE TABLE IF NOT EXISTS finance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id VARCHAR(50),
    domain VARCHAR(255),
    amount_paid DECIMAL(15, 2),
    vat DECIMAL(15, 2),
    transaction_fee DECIMAL(15, 2) DEFAULT 0,
    plan VARCHAR(100),
    next_renewal DATE,
    refund DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'NGN',
    customer_email VARCHAR(255),
    transaction_ref VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. DNS Zones
CREATE TABLE IF NOT EXISTS dns_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hosting_account_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV') NOT NULL,
    content TEXT NOT NULL,
    ttl INT DEFAULT 3600,
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id) ON DELETE CASCADE
);

-- 7. Global Settings & Exchange Rates
CREATE TABLE IF NOT EXISTS global_settings (
    id INT PRIMARY KEY DEFAULT 1,
    tawk_property_id VARCHAR(255),
    default_currency VARCHAR(5) DEFAULT 'USD',
    maintenance_mode BOOLEAN DEFAULT FALSE,
    vat_enabled BOOLEAN DEFAULT TRUE,
    vat_type ENUM('flat', 'percentage') DEFAULT 'percentage',
    vat_amount DECIMAL(15, 2) DEFAULT 7.50,
    fee_enabled BOOLEAN DEFAULT TRUE,
    fee_type ENUM('flat', 'percentage') DEFAULT 'percentage',
    fee_amount DECIMAL(15, 2) DEFAULT 1.50,
    nameservers JSON, 
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 8. Cluster Tasks (Provisioning Jobs)
CREATE TABLE IF NOT EXISTS background_tasks (
    id VARCHAR(100) PRIMARY KEY,
    type ENUM('provision', 'backup', 'migration', 'ssl_renew') NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    progress INT DEFAULT 0,
    payload JSON,
    error_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL
);

-- 9. IP Pool Management
CREATE TABLE IF NOT EXISTS ip_pool (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Database Management (Reserved keywords escaped)
CREATE TABLE IF NOT EXISTS `sql_databases` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  hosting_account_id INT NOT NULL,
  db_name VARCHAR(128) NOT NULL,
  mysql_db_name VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id)
);

CREATE TABLE IF NOT EXISTS database_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  hosting_account_id INT NOT NULL,
  db_user VARCHAR(128) NOT NULL,
  mysql_db_user VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id)
);

CREATE TABLE IF NOT EXISTS database_privileges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  database_id INT NOT NULL,
  db_user_id INT NOT NULL,
  privileges TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (database_id, db_user_id),
  FOREIGN KEY (database_id) REFERENCES `sql_databases`(id) ON DELETE CASCADE,
  FOREIGN KEY (db_user_id) REFERENCES database_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hosting_account_id INT NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'Standard',
    quota INT DEFAULT 5,
    usage_gb FLOAT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    aliases TEXT,
    forwarding VARCHAR(255),
    incoming_enabled BOOLEAN DEFAULT TRUE,
    outgoing_enabled BOOLEAN DEFAULT TRUE,
    restrict_inbox BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ssl_certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hosting_account_id INT NOT NULL,
    domain VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    issuer VARCHAR(255),
    type VARCHAR(50),
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'healthy',
    certificate_text TEXT,
    private_key_text TEXT,
    ca_bundle_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id) ON DELETE CASCADE
);

-- Seed Initial Data
INSERT IGNORE INTO global_settings (id, default_currency, nameservers) VALUES (1, 'USD', '["ns1.alaba.ng", "ns2.alaba.ng"]');

INSERT IGNORE INTO plans (name, price_usd, specs, disk_space_mb, bandwidth_mb, max_databases, max_email_accounts) VALUES 
('Standard Flow', 9.99, '["5GB NVMe", "10 Email IDs", "LiteSpeed"]', 5120, 10240, 5, 10),
('Premium Grid', 24.99, '["50GB NVMe", "Unlimited Mail", "Redis Cache"]', 51200, 102400, 20, 100),
('Alaba Node', 99.99, '["Dedicated vCPU", "WAF Protection", "VIP Support"]', 102400, 512000, 100, 500);

-- Initial IP Pool
INSERT IGNORE INTO ip_pool (ip_address) VALUES 
('192.168.1.100'), ('192.168.1.101'), ('192.168.1.102'), ('45.79.123.45'), ('45.79.123.46');

INSERT IGNORE INTO admins (full_name, email, password_hash) VALUES 
('NaiTalk Admin', 'info@naitalk.com', '$2b$10$placeholder_hash');
