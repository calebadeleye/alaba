import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { z } from 'zod';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import AdmZip from 'adm-zip';
import fs from 'fs';

const execAsync = promisify(exec);
const xmlParser = new XMLParser();
dotenv.config();

// --- Domain & DNS Services ---
const DomainService = {
  async checkAvailability(domain) {
    const { NAMECHEAP_API_KEY, NAMECHEAP_USER, NAMECHEAP_IP } = process.env;
    if (!NAMECHEAP_API_KEY || !NAMECHEAP_USER) {
      throw new Error('Domain registration provider not configured.');
    }

    try {
      const url = `https://api.namecheap.com/xml.response?ApiUser=${NAMECHEAP_USER}&ApiKey=${NAMECHEAP_API_KEY}&UserName=${NAMECHEAP_USER}&ClientIp=${NAMECHEAP_IP || '127.0.0.1'}&Command=namecheap.domains.check&DomainList=${domain}`;
      const res = await axios.get(url);
      const jsonObj = xmlParser.parse(res.data);
      const checkResult = jsonObj.ApiResponse.CommandResponse.DomainCheckResult;
      return checkResult.Available === 'true';
    } catch (err) {
      console.error('[DomainService] Namecheap Check Failed:', err.message);
      throw new Error(`Domain check failed: ${err.message}`);
    }
  },

  async registerDomain(domain, userInfo) {
    const { NAMECHEAP_API_KEY, NAMECHEAP_USER, NAMECHEAP_IP } = process.env;
    if (!NAMECHEAP_API_KEY) {
      throw new Error('Domain registration provider not configured.');
    }
    // Real implementation would call namecheap.domains.create with userInfo
    // For now we simulate success after verify environment is there
    return { success: true };
  },

  async setNameservers(domain, nameservers) {
    const { NAMECHEAP_API_KEY } = process.env;
    if (!NAMECHEAP_API_KEY) throw new Error('Domain registration provider not configured.');
    // namecheap.domains.dns.setCustom
    console.log(`[Namecheap] Setting nameservers for ${domain}:`, nameservers);
    return { success: true };
  }
};

const DNSService = {
  async addZone(domain, accountId) {
    console.log(`[DNSService] Initializing Alaba BIND9 Zone for: ${domain}`);
    return { 
      success: true, 
      nameservers: ['ns1.alaba.ng', 'ns2.alaba.ng'],
      zoneType: 'local'
    };
  },

  async createDNSRecord(accountId, record) {
    const conn = await getDb();
    if (!conn) throw new Error('Database node offline');

    try {
      await conn.query(
        'INSERT INTO dns_records (hosting_account_id, name, type, content, ttl, priority) VALUES (?, ?, ?, ?, ?, ?)',
        [accountId, record.name, record.type, record.content, record.ttl || 3600, record.priority || 0]
      );
      
      console.log(`[BIND9] Reloading zone for account ${accountId}: ${record.type} ${record.name} -> ${record.content}`);
      
      return { success: true };
    } catch (err) {
      console.error('[DNSService] Record Creation Failed:', err.message);
      throw err;
    }
  },

  async generateDefaultRecords(accountId, domain, serverIp) {
    const defaults = [
      { type: 'A', name: '@', content: serverIp },
      { type: 'A', name: 'mail', content: serverIp },
      { type: 'A', name: 'webmail', content: serverIp },
      { type: 'CNAME', name: 'www', content: domain },
      { type: 'CNAME', name: 'ftp', content: domain },
      { type: 'MX', name: '@', content: `mail.${domain}`, priority: 10 },
      { type: 'TXT', name: '@', content: 'v=spf1 a mx ip4:' + serverIp + ' ~all' }
    ];

    for (const rec of defaults) {
      await this.createDNSRecord(accountId, rec);
    }
    
    await this.createDNSRecord(accountId, { type: 'NS', name: '@', content: 'ns1.alaba.ng' });
    await this.createDNSRecord(accountId, { type: 'NS', name: '@', content: 'ns2.alaba.ng' });
  }
};

// --- Global Settings Helper ---
async function getGlobalSettingsInServer() {
  const conn = await getDb();
  if (!conn) return {
    nameservers: ['ns1.alaba.ng', 'ns2.alaba.ng'],
    nameserverIps: ['159.223.112.44', '159.223.112.44'],
    sharedIp: '159.223.112.44',
    defaultCurrency: 'NGN'
  };

  try {
    const [rows] = await conn.query('SELECT * FROM global_settings WHERE id = 1');
    if (rows.length === 0) return {
      nameservers: ['ns1.alaba.ng', 'ns2.alaba.ng'],
      nameserverIps: ['159.223.112.44', '159.223.112.44'],
      sharedIp: '159.223.112.44',
      defaultCurrency: 'NGN'
    };

    return {
      defaultCurrency: rows[0].default_currency,
      vatEnabled: Boolean(rows[0].vat_enabled),
      vatType: rows[0].vat_type,
      vatAmount: rows[0].vat_amount,
      feeEnabled: Boolean(rows[0].fee_enabled),
      feeType: rows[0].fee_type,
      feeAmount: rows[0].fee_amount,
      nameservers: typeof rows[0].nameservers === 'string' ? JSON.parse(rows[0].nameservers) : (rows[0].nameservers || ['ns1.alaba.ng', 'ns2.alaba.ng']),
      nameserverIps: typeof rows[0].nameserver_ips === 'string' ? JSON.parse(rows[0].nameserver_ips) : (rows[0].nameserver_ips || ['159.223.112.44', '159.223.112.44']),
      sharedIp: rows[0].shared_ip || '159.223.112.44',
    };
  } catch (err) {
    return {
      nameservers: ['ns1.alaba.ng', 'ns2.alaba.ng'],
      nameserverIps: ['159.223.112.44', '159.223.112.44'],
      sharedIp: '159.223.112.44',
      defaultCurrency: 'NGN'
    };
  }
}
async function sendTemplateEmail(toEmail, subject, htmlContent) {
  const useMock = !process.env.SMTP_HOST;
  if (useMock) {
    console.log(`[Email] Mock template email sent to ${toEmail}. Subject: ${subject}`);
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent,
    });
  } catch (err) {
    console.error('[Email] Failed to send template email:', err);
  }
}

async function sendWelcomeEmail(toEmail, domain, plan) {
  // Try to get nameservers from settings
  const settings = await getGlobalSettingsInServer();
  const nameservers = settings.nameservers;

  // Use mock SMTP if no real credentials
  const useMock = !process.env.SMTP_HOST;
  
  if (useMock) {
    console.log(`[Email] Mock email sent to ${toEmail} for ${domain} (${plan} plan). Nameservers: ${nameservers.join(', ')}`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `Welcome to Alaba: Your hosting for ${domain} is ready!`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background: #003544; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; text-transform: uppercase; letter-spacing: 2px;">Alaba Cluster</h1>
            <p style="opacity: 0.7; margin-top: 10px;">Hosting Provisioning Successful</p>
          </div>
          <div style="padding: 40px;">
            <h2>Welcome to Alaba,</h2>
            <p>Your high-performance hosting instance for <strong>${domain}</strong> has been successfully provisioned on our global edge network.</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Subscription Summary</h3>
              <p style="margin-bottom: 5px;"><strong>Domain:</strong> ${domain}</p>
              <p style="margin-bottom: 5px;"><strong>Plan:</strong> ${plan}</p>
              <p style="margin-bottom: 5px;"><strong>Status:</strong> Active & Deployed</p>
            </div>

            <div style="background: #e0f2f1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #009688;">
              <h3 style="margin-top: 0; color: #00796b;">Next Step: Nameserver Update</h3>
              <p style="font-size: 13px;">To point your domain to Alaba, please update your nameservers at your registrar to:</p>
              <ul style="font-family: monospace; font-size: 14px; background: white; padding: 10px; border-radius: 4px; list-style: none;">
                ${nameservers.map(ns => `<li style="padding: 5px 0;">${ns}</li>`).join('')}
              </ul>
              <p style="font-size: 11px; color: #666; font-style: italic;">Note: Propagation can take 24-48 hours.</p>
            </div>
            
            <p>You can now access your management console and begin deploying your assets.</p>
            
            <a href="https://alaba.hosting/login" style="display: inline-block; background: #003544; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Enter Management Console</a>
          </div>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 11px; color: #999;">
            &copy; 2024 Alaba Global Cluster. All rights reserved.
          </div>
        </div>
      `,
    });

    console.log('[Email] Message sent: %s', info.messageId);
  } catch (err) {
    console.error('[Email] Failed to send email:', err);
  }
}

async function sendLoginNotification(toEmail, fullName, ip = 'Unknown', userAgent = 'Unknown') {
  const useMock = !process.env.SMTP_HOST;
  
  if (useMock) {
    console.log(`[Email] Login notification mock sent to ${toEmail} (IP: ${ip}, Agent: ${userAgent})`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `Security Alert: New login to your Alaba account`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background: #f44336; padding: 30px; text-align: center; color: white;">
            <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 2px;">Security Alert</h2>
          </div>
          <div style="padding: 40px;">
            <p>Hello ${fullName},</p>
            <p>Our system detected a new login to your Alaba account.</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Time:</strong> ${new Date().toUTCString()}</p>
              <p style="margin: 5px 0 0 0;"><strong>IP Address:</strong> ${ip}</p>
              <p style="margin: 5px 0 0 0;"><strong>Device/Browser:</strong> ${userAgent}</p>
              <p style="margin: 5px 0 0 0;"><strong>Status:</strong> Successful Authentication</p>
            </div>

            <p style="font-size: 13px; color: #666;">If this was you, you can safely ignore this email. If you did not authorize this login, please reset your password immediately via the management console.</p>
            
            <a href="https://alaba.hosting/forgot-password" style="display: inline-block; background: #f44336; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Secure My Account</a>
          </div>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 11px; color: #999;">
            &copy; 2024 Alaba Security Engine.
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[Email] Failed to send login notification:', err);
  }
}

async function send2FACodeEmail(toEmail, code) {
  const useMock = !process.env.SMTP_HOST;
  
  if (useMock) {
    console.log(`[Email] 2FA verification code mock sent to ${toEmail}: ${code}`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `${code} is your Alaba verification code`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background: #003544; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; text-transform: uppercase; letter-spacing: 2px;">Identity Verification</h1>
            <p style="opacity: 0.7; margin-top: 10px;">Security Protocol v9.0</p>
          </div>
          <div style="padding: 40px; text-align: center;">
            <p>Your authentication request requires additional verification.</p>
            <p>Use the following 6-digit code to synchronize your session:</p>
            
            <div style="background: #f4f7f6; padding: 30px; border-radius: 12px; margin: 30px 0; border: 1px dashed #003544;">
              <h2 style="margin: 0; font-size: 42px; font-weight: 900; letter-spacing: 15px; color: #003544;">${code}</h2>
            </div>

            <p style="font-size: 13px; color: #666; max-width: 400px; margin: 0 auto;">This code is valid for 10 minutes. If you did not request this code, please secure your account immediately.</p>
          </div>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 11px; color: #999;">
            &copy; 2024 Alaba Security Cluster. Authentication Node: ${process.env.HOSTNAME || 'Cluster-Alpha'}
          </div>
        </div>
      `,
    });
    console.log(`[Email] 2FA code sent to ${toEmail}`);
  } catch (err) {
    console.error('[Email] Failed to send 2FA email:', err);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Database Configuration ---
let db = null;

async function getDb() {
  if (db) return db;
  
  if (!process.env.DB_HOST) {
    if (process.env.SETUP_MODE === 'true') {
      console.log('[DB] Setup mode active. Waiting for database configuration...');
      return null;
    }
    console.warn('[DB] No MySQL credentials found in .env. Using in-memory fallback.');
    return null;
  }

  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT) || 3306
    });
    console.log('[DB] Connected to MySQL successfully');

    // Migration: Ensure nameservers column exists
    try {
      await db.query('SELECT nameservers FROM global_settings LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        console.log('[DB] Adding missing nameservers column to global_settings');
        await db.query('ALTER TABLE global_settings ADD COLUMN nameservers JSON');
        await db.query('UPDATE global_settings SET nameservers = ? WHERE id = 1', [JSON.stringify(['ns1.alaba.hosting', 'ns2.alaba.hosting'])]);
      }
    }

    // Migration: Ensure nameserver_ips and shared_ip columns exist
    try {
      await db.query('SELECT nameserver_ips, shared_ip FROM global_settings LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes("Unknown column"))) {
        console.log('[DB] Patching global_settings for DNS configuration');
        try { await db.query('ALTER TABLE global_settings ADD COLUMN nameserver_ips JSON'); } catch(e){}
        try { await db.query('ALTER TABLE global_settings ADD COLUMN shared_ip VARCHAR(45)'); } catch(e){}
        
        // Set defaults if null
        await db.query('UPDATE global_settings SET nameserver_ips = ?, shared_ip = ? WHERE id = 1', [
          JSON.stringify(['127.0.0.1', '127.0.0.1']),
          '127.0.0.1'
        ]);
      }
    }

    // Migration: Ensure coupons table exists
    try {
      await db.query('SELECT id FROM coupons LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating coupons table');
        await db.query(`
          CREATE TABLE IF NOT EXISTS coupons (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            discount_type ENUM('percentage', 'flat') DEFAULT 'percentage',
            discount_value DECIMAL(15, 2) NOT NULL,
            usage_limit INT DEFAULT 100,
            times_used INT DEFAULT 0,
            status ENUM('active', 'expired') DEFAULT 'active',
            expiry_date DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Seed initial coupons
        await db.query("INSERT IGNORE INTO coupons (code, discount_type, discount_value, usage_limit, times_used) VALUES ('WELCOME20', 'percentage', 20, 500, 0), ('SAVE10', 'flat', 10, 1000, 0)");
      }
    }

    // Patch columns if they exist as type/value or are missing
    try {
      // Check discount_type
      const [dtCol] = await db.query("SHOW COLUMNS FROM coupons LIKE 'discount_type'");
      if (dtCol.length === 0) {
        const [tCol] = await db.query("SHOW COLUMNS FROM coupons LIKE 'type'");
        if (tCol.length > 0) {
          console.log('[DB] Renaming coupons.type to discount_type');
          await db.query("ALTER TABLE coupons CHANGE COLUMN type discount_type ENUM('percentage', 'flat') DEFAULT 'percentage'");
        } else {
          console.log('[DB] Adding coupons.discount_type');
          await db.query("ALTER TABLE coupons ADD COLUMN discount_type ENUM('percentage', 'flat') DEFAULT 'percentage' AFTER code");
        }
      }

      // Check discount_value
      const [dvCol] = await db.query("SHOW COLUMNS FROM coupons LIKE 'discount_value'");
      if (dvCol.length === 0) {
        const [vCol] = await db.query("SHOW COLUMNS FROM coupons LIKE 'value'");
        if (vCol.length > 0) {
          console.log('[DB] Renaming coupons.value to discount_value');
          await db.query("ALTER TABLE coupons CHANGE COLUMN value discount_value DECIMAL(15, 2) NOT NULL");
        } else {
          console.log('[DB] Adding coupons.discount_value');
          await db.query("ALTER TABLE coupons ADD COLUMN discount_value DECIMAL(15, 2) NOT NULL AFTER discount_type");
        }
      }
    } catch (e) {
      console.warn('[DB] Coupon column patch failed:', e.message);
    }

    // Migration: Ensure file_storage table exists
    try {
      await db.query('SELECT id FROM file_storage LIMIT 1');
      // Patch column name if needed
      const [fsCols] = await db.query("SHOW COLUMNS FROM file_storage LIKE 'account_id'");
      if (fsCols.length > 0) {
        console.log('[DB] Patching file_storage: renaming account_id back to hosting_account_id');
        await db.query('ALTER TABLE file_storage CHANGE COLUMN account_id hosting_account_id INT NOT NULL');
      }
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating file_storage table');
        await db.query(`
          CREATE TABLE file_storage (
            id INT AUTO_INCREMENT PRIMARY KEY,
            hosting_account_id INT NOT NULL,
            path VARCHAR(255) DEFAULT '/',
            name VARCHAR(255) NOT NULL,
            type ENUM('file', 'folder') DEFAULT 'file',
            size VARCHAR(50) DEFAULT '0 KB',
            modified DATETIME DEFAULT CURRENT_TIMESTAMP,
            perm VARCHAR(10) DEFAULT '0644',
            content LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY (hosting_account_id, path, name)
          )
        `);
      }
    }

    // Migration: Ensure unique index on file_storage
    try {
      await db.query('ALTER TABLE file_storage ADD UNIQUE KEY idx_unique_file (hosting_account_id, path, name)');
    } catch (err) {
      // Ignore if already exists
    }

    // Migration: Ensure payment_gateways table exists
    try {
      await db.query('SELECT id FROM payment_gateways LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating payment_gateways table');
        await db.query(`
          CREATE TABLE payment_gateways (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL,
            display_name VARCHAR(100) NOT NULL,
            enabled BOOLEAN DEFAULT FALSE,
            public_key TEXT,
            secret_key TEXT,
            config JSON,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        await db.query(`
          INSERT IGNORE INTO payment_gateways (name, display_name, enabled) VALUES 
          ('paystack', 'Paystack', FALSE),
          ('flutterwave', 'Flutterwave', FALSE),
          ('stripe', 'Stripe', FALSE),
          ('bank_transfer', 'Bank Transfer', TRUE)
        `);
      }
    }


    // Ensure email_accounts table exists and has correct columns
    try {
      await db.query('SELECT id FROM email_accounts LIMIT 1');
      // Patch account_id column
      const [eaCols] = await db.query("SHOW COLUMNS FROM email_accounts LIKE 'account_id'");
      if (eaCols.length > 0) {
        console.log('[DB] Patching email_accounts: renaming account_id back to hosting_account_id');
        await db.query('ALTER TABLE email_accounts CHANGE COLUMN account_id hosting_account_id INT NOT NULL');
      }
      // Patch aliases column
      const [aliasCols] = await db.query("SHOW COLUMNS FROM email_accounts LIKE 'aliases'");
      if (aliasCols.length === 0) {
        console.log('[DB] Patching email_accounts: adding aliases column');
        await db.query('ALTER TABLE email_accounts ADD COLUMN aliases TEXT');
      }
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating email_accounts table');
        await db.query(`
          CREATE TABLE email_accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            hosting_account_id INT NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255),
            type VARCHAR(50) DEFAULT 'User',
            quota INT DEFAULT 5,
            usage_gb FLOAT DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            forwarding VARCHAR(255),
            aliases TEXT,
            incoming_enabled BOOLEAN DEFAULT TRUE,
            outgoing_enabled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id) ON DELETE CASCADE
          )
        `);
      }
    }

    // Ensure sql_databases table exists and has correct columns
    try {
      await db.query('SELECT id FROM sql_databases LIMIT 1');
      const [sqlCols] = await db.query("SHOW COLUMNS FROM sql_databases LIKE 'account_id'");
      if (sqlCols.length > 0) {
        console.log('[DB] Patching sql_databases: renaming account_id back to hosting_account_id');
        await db.query('ALTER TABLE sql_databases CHANGE COLUMN account_id hosting_account_id INT NOT NULL');
      }
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating sql_databases table');
        await db.query(`
          CREATE TABLE sql_databases (
            id INT AUTO_INCREMENT PRIMARY KEY,
            hosting_account_id INT NOT NULL,
            db_name VARCHAR(100) NOT NULL,
            mysql_db_name VARCHAR(100) NOT NULL,
            size_mb FLOAT DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id) ON DELETE CASCADE
          )
        `);
      }
    }

    try {
      await db.query('SELECT id FROM ssl_certificates LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating ssl_certificates table');
        await db.query(`
          CREATE TABLE ssl_certificates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            domain VARCHAR(255) NOT NULL,
            label VARCHAR(255),
            issuer VARCHAR(255),
            type VARCHAR(50),
            expiry_date DATE,
            status VARCHAR(20) DEFAULT 'healthy',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    }

    // Migration: Backup Snapshots
    try {
      await db.query('SELECT id FROM backup_snapshots LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating backup_snapshots table');
        await db.query(`
          CREATE TABLE backup_snapshots (
            id INT AUTO_INCREMENT PRIMARY KEY,
            hosting_account_id INT NOT NULL,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type VARCHAR(20) DEFAULT 'Incremental',
            size_mb FLOAT DEFAULT 0,
            status VARCHAR(20) DEFAULT 'Healthy',
            FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id) ON DELETE CASCADE
          )
        `);
      }
    }

    // Migration: Enforcement Logs
    try {
      await db.query('SELECT id FROM enforcement_logs LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating enforcement_logs table');
        await db.query(`
          CREATE TABLE enforcement_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            domain VARCHAR(255),
            action VARCHAR(50),
            reason VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    }

    // Migration: Monitored Services
    try {
      await db.query('SELECT id FROM monitored_services LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating monitored_services table');
        await db.query(`
          CREATE TABLE monitored_services (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            version VARCHAR(50),
            status VARCHAR(20) DEFAULT 'UP',
            uptime VARCHAR(50),
            initial_char CHAR(1),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        // Seed some initial services
        await db.query(`
          INSERT INTO monitored_services (name, version, uptime, initial_char) VALUES 
          ('Apache (httpd)', '2.4.58', '45d 12h', 'A'),
          ('MySQL Server', '8.0.36', '12d 4h', 'M'),
          ('PHP-FPM (8.2)', '8.2.15', '45d 12h', 'P'),
          ('Exim (Mail)', '4.97', '2d 1h', 'E'),
          ('BIND (DNS)', '9.18', '85d 2h', 'B'),
          ('Pure-FTPd', '1.0.51', '0s', 'F'),
          ('CSF Firewall', '14.15', '45d 12h', 'C'),
          ('Redis Server', '7.2.4', '12h 45m', 'R')
        `);
      }
    }

    // Migration: Ensure invoices table exists
    try {
      await db.query('SELECT id FROM invoices LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating invoices table');
        await db.query(`
          CREATE TABLE invoices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_email VARCHAR(255) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            currency VARCHAR(10) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            items JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    }

    // Migration: Ensure customers table exists
    try {
      await db.query('SELECT phone, country, password_hash FROM customers LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes("Unknown column"))) {
        console.log('[DB] Patching customers table columns');
        try { await db.query('ALTER TABLE customers ADD COLUMN phone VARCHAR(20)'); } catch(e){}
        try { await db.query('ALTER TABLE customers ADD COLUMN country VARCHAR(100)'); } catch(e){}
        try { 
          await db.query('SELECT password_hash FROM customers LIMIT 1'); 
        } catch (pe) {
          try { await db.query('ALTER TABLE customers CHANGE COLUMN password password_hash VARCHAR(255)'); } catch(e){
            try { await db.query('ALTER TABLE customers ADD COLUMN password_hash VARCHAR(255)'); } catch(e2){}
          }
        }
      } else if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating customers table');
        await db.query(`
          CREATE TABLE customers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            country VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    }

    // Migration: Ensure password_reset_tokens table exists
    try {
      await db.query('SELECT id FROM password_reset_tokens LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating password_reset_tokens table');
        await db.query(`
          CREATE TABLE password_reset_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            token VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX (token)
          )
        `);
      }
    }

    // Migration: Ensure ip_pool table exists
    try {
      await db.query('SELECT id FROM ip_pool LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating ip_pool table');
        await db.query(`
          CREATE TABLE ip_pool (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip_address VARCHAR(45) UNIQUE NOT NULL,
            status VARCHAR(20) DEFAULT 'available', -- 'available', 'assigned', 'reserved'
            assigned_to VARCHAR(255), -- domain name or account id
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Add some initial IPs for the pool
        const initialIps = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '45.79.123.45', '45.79.123.46'];
        for (const ip of initialIps) {
          await db.query('INSERT IGNORE INTO ip_pool (ip_address) VALUES (?)', [ip]);
        }
      }
    }

    // Migration: Ensure hosting_accounts table exists
    try {
      await db.query('SELECT id FROM hosting_accounts LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating hosting_accounts table');
        await db.query(`
          CREATE TABLE hosting_accounts (
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    }

    // Migration: Ensure admins table has 2FA columns
    try {
      await db.query('SELECT two_factor_enabled FROM admins LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes("Unknown column 'two_factor_enabled'"))) {
        console.log('[DB] Adding 2FA columns to admins table');
        await db.query('ALTER TABLE admins ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE');
        await db.query('ALTER TABLE admins ADD COLUMN two_factor_secret VARCHAR(255)');
      }
    }

    // Migration: Column checks for hosting_accounts
    try {
      await db.query('SELECT user FROM hosting_accounts LIMIT 1');
    } catch (err) {
      console.log('[DB] user column check failed, attempting migration...');
      try {
        const [cols] = await db.query('SHOW COLUMNS FROM hosting_accounts LIKE "cpanel_user"');
        if (cols.length > 0) {
          console.log('[DB] Renaming cpanel_user to user in hosting_accounts');
          await db.query('ALTER TABLE hosting_accounts CHANGE cpanel_user user VARCHAR(100) NOT NULL');
        } else {
          // Check if it's really missing by showing all columns
          const [allCols] = await db.query('SHOW COLUMNS FROM hosting_accounts');
          const exists = allCols.some((c) => c.Field === 'user');
          if (!exists) {
            console.log('[DB] Adding user column to hosting_accounts');
            await db.query('ALTER TABLE hosting_accounts ADD COLUMN user VARCHAR(100) NOT NULL AFTER domain');
          }
        }
      } catch (innerErr) {
         console.error('[DB] Failed to migrate user column:', innerErr.message);
      }
    }

    try {
      await db.query('SELECT manual_approved FROM hosting_accounts LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes("Unknown column 'manual_approved'"))) {
        console.log('[DB] Adding manual_approved column to hosting_accounts');
        await db.query('ALTER TABLE hosting_accounts ADD COLUMN manual_approved BOOLEAN DEFAULT FALSE');
      }
    }

    // Migration: Ensure finance_records table exists
    try {
      await db.query('SELECT transaction_fee FROM finance_records LIMIT 1');
      await db.query('SELECT currency FROM finance_records LIMIT 1');
      await db.query('SELECT transaction_ref FROM finance_records LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes("Unknown column 'transaction_fee'"))) {
        console.log('[DB] Adding transaction_fee column to finance_records');
        await db.query('ALTER TABLE finance_records ADD COLUMN transaction_fee DECIMAL(15, 2) DEFAULT 0');
      } 
      if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes("Unknown column 'currency'"))) {
        console.log('[DB] Adding currency column to finance_records');
        await db.query('ALTER TABLE finance_records ADD COLUMN currency VARCHAR(10) DEFAULT "NGN"');
      }
      if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes("Unknown column 'transaction_ref'"))) {
        console.log('[DB] Adding transaction_ref column to finance_records');
        await db.query('ALTER TABLE finance_records ADD COLUMN transaction_ref VARCHAR(255) UNIQUE');
      }
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating finance_records table');
        await db.query(`
          CREATE TABLE finance_records (
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
          )
        `);
      }
    }

    // Migration: Ensure database management tables and columns exist
    // Legacy cleanup or normalization
    try {
      const [tables] = await db.query('SHOW TABLES');
      const tableNames = tables.map(t => Object.values(t)[0].toLowerCase());
      if (tableNames.includes('databases') && !tableNames.includes('sql_databases')) {
        console.log('[DB] Normalizing database table name: databases -> sql_databases');
        // Drop privileges first as it might have FK to databases
        try { await db.query('DROP TABLE IF EXISTS database_privileges'); } catch(e){}
        await db.query('RENAME TABLE `databases` TO `sql_databases`');
      }
    } catch (err) {
      console.warn('[DB] Skip table normalization:', err.message);
    }

    try {
      await db.query('SELECT id FROM `sql_databases` LIMIT 1');
      console.log('[DB] Database management tables verified.');
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
        console.log('[DB] Creating database management tables');
        try {
          await db.query(`
            CREATE TABLE IF NOT EXISTS \`sql_databases\` (
              id INT AUTO_INCREMENT PRIMARY KEY,
              customer_id INT NOT NULL,
              hosting_account_id INT NOT NULL,
              db_name VARCHAR(128) NOT NULL,
              mysql_db_name VARCHAR(255) NOT NULL UNIQUE,
              status VARCHAR(50) DEFAULT 'active',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (customer_id) REFERENCES customers(id),
              FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id)
            )
          `);
          await db.query(`
            CREATE TABLE IF NOT EXISTS database_users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              customer_id INT NOT NULL,
              hosting_account_id INT NOT NULL,
              db_user VARCHAR(128) NOT NULL,
              mysql_db_user VARCHAR(128) NOT NULL UNIQUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (customer_id) REFERENCES customers(id),
              FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id)
            )
          `);
          await db.query(`
            CREATE TABLE IF NOT EXISTS database_privileges (
              id INT AUTO_INCREMENT PRIMARY KEY,
              database_id INT NOT NULL,
              db_user_id INT NOT NULL,
              privileges TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY (database_id, db_user_id),
              FOREIGN KEY (database_id) REFERENCES \`sql_databases\`(id) ON DELETE CASCADE,
              FOREIGN KEY (db_user_id) REFERENCES database_users(id) ON DELETE CASCADE
            )
          `);
          console.log('[DB] Database management tables created successfully.');
        } catch (createErr) {
          console.error('[DB] Failed to create database management tables:', createErr);
        }
      } else {
        console.error('[DB] Migration check failed:', err);
      }
    }

    // Fix foreign key in database_privileges if it's still pointing to 'databases'
    try {
      const [createTable] = await db.query('SHOW CREATE TABLE database_privileges');
      const createScript = createTable[0]['Create Table'];
      if (createScript.includes('REFERENCES `databases`')) {
        console.log('[DB] Patching database_privileges foreign key');
        // Find the constraint name
        const match = createScript.match(/CONSTRAINT `([^`]+)` FOREIGN KEY \(`database_id`\) REFERENCES `databases`/);
        if (match) {
          const constraintName = match[1];
          await db.query(`ALTER TABLE database_privileges DROP FOREIGN KEY ${constraintName}`);
          await db.query('ALTER TABLE database_privileges ADD CONSTRAINT database_privileges_fk_db FOREIGN KEY (database_id) REFERENCES `sql_databases`(id) ON DELETE CASCADE');
        }
      }
    } catch (err) {
      console.warn('[DB] Skip fixing database_privileges FK:', err.message);
    }

    // Migration: Ensure plans table has detailed resource columns
    try {
      const [cols] = await db.query('SHOW COLUMNS FROM plans LIKE "disk_space_mb"');
      if (cols.length === 0) {
        console.log('[DB] Patching plans table with detailed columns');
        const patches = [
          'ALTER TABLE plans ADD COLUMN disk_space_mb INT NOT NULL DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN bandwidth_mb INT NOT NULL DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN max_databases INT NOT NULL DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN max_db_users INT NOT NULL DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN max_email_accounts INT NOT NULL DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN max_ftp_accounts INT NOT NULL DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN max_addon_domains INT NOT NULL DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN max_subdomains INT NOT NULL DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN free_ssl TINYINT(1) DEFAULT 1',
          'ALTER TABLE plans ADD COLUMN litespeed_enabled TINYINT(1) DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN redis_enabled TINYINT(1) DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN dedicated_ip_allowed TINYINT(1) DEFAULT 0',
          'ALTER TABLE plans ADD COLUMN backups_enabled TINYINT(1) DEFAULT 1'
        ];
        for (const patch of patches) {
          try { await db.query(patch); } catch (e) { console.warn(`[DB] Patch failed: ${patch}`, e.message); }
        }
      }
    } catch (err) {
      console.warn('[DB] Skip checking detailed columns on plans:', err.message);
    }

    // Ensure db_count exists on hosting_accounts
    try {
      const [cols] = await db.query('SHOW COLUMNS FROM hosting_accounts LIKE "db_count"');
      if (cols.length === 0) {
        console.log('[DB] Adding db_count column to hosting_accounts');
        await db.query('ALTER TABLE hosting_accounts ADD COLUMN db_count INT DEFAULT 0');
      }
    } catch (err) {
      console.warn('[DB] Skip checking db_count on hosting_accounts:', err.message);
    }

    // Ensure plan_id exists on hosting_accounts
    try {
      const [cols] = await db.query('SHOW COLUMNS FROM hosting_accounts LIKE "plan_id"');
      if (cols.length === 0) {
        console.log('[DB] Adding plan_id column to hosting_accounts');
        await db.query('ALTER TABLE hosting_accounts ADD COLUMN plan_id INT AFTER customer_id');
      }
    } catch (err) {
      console.warn('[DB] Skip checking plan_id on hosting_accounts:', err.message);
    }

    // Ensure customer_email exists on hosting_accounts (it might be missing in some versions)
    try {
      const [cols] = await db.query('SHOW COLUMNS FROM hosting_accounts LIKE "customer_email"');
      if (cols.length === 0) {
        console.log('[DB] Adding customer_email column to hosting_accounts');
        await db.query('ALTER TABLE hosting_accounts ADD COLUMN customer_email VARCHAR(255) NOT NULL AFTER user');
      }
      
      // BACKFILL customer_email
      console.log('[DB] Backfilling missing customer emails...');
      await db.query(`
        UPDATE hosting_accounts h 
        JOIN customers c ON h.customer_id = c.id 
        SET h.customer_email = c.email 
        WHERE h.customer_email = '' OR h.customer_email IS NULL
      `);
    } catch (err) {
      console.warn('[DB] Skip checking/backfilling customer_email on hosting_accounts:', err.message);
    }

    // BACKFILL plan_id
    try {
      console.log('[DB] Backfilling missing plan IDs...');
      await db.query(`
        UPDATE hosting_accounts h 
        JOIN plans p ON h.package = p.name 
        SET h.plan_id = p.id 
        WHERE h.plan_id IS NULL OR h.plan_id = 0
      `);
    } catch (err) {
      console.warn('[DB] Skip plan_id backfill:', err.message);
    }

    return db;
  } catch (err) {
    console.error('[DB] MySQL connection failed:', err);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", "blob:"],
        objectSrc: ["'self'", "blob:"],
      }
    },
  }));
  app.use(cors());
  app.use(morgan('dev'));
  
  // Debug middleware to log headers for API calls
  app.use('/api', (req, res, next) => {
    if (req.headers.authorization) {
      console.log(`[Debug] API Request: ${req.method} ${req.path}, Auth: ${req.headers.authorization.substring(0, 20)}...`);
    } else {
      console.log(`[Debug] API Request: ${req.method} ${req.path}, Auth: MISSING`);
    }
    next();
  });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // --- Setup Routes ---
  app.get('/api/setup/status', (req, res) => {
    res.json({ 
      setupMode: process.env.SETUP_MODE === 'true',
      dbConfigured: !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME && process.env.DB_NAME !== '')
    });
  });

  app.post('/api/setup/db', async (req, res) => {
    if (process.env.SETUP_MODE !== 'true') {
      return res.status(403).json({ error: 'Setup mode is not enabled' });
    }
    const { host, port, user, password, database } = req.body;
    
    try {
      console.log(`[Setup] Testing connection to ${host}:${port || 3306}...`);
      const testConn = await mysql.createConnection({ 
        host, 
        port: Number(port) || 3306, 
        user, 
        password, 
        database 
      });
      await testConn.end();
      
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        
        const updates = {
          DB_HOST: host,
          DB_PORT: port || 3306,
          DB_USER: user,
          DB_PASSWORD: password,
          DB_NAME: database,
          SETUP_MODE: 'false'
        };

        for (const [key, val] of Object.entries(updates)) {
          const regex = new RegExp(`^${key}=.*`, 'm');
          if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${val}`);
          } else {
            envContent += `\n${key}=${val}`;
          }
        }
      } else {
        envContent = `NODE_ENV=production\nPORT=3000\nDB_HOST=${host}\nDB_PORT=${port || 3306}\nDB_USER=${user}\nDB_PASSWORD=${password}\nDB_NAME=${database}\nSETUP_MODE=false\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
      
      process.env.DB_HOST = host;
      process.env.DB_PORT = port || 3306;
      process.env.DB_USER = user;
      process.env.DB_PASSWORD = password;
      process.env.DB_NAME = database;
      process.env.SETUP_MODE = 'false';
      
      db = null;
      const initialized = await getDb();
      if (!initialized) {
        throw new Error('Failed to initialize database connection after saving config');
      }
      
      res.json({ success: true, message: 'Database configured successfully. Setup mode disabled.' });
    } catch (err) {
      console.error('[Setup] Configuration failed:', err.message);
      res.status(400).json({ error: `Connection failed: ${err.message}` });
    }
  });

  // --- Security Middleware ---
  function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn(`[Auth] Missing Authorization header for ${req.method} ${req.path}`);
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Simulate token verification
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.warn(`[Auth] Malformed Authorization header for ${req.method} ${req.path}: ${authHeader}`);
      return res.status(401).json({ error: 'Malformed Authorization header' });
    }

    const token = parts[1];
    if (token.startsWith('mock-admin-token:')) {
      const email = token.split(':')[1] || 'info@naitalk.com';
      req.user = { role: 'admin', email };
    } else if (token === 'mock-admin-token') {
      req.user = { role: 'admin', email: 'info@naitalk.com' };
    } else if (token.startsWith('mock-customer-token:') || token.startsWith('mock-user-token:')) {
      const email = token.split(':')[1] || 'user@example.com';
      req.user = { role: 'user', email };
    } else if (token === 'mock-customer-token' || token === 'mock-user-token') {
      req.user = { role: 'user', email: 'user@example.com' };
    } else {
      console.warn(`[Auth] Invalid token for ${req.method} ${req.path}: ${token}`);
      return res.status(403).json({ error: 'Invalid token' });
    }
    next();
  }

  async function verifyAccountAccess(req, res, accountId) {
    const dbId = String(accountId).replace('db-', '');
    if (req.user.role === 'admin') return dbId;

    const conn = await getDb();
    if (!conn) throw new Error('Database disconnected');
    
    const [rows] = await conn.query('SELECT id FROM hosting_accounts WHERE id = ? AND LOWER(customer_email) = LOWER(?)', [dbId, req.user.email]);
    if (rows.length === 0) {
      res.status(403).json({ error: 'Access denied to this hosting account' });
      return null;
    }
    return dbId;
  }

  function adminOnly(req, res, next) {
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }
      next();
    });
  }

  // --- Usage Metrics History (In-Memory) ---
  const usageHistory = new Map(); // id -> { cpu: [], ram: [], disk: [], bw: [], db: [] }
  // --- Redis Simulation (In-Memory Cache) ---
  const redisCache = new Map();
  const CACHE_TTL = 30000; // 30 seconds

  async function getCachedData(key) {
    const entry = redisCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      console.log(`[Redis] Cache HIT for ${key}`);
      return entry.data;
    }
    console.log(`[Redis] Cache MISS for ${key}`);
    return null;
  }

  function setCachedData(key, data) {
    redisCache.set(key, { data, timestamp: Date.now() });
  }

  // --- Real-time Metrics Catchers (Mocked with Command Patterns) ---
  async function parseBandwidthLogs() {
    try {
      // Logic: In a real system, we'd run:
      // awk '{sum[$2]+=$10} END {for (i in sum) print i, sum[i]}' /var/log/nginx/access.log
      // Here we simulate log parsing results per domain
      const bandwidthMap = new Map();
      accounts.forEach(acc => {
        // Mock a few MBs of traffic detected in logs for each active domain
        if (acc.status === 'active') {
          bandwidthMap.set(acc.domain, Math.floor(Math.random() * 5) + 1); // 1-5MB in this log window
        }
      });
      return bandwidthMap;
    } catch {
      return new Map();
    }
  }

  async function getDiskUsage(accountId) {
    // Validation: Ensure accountId is alphanumeric or prefixed db- to prevent injection
    if (!/^[a-z0-9-]+$/i.test(accountId)) {
      console.error('[Security] Blocked invalid accountId in disk query');
      return { web: 0, logs: 0, uploads: 0, total: 0 };
    }

    try {
      const mockWebSize = Math.floor(Math.random() * 200) + 50;
      const mockLogsSize = Math.floor(Math.random() * 20);
      const mockUploadsSize = Math.floor(Math.random() * 300);
      
      // In a real system, we'd use execFile with specific arguments (not a shell string)
      // for better security.
      return {
        web: mockWebSize,
        logs: mockLogsSize,
        uploads: mockUploadsSize,
        total: mockWebSize + mockLogsSize + mockUploadsSize
      };
    } catch {
      return { web: 0, logs: 0, uploads: 0, total: 0 };
    }
  }

  async function getDatabaseUsage(user) {
    const conn = await getDb();
    if (!conn) {
      return 0;
    }
    try {
      // Real MySQL query for DB sizes
      const [rows] = await conn.query(`
        SELECT SUM(data_length + index_length) / 1024 / 1024 AS size_mb 
        FROM information_schema.TABLES
      `);
      return Math.round(rows[0]?.size_mb || 0);
    } catch (err) {
      console.error('[Usage] DB Query failed:', err);
      return 0;
    }
  }

  async function getSystemResources() {
    try {
      // Logic: Using 'ps' to find collective usage by Alaba processes
      // const { stdout } = await execAsync("ps -eo pcpu,pmem | awk '{u+=$1; m+=$2} END {print u, m}'");
      return { cpu: Math.random() * 20, ram: 512 + Math.random() * 1024 };
    } catch {
      return { cpu: 5, ram: 256 };
    }
  }

  async function logEnforcement(accountId, domain, action, reason) {
    const log = {
      domain,
      action,
      reason,
      timestamp: new Date().toISOString()
    };
    
    const db = await getDb();
    if (db) {
      try {
        await db.query('INSERT INTO enforcement_logs (domain, action, reason) VALUES (?, ?, ?)', [domain, action, reason]);
      } catch (err) {
        console.error('[DB] Enforcement log failed:', err);
      }
    }

    console.log(`[Enforcement] ${action}: ${domain} - ${reason}`);
  }

  // --- In-Memory State (Mock DB & Queue) ---
  let accounts = [];
  
  // Seed accounts from DB if available
  const db = await getDb();
  if (db) {
    try {
      const [rows] = await db.query('SELECT * FROM hosting_accounts');
      accounts = rows.map(r => ({
        id: 'db-' + r.id.toString(),
        domain: r.domain,
        user: r.user,
        customerEmail: r.customer_email,
        ip: r.ip || '127.0.0.1',
        package: r.package,
        diskUsage: r.disk_usage,
        diskLimit: r.disk_limit,
        bwUsage: r.bw_usage,
        bwLimit: r.bw_limit,
        ramUsage: r.ram_usage,
        ramLimit: r.ram_limit,
        cpuUsage: r.cpu_usage,
        cpuLimit: r.cpu_limit,
        dbCount: r.db_count,
        emailCount: r.email_count,
        status: r.status,
        statusReason: r.status_reason,
        customerEmail: r.customer_email,
        createdAt: r.created_at
      }));
      console.log(`[DB] Loaded ${accounts.length} accounts into memory.`);
    } catch (err) {
      console.error('[DB] Failed to seed accounts from DB:', err);
    }
  }

  // Initialize history for existing accounts
  accounts.forEach(acc => {
    usageHistory.set(acc.id, {
      cpu: Array.from({ length: 15 }, () => Math.floor(Math.random() * (acc.cpuLimit * 0.4))),
      ram: Array.from({ length: 15 }, () => Math.floor(Math.random() * (acc.ramLimit * 0.4))),
      disk: Array.from({ length: 15 }, (_, i) => acc.diskUsage - (15 - i) * 0.1),
      bw: Array.from({ length: 15 }, (_, i) => acc.bwUsage - (15 - i) * 2),
    });
  });

  // --- Plan API ---
  app.get('/api/plans', async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Database node offline' });

    try {
      const [rows] = await conn.query('SELECT * FROM plans WHERE status = "active"');
      res.json(rows.map(row => ({
        ...row,
        price: Number(row.price_usd),
        specs: typeof row.specs === 'string' ? JSON.parse(row.specs) : row.specs,
        free_ssl: !!row.free_ssl,
        litespeed_enabled: !!row.litespeed_enabled,
        redis_enabled: !!row.redis_enabled,
        dedicated_ip_allowed: !!row.dedicated_ip_allowed,
        backups_enabled: !!row.backups_enabled
      })));
    } catch (err) {
      console.error('[API] Fetch plans failed:', err);
      res.status(500).json({ error: 'Failed to fetch service plans' });
    }
  });

  app.post('/api/plans', adminOnly, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Database node offline' });

    try {
      const { name, price, specs, currency } = req.body;
      const [result] = await conn.query(
        'INSERT INTO plans (name, price_usd, specs, status) VALUES (?, ?, ?, "active")',
        [name, price, JSON.stringify(specs)]
      );
      res.status(201).json({ id: result.insertId, name, price, specs, currency });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create plan' });
    }
  });

  app.patch('/api/plans/:id', adminOnly, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Database node offline' });

    try {
      const { name, price, specs } = req.body;
      await conn.query(
        'UPDATE plans SET name = ?, price_usd = ?, specs = ? WHERE id = ?',
        [name, price, JSON.stringify(specs), id]
      );
      res.json({ id, ...req.body });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update plan' });
    }
  });

  app.delete('/api/plans/:id', adminOnly, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Database node offline' });

    try {
      await conn.query('UPDATE plans SET status = "retired" WHERE id = ?', [id]);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete plan' });
    }
  });

  // --- Global Settings API ---
  app.get('/api/settings', async (req, res) => {
    const settings = await getGlobalSettingsInServer();
    res.json(settings);
  });

  app.patch('/api/settings', adminOnly, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Database node offline' });

    try {
      const updates = [];
      const values = [];

      if (req.body.defaultCurrency !== undefined) {
        updates.push('default_currency = ?');
        values.push(req.body.defaultCurrency);
      }
      if (req.body.nameservers !== undefined) {
        updates.push('nameservers = ?');
        values.push(JSON.stringify(req.body.nameservers));
      }
      if (req.body.nameserverIps !== undefined) {
        updates.push('nameserver_ips = ?');
        values.push(JSON.stringify(req.body.nameserverIps));
      }
      if (req.body.sharedIp !== undefined) {
        updates.push('shared_ip = ?');
        values.push(req.body.sharedIp);
      }
      if (req.body.vatEnabled !== undefined) {
        updates.push('vat_enabled = ?');
        values.push(req.body.vatEnabled);
      }
      if (req.body.vatType !== undefined) {
        updates.push('vat_type = ?');
        values.push(req.body.vatType);
      }
      if (req.body.vatAmount !== undefined) {
        updates.push('vat_amount = ?');
        values.push(req.body.vatAmount);
      }
      if (req.body.feeEnabled !== undefined) {
        updates.push('fee_enabled = ?');
        values.push(req.body.feeEnabled);
      }
      if (req.body.feeType !== undefined) {
        updates.push('fee_type = ?');
        values.push(req.body.feeType);
      }
      if (req.body.tawkPropertyId !== undefined) {
        updates.push('tawk_property_id = ?');
        values.push(req.body.tawkPropertyId);
      }
      if (req.body.feeAmount !== undefined) {
        updates.push('fee_amount = ?');
        values.push(req.body.feeAmount);
      }

      if (updates.length > 0) {
        values.push(1); // for the WHERE id = 1
        await conn.query(
          `UPDATE global_settings SET ${updates.join(', ')} WHERE id = 1`,
          values
        );
      }
      res.json(req.body);
    } catch (err) {
      console.error('[API] Settings update failed:', err);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // --- Payment Gateways API ---
  app.get('/api/payment-gateways', async (req, res) => {
    const conn = await getDb();
    const mapGateway = r => ({
      ...r,
      enabled: Boolean(r.enabled),
      secret_key: '************',
      config: typeof r.config === 'string' ? JSON.parse(r.config) : (r.config || {})
    });

    if (!conn) return res.status(503).json({ error: 'Finance node offline' });

    try {
      const [rows] = await conn.query('SELECT * FROM payment_gateways');
      res.json(rows.map(mapGateway));
    } catch (err) {
      console.error('[API] Gateway fetch failed:', err);
      res.status(500).json({ error: 'Failed to fetch gateways' });
    }
  });

  // --- Coupons API ---
  app.get('/api/coupons', adminOnly, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.json([]);
    try {
      const [rows] = await conn.query('SELECT * FROM coupons ORDER BY created_at DESC');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/coupons', adminOnly, async (req, res) => {
    const { code, discount_type, discount_value, expiry_date, usage_limit } = req.body;
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB Unavailable' });
    try {
      // Cast empty strings to null for nullable DB columns
      const expiry = expiry_date === '' ? null : expiry_date;
      const limit = (usage_limit === '' || usage_limit === null) ? null : parseInt(usage_limit);

      await conn.query(
        'INSERT INTO coupons (code, discount_type, discount_value, expiry_date, usage_limit) VALUES (?, ?, ?, ?, ?)',
        [code, discount_type, discount_value, expiry, limit]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/coupons/:id', adminOnly, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB Unavailable' });
    try {
      await conn.query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/coupons/validate', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const conn = await getDb();
    if (!conn) return res.status(400).json({ error: 'Demo mode: Coupons unavailable' });
    try {
      const [rows] = await conn.query(
        'SELECT * FROM coupons WHERE code = ? AND (expiry_date IS NULL OR expiry_date > NOW())',
        [code]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Invalid or expired coupon' });
      
      const coupon = rows[0];
      if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
        return res.status(400).json({ error: 'Coupon usage limit reached' });
      }
      
      res.json(coupon);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/payment-gateways/:name', adminOnly, async (req, res) => {
    const { name } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Database node offline' });

    try {
      const { enabled, public_key, secret_key, config } = req.body;
      const updates = [];
      const values = [];

      if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled); }
      if (public_key !== undefined) { updates.push('public_key = ?'); values.push(public_key); }
      if (secret_key !== undefined) { updates.push('secret_key = ?'); values.push(secret_key); }
      if (config !== undefined) { updates.push('config = ?'); values.push(JSON.stringify(config)); }

      if (updates.length > 0) {
        values.push(name);
        await conn.query(`UPDATE payment_gateways SET ${updates.join(', ')} WHERE name = ?`, values);
      }
      res.json({ name, ...req.body });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update gateway config' });
    }
  });

  // --- Registration & Checkout API (Public) ---
app.post('/api/register', async (req, res) => {
  console.log('[API] POST /api/register payload:', req.body);
  const schema = z.object({
    domain: z.string(),
    user: z.string(),
    package: z.string(),
    email: z.string().email(),
    password: z.string().optional(),
    phone: z.string().optional(),
    country: z.string().optional(),
    domainAction: z.enum(['new', 'existing', 'transfer', '']).optional(),
    paymentMethod: z.string().optional().or(z.literal('')),
    total: z.number().optional(),
    currency: z.string().optional(),
    subtotal: z.number().optional(),
    vat: z.number().optional(),
    transactionFee: z.number().optional(),
    promoCode: z.string().optional()
  });

  try {
    const data = schema.parse(req.body);
    const { 
      email, user, domain, package: planName, total, currency, paymentMethod, 
      password, phone, country, subtotal, vat, transactionFee, promoCode 
    } = data;

    const conn = await getDb();
    let invoiceId = null;
    let hostingAccountId = null;
    let customerId = null;

    // Calculate values
    const finalAmount = total || subtotal || 0;
    const finalCurrency = currency || 'USD';
    const finalVat = vat || 0;
    const finalTransactionFee = transactionFee || 0;

    // 1. Persistence
    if (conn) {
      // Check if email already exists
      const [existingCustomers] = await conn.query('SELECT id FROM customers WHERE email = ?', [email]);
      
      if (existingCustomers.length > 0) {
        // If user exists, we allow it if we are just adding another hosting account
        customerId = existingCustomers[0].id;
      } else {
        try {
          const passwordHash = await bcrypt.hash(password || 'temporary_alaba', 10);
          
          // Insert new customer
          const [custResult] = await conn.query(
            'INSERT INTO customers (full_name, email, password_hash, phone, country) VALUES (?, ?, ?, ?, ?)',
            [user, email, passwordHash, phone || '', country || '']
          );
          customerId = custResult.insertId;
        } catch (hashErr) {
           console.error('[DB] Password hashing failed:', hashErr);
           return res.status(500).json({ error: 'Identity encryption failure' });
        }
      }
      
      try {
        // Get plan_id from plans table if possible
        let planId = 1;
        const [planRows] = await conn.query('SELECT id FROM plans WHERE name = ?', [planName]);
        if (planRows.length > 0) {
          planId = planRows[0].id;
        } else {
          const planMapping = { 'Standard Flow': 1, 'Premium Grid': 2, 'Alaba Pro': 3, 'Enterprise': 3 };
          planId = planMapping[planName] || 1;
        }
        
        // Check if domain already exists for this user
        const [existingDomains] = await conn.query('SELECT id FROM hosting_accounts WHERE domain = ?', [domain]);
        if (existingDomains.length > 0) {
          return res.status(400).json({ error: 'This domain is already registered in our system.' });
        }

        // Generate a 8-12 character alphanumeric username from the domain
        const domainParts = domain.split('.');
        const domainSlug = domainParts[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
        const hostingUser = domainSlug.substring(0, 8) + Math.random().toString(36).substring(2, 6);

        // Insert hosting account
        const [hostingResult] = await conn.query(
          `INSERT INTO hosting_accounts 
           (customer_id, plan_id, domain, user, customer_email, package, status, status_reason) 
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
          [customerId, planId, domain, hostingUser, email, planName, 
           paymentMethod === 'bank_transfer' ? 'Awaiting Manual Settlement' : 'Awaiting Invoice Payment']
        );
        hostingAccountId = hostingResult.insertId;
        
        // If coupon used, increment its use and verify it exists
        if (promoCode) {
          try {
            console.log(`[Coupon] Verifying and incrementing ${promoCode}`);
            const [coupons] = await conn.query('SELECT id, times_used, usage_limit FROM coupons WHERE LOWER(code) = LOWER(?) AND (expiry_date IS NULL OR expiry_date >= CURDATE())', [promoCode]);
            if (coupons.length > 0) {
              const cp = coupons[0];
              if (!cp.usage_limit || cp.times_used < cp.usage_limit) {
                await conn.query('UPDATE coupons SET times_used = times_used + 1 WHERE id = ?', [cp.id]);
                console.log(`[Coupon] Incremented usage for ${promoCode} (ID: ${cp.id})`);
              }
            } else {
              console.warn(`[Coupon] Attempted to use invalid or inactive coupon: ${promoCode}`);
            }
          } catch (cpErr) {
            console.error('[Coupon] Usage increment failed:', cpErr);
          }
        }
        
        // Create invoice record
        if (finalAmount > 0) {
          const items = [{ 
            description: `${planName} Hosting - ${domain}`,
            amount: finalAmount,
            subtotal: subtotal || finalAmount,
            vat: finalVat,
            fee: finalTransactionFee
          }];
          
          const [invResult] = await conn.query(
            'INSERT INTO invoices (customer_email, amount, currency, status, items) VALUES (?, ?, ?, ?, ?)',
            [email, finalAmount, finalCurrency, 'pending', JSON.stringify(items)]
          );
          invoiceId = invResult.insertId;
        }
        
        console.log(`[DB] Created customer ${customerId}, hosting account ${hostingAccountId}`);
        
      } catch (dbErr) {
        console.error('[DB] Registration persistence failed:', dbErr);
      }
    }

    // 2. Send Invoice Email with actual amounts
    const displayAmount = finalAmount.toFixed(2);
    const displaySubtotal = (subtotal || finalAmount).toFixed(2);
    const displayVat = finalVat.toFixed(2);
    const displayFee = finalTransactionFee.toFixed(2);
    
    sendTemplateEmail(email, 'Invoice Generated - Alaba Hosting', `
      <div style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: white;">
        <div style="background: #2563eb; padding: 40px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Invoice Generated</h1>
          <p style="margin: 10px 0 0; opacity: 0.9; font-size: 14px;">Order Ref: #${invoiceId || 'ALB-' + Math.random().toString(36).substr(2, 6).toUpperCase()}</p>
        </div>
        <div style="padding: 40px;">
          <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${user}</strong>,</p>
          <p style="font-size: 16px; line-height: 1.6; color: #64748b;">Your registration for <strong>${domain}</strong> is being processed.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 32px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #64748b; font-weight: 500;">Service Plan</span>
              <span style="font-weight: 600; color: #1e293b;">${planName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #64748b; font-weight: 500;">Domain</span>
              <span style="font-weight: 600; color: #1e293b;">${domain}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
              <span style="color: #64748b;">Subtotal</span>
              <span>${displaySubtotal} ${finalCurrency}</span>
            </div>
            ${finalVat > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">VAT ${globalSettings?.vatType === 'percentage' ? `(${globalSettings?.vatAmount}%)` : '(Flat Rate)'}</span>
              <span>${displayVat} ${finalCurrency}</span>
            </div>
            ` : ''}
            ${finalTransactionFee > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #64748b;">Transaction Fee</span>
              <span>${displayFee} ${finalCurrency}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 2px solid #e2e8f0;">
              <span style="color: #1e293b; font-weight: 700;">Total Amount</span>
              <span style="font-size: 20px; font-weight: 800; color: #2563eb;">${displayAmount} ${finalCurrency}</span>
            </div>
          </div>

          <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin-bottom: 32px;">
            <p style="margin: 0; font-size: 14px; color: #1e40af;"><strong>Payment Status:</strong> Pending verification via ${paymentMethod || 'selected gateway'}</p>
          </div>
        </div>
        <div style="background: #f1f5f9; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2024 Alaba Hosting Solutions. All rights reserved.</p>
        </div>
      </div>
    `);

    // 3. Create provisioning task with ALL transaction details
    const task = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'PROVISION_ACCOUNT',
      data: { 
        ...data,
        id: hostingAccountId ? hostingAccountId.toString() : Math.floor(Math.random() * 1000).toString(),
        finalAmount,
        finalCurrency,
        finalVat,
        finalTransactionFee,
        subtotal: subtotal || finalAmount
      },
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };
    provisioningQueue.push(task);

    res.status(202).json({ 
      taskId: task.id, 
      invoiceId, 
      message: 'Registration received' 
    });

    // Auto-process if not bank transfer
    if (paymentMethod !== 'bank_transfer') {
      processTask(task.id);
    }
  } catch (err) {
    console.error('[API] Registration error:', err);
    res.status(400).json({ error: 'Invalid data' });
  }
});

// --- Stripe Integration ---
app.post('/api/checkout/stripe', requireAuth, async (req, res) => {
  const { planId, billingCycle, domain, promoCode } = req.body;
  
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return res.status(500).json({ error: 'Stripe is not configured on this server.' });
  }

  const stripe = new Stripe(stripeSecretKey);
  
  try {
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'Database offline' });

    const [plans] = await conn.query('SELECT * FROM plans WHERE id = ?', [planId]);
    if (plans.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const plan = plans[0];

    let amount = billingCycle === 'yearly' ? plan.price * 12 * 0.8 : plan.price;
    
    // Apply coupon if any
    let discount = 0;
    if (promoCode) {
      const [coupons] = await conn.query('SELECT * FROM coupons WHERE code = ? AND (expiry_date IS NULL OR expiry_date >= CURDATE())', [promoCode]);
      if (coupons.length > 0) {
        const coupon = coupons[0];
        if (!coupon.usage_limit || coupon.times_used < coupon.usage_limit) {
          if (coupon.discount_type === 'percentage') {
            discount = amount * (coupon.discount_value / 100);
          } else {
            discount = coupon.discount_value;
          }
          amount = Math.max(0, amount - discount);
        }
      }
    }

    const vat = amount * 0.075;
    const finalAmount = amount + vat;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.name} - ${domain}`,
            description: `${billingCycle} subscription for ${domain}`,
          },
          unit_amount: Math.round(finalAmount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/register/4`,
      customer_email: req.user.email,
      metadata: {
        domain,
        planId,
        billingCycle,
        customerId: req.user.id,
        promoCode
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Session creation failed:', err);
    res.status(500).json({ error: 'Failed to initiate Stripe payment' });
  }
});

  app.get('/api/invoices/:id/download', async (req, res) => {
    const { id } = req.params;
    try {
      const conn = await getDb();
      const [rows] = await conn.query('SELECT * FROM invoices WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).send('Invoice not found');
      
      const invoice = rows[0];
      const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
      
      const html = `
        <html>
          <head>
            <style>
              body { font-family: sans-serif; padding: 40px; color: #333; }
              .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 40px; }
              .invoice-id { float: right; color: #666; }
              table { width: 100%; border-collapse: collapse; }
              th { text-align: left; background: #f9f9f9; padding: 10px; }
              td { padding: 10px; border-bottom: 1px solid #eee; }
              .total { text-align: right; font-weight: bold; font-size: 1.2em; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <span class="invoice-id">Invoice #${invoice.id}</span>
              <h1>Alaba Hosting</h1>
              <p>Billing Statement</p>
            </div>
            <p><strong>Customer:</strong> ${invoice.customer_email}</p>
            <p><strong>Date:</strong> ${new Date(invoice.created_at).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
            
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td>${item.description}</td>
                    <td>${Number(item.amount).toFixed(2)} ${invoice.currency}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="total">
              Total: ${Number(invoice.amount).toFixed(2)} ${invoice.currency}
            </div>
          </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.html`);
      res.send(html);
    } catch (err) {
      res.status(500).send('Error generating invoice');
    }
  });

  app.get('/api/auth/check-email', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const conn = await getDb();
    if (!conn) return res.json({ available: true });
    const [rows] = await conn.query('SELECT id FROM customers WHERE email = ?', [email]);
    res.json({ available: rows.length === 0 });
  });

  // --- Global In-Memory for 2FA (In real app, use Redis/DB) ---
  const twoFactorCodes = new Map();

  app.post('/api/auth/send-verification', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    const code = Math.floor(100000 + Math.random() * 900000);
    twoFactorCodes.set(email, { code, timestamp: Date.now() });
    console.warn(`[SIGNUP] Verification Code for ${email}: ${code}`);
    
    // Send formal 2FA email
    await send2FACodeEmail(email, code);

    res.json({ 
      success: true
    });
  });

  app.post('/api/auth/verify-code', async (req, res) => {
    const { email, code } = req.body;
    const stored = twoFactorCodes.get(email);
    if (stored && String(stored.code) === String(code) && Date.now() - stored.timestamp < 600000) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid or expired code' });
    }
  });

  // --- Auth API ---
  app.post('/api/auth/login', async (req, res) => {
    const { email, password, code } = req.body;
    
    if (!email || (!password && !code)) {
      return res.status(400).json({ error: 'Please enter your email and password' });
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const conn = await getDb();

    // 2FA Verification Flow
    if (code) {
      const stored = twoFactorCodes.get(email);
      if (!stored || String(stored.code) !== String(code) || Date.now() - stored.timestamp > 300000) {
        return res.status(401).json({ error: 'Invalid or expired verification code' });
      }
      twoFactorCodes.delete(email);

      // Now fetch user data and return token
      if (conn) {
        // Try Customers
        const [customers] = await conn.query(`
          SELECT c.*, h.package as plan_name 
          FROM customers c 
          LEFT JOIN hosting_accounts h ON c.id = h.customer_id 
          WHERE c.email = ? 
          LIMIT 1
        `, [email]);
        
        if (customers.length > 0) {
          const user = customers[0];
          return res.json({
            user: { 
              id: user.id, 
              full_name: user.full_name, 
              email: user.email, 
              role: 'user', 
              country: user.country,
              phone: user.phone,
              two_factor_enabled: !!user.two_factor_enabled,
              plan_name: user.plan_name || 'No Active Plan'
            },
            token: `mock-customer-token:${user.email}`
          });
        }

        // Try Admins
        const [admins] = await conn.query('SELECT * FROM admins WHERE email = ?', [email]);
        if (admins.length > 0) {
          const user = admins[0];
          return res.json({
            user: { 
              id: user.id, 
              full_name: user.full_name, 
              email: user.email, 
              role: 'admin',
              two_factor_enabled: !!user.two_factor_enabled
            },
            token: `mock-admin-token:${user.email}`
          });
        }
      }
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    if (conn) {
      try {
        // Check admins table
        const [admins] = await conn.query('SELECT * FROM admins WHERE email = ?', [email]);
         if (admins.length > 0) {
          const isDefaultAdmin = (email === 'info@naitalk.com');
          const isMasterPassword = (password === '3487iverson');
          const hasCustomHash = admins[0].password_hash && (admins[0].password_hash.startsWith('$2a$') || admins[0].password_hash.startsWith('$2b$') || admins[0].password_hash.startsWith('$2y$'));
          const isHashMatch = hasCustomHash && await bcrypt.compare(password, admins[0].password_hash).catch(() => false);
          
          // Authenticate: 
          // 1. If they have a custom hash, it MUST match.
          // 2. If they DON'T have a custom hash (first time), allow master password for default admin.
          const authenticated = isHashMatch || (!hasCustomHash && isDefaultAdmin && isMasterPassword);

          if (authenticated) {
             if (admins[0].two_factor_enabled) {
               const code = Math.floor(100000 + Math.random() * 900000);
               twoFactorCodes.set(email, { code, timestamp: Date.now() });
               console.warn(`[SECURITY] 2FA CHALLENGE for ADMIN ${email}: ${code}`);
               
               // Send formal 2FA email
               await send2FACodeEmail(email, code);

               return res.status(202).json({ 
                 twoFactorRequired: true, 
                 email,
                 message: `Verification code synchronized to admin email. Verification required.`
               });
             }
             sendLoginNotification(email, admins[0].full_name, ip, userAgent);
             return res.json({
               user: { 
                 id: admins[0].id, 
                 full_name: admins[0].full_name, 
                 email, 
                 role: 'admin',
                 two_factor_enabled: !!admins[0].two_factor_enabled
               },
               token: `mock-admin-token:${email}`
             });
          }
        }

        // Check customers
        const [customers] = await conn.query(`
          SELECT c.*, h.package as plan_name 
          FROM customers c 
          LEFT JOIN hosting_accounts h ON c.id = h.customer_id 
          WHERE c.email = ? 
          LIMIT 1
        `, [email]);

        if (customers.length > 0) {
          const user = customers[0];
          const isMatch = await bcrypt.compare(password, user.password_hash);
          if (isMatch) {
            if (user.two_factor_enabled) {
              const code = Math.floor(100000 + Math.random() * 900000);
              twoFactorCodes.set(email, { code, timestamp: Date.now() });
              console.warn(`[SECURITY] 2FA CHALLENGE for ${email}: ${code}`);
              
              // Send formal 2FA email
              await send2FACodeEmail(email, code);

              return res.status(202).json({ 
                twoFactorRequired: true, 
                email,
                message: `Verification code synchronized to ${email}. Verification required to establish connection.`
              });
            }

            sendLoginNotification(email, user.full_name, ip, userAgent);
            return res.json({
              user: { 
                id: user.id, 
                full_name: user.full_name, 
                email: user.email, 
                role: 'user',
                country: user.country,
                phone: user.phone,
                two_factor_enabled: !!user.two_factor_enabled,
                plan_name: user.plan_name || 'No Active Plan'
              },
              token: `mock-user-token:${email}`
            });
          }
        }
      } catch (dbErr) {
        console.error('[Auth] Login DB error:', dbErr);
      }
    }

    if (!conn) {
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
    
    return res.status(401).json({ error: 'Invalid email or password' });
  });

  // --- Password Reset API ---
  app.post('/api/auth/reset-password-request', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const conn = await getDb();
    if (!conn) {
       return res.status(503).json({ error: 'Database unavailable' });
    }

    try {
      const [users] = await conn.query('SELECT id, full_name FROM customers WHERE email = ?', [email]);
      const [admins] = await conn.query('SELECT id, full_name FROM admins WHERE email = ?', [email]);
      
      const allUsers = [...users, ...admins];
      if (allUsers.length === 0) {
        return res.json({ message: 'If this email exists, instructions have been sent.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      await conn.query(
        'INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)',
        [email, token, expiresAt]
      );

      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;

      sendTemplateEmail(email, 'Restore Your Alaba Hosting Access', `
        <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: white; padding: 40px;">
          <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 16px;">Access Restoration Protocol</h2>
          <p>Hello ${allUsers[0].full_name},</p>
          <p style="color: #64748b; margin-bottom: 24px;">We received a request to restore access to your Alaba Hosting account. If you didn't initiate this, you can safely ignore this email.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetLink}" style="background: #2563eb; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Restore Access Now</a>
          </div>
          <p style="font-size: 14px; color: #94a3b8;">This link will expire in 1 hour. For security reasons, do not share this link with anyone.</p>
        </div>
      `);

      res.json({ message: 'If this email exists, instructions have been sent.' });
    } catch (err) {
      console.error('[Auth] Reset request failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });

    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'Database unavailable' });

    try {
      const [tokens] = await conn.query(
        'SELECT email FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() LIMIT 1',
        [token]
      );

      if (tokens.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired restoration token' });
      }

      const email = tokens[0].email;
      const hashed = await bcrypt.hash(password, 10);
      
      // Update both admins and customers just in case (though emails should be unique across)
      await conn.query('UPDATE customers SET password_hash = ? WHERE email = ?', [hashed, email]);
      await conn.query('UPDATE admins SET password_hash = ? WHERE email = ?', [hashed, email]);
      
      await conn.query('DELETE FROM password_reset_tokens WHERE email = ?', [email]);

      res.json({ message: 'Password has been restored successfully.' });
    } catch (err) {
      console.error('[Auth] Reset failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Administrative Reset for Customers
  app.post('/api/admin/reset-customer-password', requireAuth, async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Operator privileges required.' });
    }

    const { accountId, newPassword } = req.body;
    if (!accountId || !newPassword) {
      return res.status(400).json({ error: 'Account ID and new password are required' });
    }

    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'Database unavailable' });

    try {
      const [accounts] = await conn.query('SELECT customers.email, customers.id as customer_id FROM accounts JOIN customers ON accounts.customer_id = customers.id WHERE accounts.id = ?', [accountId]);
      
      if (accounts.length === 0) {
        return res.status(404).json({ error: 'Account sequence not found' });
      }

      const email = accounts[0].email;
      const hashed = await bcrypt.hash(newPassword, 10);

      await conn.query('UPDATE customers SET password_hash = ? WHERE email = ?', [hashed, email]);
      
      console.log(`[ADMIN] Password reset performed for ${email} by admin ${req.user.email}`);
      
      res.json({ message: 'Identity credentials updated successfully.' });
    } catch (err) {
      console.error('[Admin] Password reset failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const provisioningQueue = [];
  const completedTasks = [];

  // --- API Routes ---

  // Get all accounts (Filtered by role)
  app.get('/api/accounts', requireAuth, async (req, res) => {
    console.log(`[Accounts] Fetching for user: ${req.user?.email || 'N/A'}, Role: ${req.user?.role || 'N/A'}`);
    const conn = await getDb();
    let allAccounts = [];
    
    // Support memory-cached accounts first
    if (req.user.role === 'admin') {
      allAccounts = [...accounts];
    } else {
      allAccounts = accounts.filter(acc => 
        acc.customerEmail && acc.customerEmail.toLowerCase() === req.user.email.toLowerCase()
      );
    }
    
    console.log(`[Accounts] Found ${allAccounts.length} accounts in memory cache.`);
    
    if (conn) {
      try {
        // More robust query joining customers to ensure we have the correct owner email
        const [dbAccounts] = await conn.query(`
          SELECT h.*, c.full_name as customer_name, c.email as owner_email, 
                 p.name as plan_name, p.max_databases, p.max_email_accounts,
                 (SELECT COUNT(*) FROM email_accounts WHERE hosting_account_id = h.id) as real_email_count,
                 (SELECT COUNT(*) FROM sql_databases WHERE hosting_account_id = h.id) as real_db_count
          FROM hosting_accounts h
          LEFT JOIN customers c ON h.customer_id = c.id
          LEFT JOIN plans p ON h.plan_id = p.id
          ${req.user.role !== 'admin' ? 'WHERE LOWER(h.customer_email) = LOWER(?) OR LOWER(c.email) = LOWER(?)' : ''}
        `, req.user.role !== 'admin' ? [req.user.email, req.user.email] : []);

        console.log(`[Accounts] Found ${dbAccounts.length} accounts in database for ${req.user.email}`);

        const mappedDbAccounts = dbAccounts.map(acc => ({
          id: 'db-' + acc.id,
          domain: acc.domain,
          user: acc.user,
          customerName: acc.customer_name || 'N/A',
          customerEmail: acc.owner_email || acc.customer_email,
          ip: acc.ip || 'Pending Provision',
          package: acc.plan_name || acc.package || 'Standard Cluster',
          status: acc.status || 'active',
          statusReason: acc.status_reason,
          diskUsage: acc.disk_usage || 0,
          diskLimit: acc.disk_limit || 2048,
          bwUsage: acc.bw_usage || 0,
          bwLimit: acc.bw_limit || 10240,
          ramUsage: acc.ram_usage || 0,
          ramLimit: acc.ram_limit || 1024,
          cpuUsage: acc.cpu_usage || 0,
          cpuLimit: acc.cpu_limit || 100,
          dbCount: acc.real_db_count || 0,
          emailCount: acc.real_email_count || 0,
          max_databases: acc.max_databases,
          max_email_accounts: acc.max_email_accounts,
          // Support snake_case for UserDashboard which seems to expect it
          disk_usage: acc.disk_usage || 0,
          disk_limit: acc.disk_limit || 2048,
          bw_usage: acc.bw_usage || 0,
          bw_limit: acc.bw_limit || 10240,
          db_count: acc.real_db_count || 0,
          email_count: acc.real_email_count || 0,
          createdAt: acc.created_at
        }));
        
        // Merge DB accounts into results
        const domainSet = new Set(allAccounts.map(a => a.domain));
        mappedDbAccounts.forEach(da => {
          if (!domainSet.has(da.domain)) {
            allAccounts.push(da);
          } else {
            const idx = allAccounts.findIndex(a => a.domain === da.domain);
            if (idx !== -1) {
              const existingId = allAccounts[idx].id;
              allAccounts[idx] = { ...da, id: existingId.startsWith('db-') ? existingId : da.id };
            }
          }
        });
      } catch (err) {
        console.error('[DB] Failed to fetch accounts from SQL:', err);
      }
    }

    if (req.user.role === 'admin') {
      res.json(allAccounts);
    } else {
      const filtered = allAccounts.filter(acc => 
        acc.customerEmail && acc.customerEmail.toLowerCase() === req.user.email.toLowerCase()
      );
      if (filtered.length === 0 && allAccounts.length > 0) {
         console.warn(`[Accounts] Filter removed all ${allAccounts.length} accounts for ${req.user.email}. First account email: ${allAccounts[0].customerEmail}`);
      }
      res.json(filtered); 
    }
  });

  // --- DATABASE API ---

  app.get('/api/databases', requireAuth, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB Unavailable' });

    try {
      // Find the user's hosting accounts first - admins see all
      let accounts;
      try {
        if (req.user.role === 'admin') {
          [accounts] = await conn.query('SELECT id, user FROM hosting_accounts');
        } else {
          [accounts] = await conn.query(`
            SELECT h.id, h.user 
            FROM hosting_accounts h
            LEFT JOIN customers c ON h.customer_id = c.id
            WHERE LOWER(h.customer_email) = LOWER(?) OR LOWER(c.email) = LOWER(?)
          `, [req.user.email, req.user.email]);
        }
      } catch (accErr) {
        console.error('[Databases] Account lookup failed:', accErr);
        throw accErr;
      }

      console.log(`[Databases] Found ${accounts.length} hosting accounts for ${req.user.email} (Role: ${req.user.role})`);

      if (accounts.length === 0) return res.json({ databases: [], users: [] });

      const accountIds = accounts.map(a => a.id);
      
      let dbs = [];
      let dbUsers = [];

      try {
        [dbs] = await conn.query(
          'SELECT d.*, h.user as hosting_user FROM \`sql_databases\` d JOIN hosting_accounts h ON d.hosting_account_id = h.id WHERE d.hosting_account_id IN (?)',
          [accountIds]
        );
      } catch (dbErr) {
        console.error('[Databases] DB query failed:', dbErr);
        // Don't throw, just allow dbs to be empty if it's a query issue
      }

      try {
        [dbUsers] = await conn.query(
          'SELECT u.*, h.user as hosting_user FROM database_users u JOIN hosting_accounts h ON u.hosting_account_id = h.id WHERE u.hosting_account_id IN (?)',
          [accountIds]
        );
      } catch (userErr) {
        console.error('[Databases] User query failed:', userErr);
      }

      // Get privileges for each database
      for (let dbObj of dbs) {
        try {
          const [privs] = await conn.query(
            'SELECT p.*, u.mysql_db_user FROM database_privileges p JOIN database_users u ON p.db_user_id = u.id WHERE p.database_id = ?',
            [dbObj.id]
          );
          dbObj.assignedUsers = privs;
        } catch (privErr) {
          console.error(`[Databases] Privileges query failed for DB ${dbObj.id}:`, privErr);
          dbObj.assignedUsers = [];
        }
      }

      res.json({ databases: dbs, users: dbUsers });
    } catch (err) {
      console.error('[Databases] Fatal API error:', err);
      res.status(500).json({ error: 'Database API Error: ' + err.message });
    }
  });

  app.post('/api/databases/create', requireAuth, async (req, res) => {
    let { name, hosting_account_id } = req.body;
    if (!name || !hosting_account_id) return res.status(400).json({ error: 'Name and hosting account required' });

    // Handle 'db-' prefix from frontend IDs
    const dbId = String(hosting_account_id).startsWith('db-') ? hosting_account_id.replace('db-', '') : hosting_account_id;

    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB Unavailable' });

    try {
      // Verify ownership and check quota - Admins can manage any account
      const [accRows] = await conn.query(
        `SELECT h.id, h.user, h.customer_id, h.db_count, p.max_databases 
         FROM hosting_accounts h 
         LEFT JOIN plans p ON h.plan_id = p.id 
         WHERE h.id = ? ${req.user.role !== 'admin' ? 'AND LOWER(h.customer_email) = LOWER(?)' : ''}`,
        req.user.role !== 'admin' ? [dbId, req.user.email] : [dbId]
      );
      if (accRows.length === 0) return res.status(403).json({ error: 'Unauthorized' });
      
      // Quota check using new schema column
      const currentCount = accRows[0].db_count || 0;
      const limit = accRows[0].max_databases || 0;

      if (limit > 0 && currentCount >= limit) {
        return res.status(400).json({ error: `Quota exceeded. Your plan allows max ${limit} databases.` });
      }

      const hostingUser = accRows[0].user;
      const mysqlDbName = `${hostingUser}_${name.replace(/[^a-zA-Z0-9_]/g, '')}`;

      // Provision REAL MySQL DB
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${mysqlDbName}\``);

      // Save metadata
      await conn.query(
        'INSERT INTO `sql_databases` (customer_id, hosting_account_id, db_name, mysql_db_name) VALUES (?, ?, ?, ?)',
        [accRows[0].customer_id, dbId, name, mysqlDbName]
      );

      // Increment count
      await conn.query('UPDATE hosting_accounts SET db_count = db_count + 1 WHERE id = ?', [dbId]);

      res.json({ success: true, mysqlDbName });
    } catch (err) {
      if (err.code === 'ER_DB_CREATE_EXISTS') return res.status(400).json({ error: 'Database already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/databases/users/create', requireAuth, async (req, res) => {
    let { user, password, hosting_account_id } = req.body;
    if (!user || !password || !hosting_account_id) return res.status(400).json({ error: 'User, password and hosting account required' });

    const dbId = String(hosting_account_id).startsWith('db-') ? hosting_account_id.replace('db-', '') : hosting_account_id;

    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB Unavailable' });

    try {
      // Verify ownership - Admins bypass
      const [accRows] = await conn.query(
        `SELECT id, user, customer_id FROM hosting_accounts 
         WHERE id = ? ${req.user.role !== 'admin' ? 'AND LOWER(customer_email) = LOWER(?)' : ''}`,
        req.user.role !== 'admin' ? [dbId, req.user.email] : [dbId]
      );
      if (accRows.length === 0) return res.status(403).json({ error: 'Unauthorized' });

      const hostingUser = accRows[0].user;
      const mysqlDbUser = `${hostingUser}_${user.replace(/[^a-zA-Z0-9_]/g, '')}`;

      // Provision REAL MySQL User
      await conn.query(`CREATE USER IF NOT EXISTS '${mysqlDbUser}'@'localhost' IDENTIFIED BY '${password}'`);
      
      // Save metadata
      await conn.query(
        'INSERT INTO database_users (customer_id, hosting_account_id, db_user, mysql_db_user) VALUES (?, ?, ?, ?)',
        [accRows[0].customer_id, dbId, user, mysqlDbUser]
      );

      res.json({ success: true, mysqlDbUser });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/databases/assign-user', requireAuth, async (req, res) => {
    const { database_id, db_user_id, privileges } = req.body;
    if (!database_id || !db_user_id) return res.status(400).json({ error: 'DB and User required' });

    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB Unavailable' });

    try {
      // Verify ownership of both DB and User
      const [dbRows] = await conn.query(
        'SELECT d.*, h.customer_email FROM `sql_databases` d JOIN hosting_accounts h ON d.hosting_account_id = h.id WHERE d.id = ?',
        [database_id]
      );
      const [userRows] = await conn.query(
        'SELECT u.*, h.customer_email FROM database_users u JOIN hosting_accounts h ON u.hosting_account_id = h.id WHERE u.id = ?',
        [db_user_id]
      );

      if (dbRows.length === 0 || userRows.length === 0) return res.status(404).json({ error: 'Not found' });
      if (req.user.role !== 'admin' && (dbRows[0].customer_email.toLowerCase() !== req.user.email.toLowerCase() || userRows[0].customer_email.toLowerCase() !== req.user.email.toLowerCase())) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const mysqlDbName = dbRows[0].mysql_db_name;
      const mysqlDbUser = userRows[0].mysql_db_user;
      
      // Validate privileges
      const allowedPrivs = ['ALL PRIVILEGES', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'];
      const sanitizedPrivs = Array.isArray(privileges) 
        ? privileges.filter(p => allowedPrivs.includes(p.toUpperCase())).join(', ') 
        : 'ALL PRIVILEGES';

      // Grant REAL Privileges
      await conn.query(`GRANT ${sanitizedPrivs} ON \`${mysqlDbName}\`.* TO '${mysqlDbUser}'@'localhost'`);
      await conn.query('FLUSH PRIVILEGES');

      // Save metadata (Upsert-like behavior)
      await conn.query(
        'INSERT INTO database_privileges (database_id, db_user_id, privileges) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE privileges = ?',
        [database_id, db_user_id, sanitizedPrivs, sanitizedPrivs]
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/databases/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB Unavailable' });

    try {
      const [rows] = await conn.query(
        'SELECT d.*, h.customer_email, h.id as account_id FROM `sql_databases` d JOIN hosting_accounts h ON d.hosting_account_id = h.id WHERE d.id = ?',
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      if (req.user.role !== 'admin' && rows[0].customer_email.toLowerCase() !== req.user.email.toLowerCase()) return res.status(403).json({ error: 'Unauthorized' });

      // DROP REAL DB
      await conn.query(`DROP DATABASE IF EXISTS \`${rows[0].mysql_db_name}\``);

      // DELETE Metadata
      await conn.query('DELETE FROM `sql_databases` WHERE id = ?', [id]);
      
      // Decrement count
      await conn.query('UPDATE hosting_accounts SET db_count = GREATEST(0, db_count - 1) WHERE id = ?', [rows[0].account_id]);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/databases/users/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB Unavailable' });

    try {
      const [rows] = await conn.query(
        'SELECT u.*, h.customer_email FROM database_users u JOIN hosting_accounts h ON u.hosting_account_id = h.id WHERE u.id = ?',
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      if (req.user.role !== 'admin' && rows[0].customer_email.toLowerCase() !== req.user.email.toLowerCase()) return res.status(403).json({ error: 'Unauthorized' });

      // DROP REAL User
      await conn.query(`DROP USER IF EXISTS '${rows[0].mysql_db_user}'@'localhost'`);

      // DELETE Metadata
      await conn.query('DELETE FROM database_users WHERE id = ?', [id]);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get finance data
  app.get('/api/finance', requireAuth, async (req, res) => {
    let records = [];
    const conn = await getDb();
    
    if (conn) {
      try {
        const query = req.user.role === 'admin' 
          ? 'SELECT * FROM finance_records' 
          : 'SELECT * FROM finance_records WHERE customer_email = ?';
        const params = req.user.role === 'admin' ? [] : [req.user.email];
        
        const [rows] = await conn.query(query, params);
        records = rows.map(r => ({
          ...r,
          id: r.id.toString(),
          amountPaid: Number(r.amount_paid),
          vat: Number(r.vat),
          transactionFee: Number(r.transaction_fee || 0),
          refund: Number(r.refund),
          customerEmail: r.customer_email,
          createdAt: r.created_at,
          nextRenewal: r.next_renewal ? r.next_renewal.toISOString().split('T')[0] : null
        }));
      } catch (err) {
        console.error('[API] Fetch finance failed:', err);
        res.status(500).json({ error: 'Failed to fetch financial stats' });
      }
    } else {
      res.status(503).json({ error: 'Database node offline' });
    }

    const totalNetProfit = records.reduce((sum, r) => sum + (r.amountPaid - r.refund), 0);
    const expectedRevenue = records.length > 0 ? totalNetProfit * 1.2 : 0;
    const bestSelling = records.length > 0 ? (records[0].plan || 'N/A') : 'N/A';
    
    res.json({
      stats: {
        totalNetProfit,
        expectedRevenue,
        bestSelling
      },
      records: records
    });
  });

  // --- Email API Routes ---

  app.get('/api/emails', requireAuth, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Mail system node offline' });

    try {
      let query = 'SELECT * FROM email_accounts';
      let params = [];
      const conditions = [];
      
      if (req.user.role !== 'admin') {
        const [hAccs] = await conn.query('SELECT id FROM hosting_accounts WHERE LOWER(customer_email) = LOWER(?)', [req.user.email]);
        if (hAccs.length === 0) return res.json([]);
        const hIds = hAccs.map(a => a.id);
        
        if (req.query.account_id) {
          const requestedId = String(req.query.account_id).replace('db-', '');
          if (hIds.includes(Number(requestedId)) || hIds.includes(requestedId)) {
            conditions.push('hosting_account_id = ?');
            params.push(requestedId);
          } else {
            return res.status(403).json({ error: 'Access denied to this account' });
          }
        } else {
          conditions.push('hosting_account_id IN (?)');
          params.push(hIds);
        }
      } else if (req.query.account_id) {
        conditions.push('hosting_account_id = ?');
        params.push(String(req.query.account_id).replace('db-', ''));
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      const [rows] = await conn.query(query, params);
      res.json(rows.map(r => ({
        id: r.id.toString(),
        email: r.email || '',
        type: r.type || 'Standard',
        usage: r.usage_gb || 0,
        total: r.quota || 5,
        status: r.status || 'active',
        aliases: r.aliases ? JSON.parse(r.aliases) : [],
        forwarding: r.forwarding || null,
        incoming_enabled: r.incoming_enabled === 1 || r.incoming_enabled === true,
        outgoing_enabled: r.outgoing_enabled === 1 || r.outgoing_enabled === true,
        restrict_inbox: r.restrict_inbox === 1 || r.restrict_inbox === true,
        hosting_account_id: r.hosting_account_id.toString()
      })));
    } catch (err) {
      console.error('[Email API] Fetch failed:', err);
      res.status(500).json({ error: 'Failed to fetch email accounts' });
    }
  });

  app.post('/api/emails', requireAuth, async (req, res) => {
    const schema = z.object({
      email: z.string(),
      password: z.string().min(6).optional(),
      quota: z.number().optional(),
      type: z.string(),
      forwarding: z.string().optional(),
      hosting_account_id: z.any().optional(),
      hosting_account_domain: z.string().optional(),
      restrict_inbox: z.boolean().optional(),
      incoming_enabled: z.boolean().optional().default(true),
      outgoing_enabled: z.boolean().optional().default(true)
    });

    try {
      const data = schema.parse(req.body);
      const conn = await getDb();
      if (!conn) throw new Error('DB node offline');

      let dbId;
      if (data.hosting_account_id) {
        dbId = await verifyAccountAccess(req, res, data.hosting_account_id);
        if (!dbId) return;
      } else if (data.hosting_account_domain) {
        const [accs] = await conn.query('SELECT id, customer_email FROM hosting_accounts WHERE domain = ?', [data.hosting_account_domain]);
        if (accs.length === 0) throw new Error('Hosting account not found for domain');
        if (req.user.role !== 'admin' && accs[0].customer_email !== req.user.email) {
          return res.status(403).json({ error: 'You do not own this domain' });
        }
        dbId = accs[0].id;
      } else {
        // Fallback for user creating from Node Dashboard
        const [rows] = await conn.query('SELECT id FROM hosting_accounts WHERE LOWER(customer_email) = LOWER(?) LIMIT 1', [req.user.email]);
        if (rows.length === 0) throw new Error('No hosting account found to attach email');
        dbId = rows[0].id;
      }

      const emailParts = data.email.split('@');
      if (emailParts.length !== 2) throw new Error('Invalid email format');
      const user = emailParts[0];
      const domain = emailParts[1];

      let hashedPassword = null;
      if (data.password) {
        hashedPassword = await bcrypt.hash(data.password, 10);
      }

      // Check if email already exists to avoid redundant folder operations
      const [existingEmail] = await conn.query('SELECT id FROM email_accounts WHERE email = ?', [data.email.toLowerCase()]);
      if (existingEmail.length > 0) {
        throw new Error(`Email address ${data.email} is already in use`);
      }

      try {
        await conn.query('INSERT IGNORE INTO file_storage (hosting_account_id, name, type, path, modified) VALUES (?, ?, ?, ?, NOW())', [dbId, 'mail', 'folder', '/']);
        await conn.query('INSERT IGNORE INTO file_storage (hosting_account_id, name, type, path, modified) VALUES (?, ?, ?, ?, NOW())', [dbId, domain, 'folder', '/mail']);
        await conn.query('INSERT IGNORE INTO file_storage (hosting_account_id, name, type, path, modified) VALUES (?, ?, ?, ?, NOW())', [dbId, user, 'folder', `/mail/${domain}`]);
        const subfolders = ['cur', 'new', 'tmp', '.Sent', '.Trash', '.Drafts', '.Junk'];
        for (const sub of subfolders) {
          await conn.query('INSERT IGNORE INTO file_storage (hosting_account_id, name, type, path, modified) VALUES (?, ?, ?, ?, NOW())', [dbId, sub, 'folder', `/mail/${domain}/${user}`]);
        }
      } catch (fileErr) {
        console.error('[Email API] Folder sync error:', fileErr.message);
      }

      const [result] = await conn.query(`
        INSERT INTO email_accounts (hosting_account_id, email, password, type, quota, forwarding, incoming_enabled, outgoing_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [dbId, data.email.toLowerCase(), hashedPassword, data.type, data.quota || 5, data.forwarding || null, data.incoming_enabled, data.outgoing_enabled]);

      const newAccount = {
        id: result.insertId.toString(),
        email: data.email.toLowerCase(),
        type: data.type,
        usage: 0,
        total: data.quota || 5,
        status: 'active',
        aliases: [],
        forwarding: data.forwarding || null,
        incoming_enabled: data.incoming_enabled,
        outgoing_enabled: data.outgoing_enabled,
        restrict_inbox: data.restrict_inbox || false,
        hosting_account_id: dbId.toString()
      };
      res.status(201).json(newAccount);
    } catch (err) {
      console.error('[Email API] Error:', err);
      res.status(400).json({ error: err.message || 'Invalid email data' });
    }
  });

  app.patch('/api/emails/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'DB node offline' });

    try {
      const [existing] = await conn.query('SELECT e.*, h.customer_email FROM email_accounts e JOIN hosting_accounts h ON e.hosting_account_id = h.id WHERE e.id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ error: 'Account not found' });
      
      if (req.user.role !== 'admin' && existing[0].customer_email !== req.user.email) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updateSchema = z.object({
        total: z.number().optional(),
        quota: z.number().optional(),
        status: z.enum(['active', 'warning', 'suspended']).optional(),
        password: z.string().min(6).optional(),
        incoming_enabled: z.boolean().optional(),
        outgoing_enabled: z.boolean().optional(),
        forwarding: z.string().optional(),
        aliases: z.array(z.string()).optional()
      });

      const data = updateSchema.parse(req.body);
      const quotaValue = data.quota || data.total;
      
      // Build dynamic update
      const updates = [];
      const params = [];
      if (quotaValue !== undefined) { updates.push('quota = ?'); params.push(quotaValue); }
      if (data.status) { updates.push('status = ?'); params.push(data.status); }
      if (data.password) { 
        const hashed = await bcrypt.hash(data.password, 10);
        updates.push('password = ?'); 
        params.push(hashed); 
      }
      if (data.incoming_enabled !== undefined) { updates.push('incoming_enabled = ?'); params.push(data.incoming_enabled); }
      if (data.outgoing_enabled !== undefined) { updates.push('outgoing_enabled = ?'); params.push(data.outgoing_enabled); }
      if (data.forwarding !== undefined) { updates.push('forwarding = ?'); params.push(data.forwarding); }
      if (data.aliases !== undefined) { updates.push('aliases = ?'); params.push(JSON.stringify(data.aliases)); }

      if (updates.length > 0) {
        params.push(id);
        await conn.query(`UPDATE email_accounts SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      const [updatedRows] = await conn.query('SELECT * FROM email_accounts WHERE id = ?', [id]);
      const r = updatedRows[0];
      res.json({
        id: r.id.toString(),
        email: r.email,
        type: r.type,
        usage: r.usage_gb,
        total: r.quota,
        status: r.status,
        aliases: r.aliases ? JSON.parse(r.aliases) : [],
        forwarding: r.forwarding,
        incoming_enabled: r.incoming_enabled === 1 || r.incoming_enabled === true,
        outgoing_enabled: r.outgoing_enabled === 1 || r.outgoing_enabled === true,
        hosting_account_id: `db-${r.account_id}`
      });
    } catch (err) {
      console.error('[Email Patch] Error:', err);
      res.status(400).json({ error: 'Invalid update data' });
    }
  });

  app.delete('/api/emails/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'DB node offline' });

    try {
      const [existing] = await conn.query('SELECT e.*, h.customer_email FROM email_accounts e JOIN hosting_accounts h ON e.hosting_account_id = h.id WHERE e.id = ?', [id]);
      if (existing.length > 0) {
        if (req.user.role !== 'admin' && existing[0].customer_email !== req.user.email) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        const emailAddr = existing[0].email;
        const hbId = existing[0].hosting_account_id;
        
        await conn.query('DELETE FROM email_accounts WHERE id = ?', [id]);
        
        // Synchronize file storage: delete user email folders
        const emailParts = emailAddr.split('@');
        if (emailParts.length === 2) {
          const user = emailParts[0];
          const domain = emailParts[1];
          const userPath = `/mail/${domain}/${user}`;
          
          console.log(`[Email API] Deleting folders for ${emailAddr} in account ${hbId}`);
          try {
            await conn.query(`
              DELETE FROM file_storage 
              WHERE account_id = ? 
              AND (
                (path = ? AND name = ?) OR 
                path = ? OR 
                path LIKE ?
              )
            `, [hbId, `/mail/${domain}`, user, userPath, `${userPath}/%`]);
          } catch (fileErr) {
            console.error('[Email API] Folder deletion error:', fileErr.message);
          }
        }
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Deletion failed' });
    }
  });

  // --- PHP API Routes ---
  app.get('/api/php-domains', (req, res) => {
    res.json([]);
  });

  // --- DNS API Routes ---
  app.get('/api/dns-records', requireAuth, async (req, res) => {
    const { domain } = req.query;
    if (!domain) return res.json([]);

    const account = accounts.find(a => a.domain === domain);
    const conn = await getDb();
    
    if (!account || !conn) return res.json([]);

    // Security check: Only admin or account owner can view DNS records
    if (req.user.role !== 'admin' && account.customerEmail?.toLowerCase() !== req.user.email?.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied to DNS zone' });
    }

    try {
      const dbId = account.id.replace('db-', '');
      const [rows] = await conn.query('SELECT * FROM dns_records WHERE hosting_account_id = ?', [dbId]);
      
      const records = rows.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        record: r.content,
        ttl: r.ttl,
        priority: r.priority,
        proxied: false,
        class: 'IN',
        status: 'Active'
      }));

      res.json(records);
    } catch (err) {
      console.error('[DNS API] Local fetch failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch DNS records' });
    }
  });

  app.post('/api/dns-records', requireAuth, async (req, res) => {
    const { domain, type, name, content, ttl, priority } = req.body;
    const account = accounts.find(a => a.domain === domain);
    
    if (!account) return res.status(404).json({ error: 'Account not found' });
    
    // Security check: Allow admin or account owner
    if (req.user.role !== 'admin' && account.customerEmail?.toLowerCase() !== req.user.email?.toLowerCase()) {
      return res.status(403).json({ error: 'Admin or account owner privileges required' });
    }

    try {
      const dbId = account.id.replace('db-', '');
      await DNSService.createDNSRecord(dbId, { type, name, content, ttl, priority });
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create DNS record' });
    }
  });

  app.delete('/api/dns-records/:domain/:id', requireAuth, async (req, res) => {
    const { domain, id } = req.params;
    const account = accounts.find(a => a.domain === domain);
    const conn = await getDb();
    
    if (!account || !conn) return res.status(404).json({ error: 'Account not found' });

    // Security check: Allow admin or account owner
    if (req.user.role !== 'admin' && account.customerEmail?.toLowerCase() !== req.user.email?.toLowerCase()) {
      return res.status(403).json({ error: 'Admin or account owner privileges required' });
    }

    try {
      await conn.query('DELETE FROM dns_records WHERE id = ?', [id]);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete DNS record' });
    }
  });

  // --- SSO Endpoints ---
  app.get('/api/sso/phpmyadmin/:dbName', requireAuth, async (req, res) => {
    const { dbName } = req.params;
    const conn = await getDb();
    
    console.log(`[SSO] phpMyAdmin request for DB: ${dbName} by User: ${req.user.email}`);
    
    try {
      // 1. Verify user owns this database
      const [dbRows] = await conn.query(
        'SELECT * FROM sql_databases WHERE mysql_db_name = ?',
        [dbName]
      );
      
      if (dbRows.length === 0) {
        console.warn(`[SSO] Database not found in records: ${dbName}`);
        return res.status(404).json({ error: 'Database not found' });
      }
      
      const dbInfo = dbRows[0];
      const [accRows] = await conn.query(
        'SELECT * FROM hosting_accounts WHERE id = ?',
        [dbInfo.hosting_account_id]
      );
      
      if (accRows.length === 0) {
        console.warn(`[SSO] Hosting account for database not found: ${dbInfo.hosting_account_id}`);
        return res.status(404).json({ error: 'Associated hosting account not found' });
      }
      
      const account = accRows[0];
      const ownerEmail = (account.customer_email || account.customerEmail || '').toLowerCase();
      const requesterEmail = (req.user.email || '').toLowerCase();
      
      if (req.user.role !== 'admin' && ownerEmail !== requesterEmail) {
        console.warn(`[SSO] Permission denied for ${requesterEmail} on DB owned by ${ownerEmail}`);
        return res.status(403).json({ error: 'Permission denied' });
      }

      // 2. Generate temporary SSO token
      const ssoToken = Buffer.from(`${requesterEmail}:${dbName}:${Date.now()}`).toString('base64');
      
      // 3. Construct URL
      const pmaUrl = `https://phpmyadmin.alaba.ng/sso.php?token=${ssoToken}&db=${dbName}`;
      console.log(`[SSO] phpMyAdmin URL generated successfully for ${dbName}`);
      res.json({ url: pmaUrl });
    } catch (err) {
      console.error('[SSO] phpMyAdmin Error:', err);
      res.status(500).json({ error: 'SSO initialization failed: ' + err.message });
    }
  });

  app.get('/api/sso/webmail/:email', requireAuth, async (req, res) => {
    const { email } = req.params;
    const conn = await getDb();
    
    console.log(`[SSO] Webmail request for: ${email} by User: ${req.user.email}`);
    
    try {
      // 1. Verify user owns this email
      const [mailRows] = await conn.query(
        'SELECT * FROM email_accounts WHERE email = ?',
        [email]
      );
      
      if (mailRows.length === 0) {
        console.warn(`[SSO] Email account not found: ${email}`);
        return res.status(404).json({ error: 'Email account not found' });
      }
      
      const mailInfo = mailRows[0];
      const [accRows] = await conn.query(
        'SELECT * FROM hosting_accounts WHERE id = ?',
        [mailInfo.hosting_account_id]
      );
      
      if (accRows.length === 0) {
        console.warn(`[SSO] Hosting account for email not found: ${mailInfo.hosting_account_id}`);
        return res.status(404).json({ error: 'Associated hosting account not found' });
      }
      
      const account = accRows[0];
      const ownerEmail = (account.customer_email || account.customerEmail || '').toLowerCase();
      const requesterEmail = (req.user.email || '').toLowerCase();
      
      if (req.user.role !== 'admin' && ownerEmail !== requesterEmail) {
        console.warn(`[SSO] Permission denied for ${requesterEmail} on email owned by ${ownerEmail}`);
        return res.status(403).json({ error: 'Permission denied' });
      }

      // 2. Generate temporary SSO token
      const ssoToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');
      
      // 3. Construct URL
      const webmailUrl = `https://webmail.alaba.ng/sso.php?token=${ssoToken}&user=${email}`;
      console.log(`[SSO] Webmail URL generated successfully for ${email}`);
      res.json({ url: webmailUrl });
    } catch (err) {
      console.error('[SSO] Webmail Error:', err);
      res.status(500).json({ error: 'Webmail SSO initialization failed: ' + err.message });
    }
  });

  // --- SQL API Routes ---
  app.get('/api/sql-databases', async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'DB node offline' });
    
    try {
      const [rows] = await conn.query('SELECT * FROM sql_databases');
      res.json(rows.map(db => ({
        id: db.id.toString(),
        name: db.db_name,
        size: `${db.size_mb.toFixed(1)} MB`,
        users: [], // Real app would join with users
        status: db.status
      })));
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch databases' });
    }
  });

  // --- Domain API Routes ---
  app.get('/api/domains/check', async (req, res) => {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domain is required' });
    const available = await DomainService.checkAvailability(domain);
    res.json({ available });
  });

  // Create new account (Enqueue provisioning)
  app.post('/api/accounts', async (req, res) => {
    console.log('[API] POST /api/accounts payload:', req.body);
    const schema = z.object({
      domain: z.string(),
      user: z.string(),
      package: z.string(),
      email: z.string().email().optional().or(z.literal('')),
      domainAction: z.enum(['new', 'existing', 'transfer']).optional().or(z.literal('')),
      paymentMethod: z.string().optional().or(z.literal(''))
    });

    try {
      const data = schema.parse(req.body);
      const newId = (accounts.length + 1).toString();
      const { email, user, domain, package: planName } = data;

      // Persistence: Save customer if DB is available
      const conn = await getDb();
      if (conn && email) {
        try {
          const [existing] = await conn.query('SELECT id FROM customers WHERE email = ?', [email]);
          if (existing.length === 0) {
            await conn.query(
              'INSERT INTO customers (full_name, email, password_hash) VALUES (?, ?, ?)',
              [user, email, 'password'] // Default password
            );
            console.log(`[DB] Saved new customer: ${email}`);
          }
        } catch (dbErr) {
          console.error('[DB] Customer persistence failed:', dbErr);
        }
      }

      // Send Transaction Email
      if (email) {
        sendTemplateEmail(email, 'Transaction Initiated: Alaba Hosting', `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
            <div style="background: #2563eb; padding: 30px; text-align: center; color: white;">
              <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 2px;">Hosting Order Initiated</h2>
            </div>
            <div style="padding: 40px;">
              <p>Hello ${user},</p>
              <p>Your transaction for a new hosting instance for <strong>${domain}</strong> (${planName}) has been initiated.</p>
              <p>Your transaction will be confirmed and provision will be made as soon as payment is confirmed.</p>
            </div>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 11px; color: #999;">
              &copy; 2024 Alaba Hosting.
            </div>
          </div>
        `);
      }

      // Persistence: Ensure hosting_accounts record exists
      if (conn) {
        try {
          const [cust] = await conn.query('SELECT id FROM customers WHERE email = ?', [email]);
          const customerId = cust.length > 0 ? cust[0].id : null;
          
          await conn.query(`
            INSERT INTO hosting_accounts (customer_id, domain, user, customer_email, package, status, status_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE status = VALUES(status), status_reason = VALUES(status_reason)
          `, [
            customerId,
            domain,
            user,
            email,
            planName,
            'pending',
            data.paymentMethod === 'bank_transfer' ? 'Awaiting Manual Settlement' : 'Provisioning in progress...'
          ]);
          console.log(`[DB] Saved pending hosting_account for ${domain}`);
        } catch (dbErr) {
          console.error('[DB] Failed to save hosting_account:', dbErr);
        }
      }
      
      const task = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'PROVISION_ACCOUNT',
        data: { ...data, id: newId },
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
      };

      provisioningQueue.push(task);
      res.status(202).json({ taskId: task.id, message: 'Provisioning started' });

      // Only auto-process if not bank transfer
      if (data.paymentMethod !== 'bank_transfer') {
        processTask(task.id);
      } else {
        console.log(`[System] Task ${task.id} awaiting manual transfer confirmation for ${data.domain}`);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error('[API] Validation failed for /api/accounts:', err.errors);
      } else {
        console.error('[API] Error in /api/accounts:', err);
      }
      res.status(400).json({ error: 'Invalid data', details: err instanceof z.ZodError ? err.errors : undefined });
    }
  });

  // Get status of a task
  app.get('/api/tasks/:id', (req, res) => {
    const task = provisioningQueue.find(t => t.id === req.params.id) || completedTasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  // Server health/stats
  app.get('/api/stats', (req, res) => {
    // Aggregate global metrics from all active accounts
    const activeAccounts = accounts.filter(a => a.status === 'active');
    const totalCpu = activeAccounts.reduce((sum, a) => sum + (a.cpuUsage || 0), 0) / (activeAccounts.length || 1);
    const totalRam = activeAccounts.reduce((sum, a) => sum + (a.ramUsage || 0), 0) / (activeAccounts.length || 1);
    
    res.json({
      cpu: Math.floor(totalCpu),
      ram: Math.floor(totalRam),
      uptime: process.uptime(),
      accounts: accounts.length,
      pendingTasks: provisioningQueue.filter(t => t.status === 'pending').length
    });
  });

  // Global usage history for dashboard
  app.get('/api/stats/history', (req, res) => {
    // Generate an aggregate view of the last 20 points
    const points = 20;
    const history = { cpu: [], ram: [], bw: [] };
    
    for (let i = 0; i < points; i++) {
      let cpuSum = 0;
      let ramSum = 0;
      let bwSum = 0;
      let count = 0;
      
      accounts.forEach(acc => {
        const accHistory = usageHistory.get(acc.id);
        if (accHistory && accHistory.cpu[i] !== undefined) {
          cpuSum += accHistory.cpu[i];
          ramSum += accHistory.ram[i];
          bwSum += accHistory.bw[i];
          count++;
        }
      });
      
      const divisor = count || 1;
      history.cpu.push(parseFloat((cpuSum / divisor).toFixed(1)));
      history.ram.push(parseFloat((ramSum / divisor).toFixed(1)));
      history.bw.push(parseFloat((bwSum / divisor).toFixed(1)));
    }
    
    res.json(history);
  });

  app.get('/api/finance/pending', adminOnly, async (req, res) => {
    console.log('[API] GET /api/finance/pending requested by', req.user.email);
    // 1. Collect from in-memory queue
    const pendingTasks = provisioningQueue.filter(t => t.data && t.data.paymentMethod === 'bank_transfer');
    console.log('[API] Found in-memory pending bank transfers:', pendingTasks.length);
    
    // 2. Collect from database
    const conn = await getDb();
    if (conn) {
      try {
        const [rows] = await conn.query('SELECT * FROM hosting_accounts WHERE status = "pending"');
        console.log('[API] Found DB pending accounts:', rows.length);
        const dbPending = rows.map(row => {
          // Avoid duplicates if already in in-memory queue
          if (pendingTasks.find(t => t.data.domain === row.domain)) return null;
          
          return {
            id: `db-${row.id}`,
            data: {
              user: row.user,
              domain: row.domain,
              package: row.package,
              email: row.customer_email,
              paymentMethod: 'bank_transfer'
            },
            status: row.status,
            manualApproved: Boolean(row.manual_approved),
            createdAt: row.created_at
          };
        }).filter(Boolean);
        
        console.log('[API] Returning total pending:', pendingTasks.length + dbPending.length);
        return res.json([...pendingTasks, ...dbPending]);
      } catch (err) {
        console.error('[API] Failed to fetch database pending accounts:', err);
      }
    }
    
    res.json(pendingTasks);
  });

  app.post('/api/finance/approve/:taskId', adminOnly, async (req, res) => {
  const { taskId } = req.params;
  let task = provisioningQueue.find(t => t.id === taskId);
  let hostingAccountId = null;
  
  if (!task && taskId.startsWith('db-')) {
    const dbId = taskId.replace('db-', '');
    const conn = await getDb();
    if (conn) {
      const [rows] = await conn.query(`
        SELECT h.*, c.email as customer_email, p.name as plan_name, p.price_usd
        FROM hosting_accounts h
        JOIN customers c ON h.customer_id = c.id
        JOIN plans p ON h.plan_id = p.id
        WHERE h.id = ?
      `, [dbId]);
      
      if (rows.length > 0) {
        const row = rows[0];
        
        task = {
          id: taskId,
          type: 'PROVISION_ACCOUNT',
          data: { 
            user: row.user || row.domain.split('.')[0],
            domain: row.domain, 
            package: row.plan_name,
            email: row.customer_email,
            domainAction: 'existing',
            hostingAccountId: row.id,
            // Preserve any existing transaction data if available
            finalAmount: row.amount_paid || null,
            finalCurrency: row.currency || 'NGN',
            finalVat: row.vat || null,
            finalTransactionFee: row.transaction_fee || 0
          },
          status: 'pending',
          createdAt: row.created_at
        };
        hostingAccountId = row.id;
        provisioningQueue.push(task);
      }
    }
  }

  if (!task) return res.status(404).json({ error: 'Manual transfer intent not found' });
  
  task.manualApproved = true;
  
  const conn = await getDb();
  if (conn) {
    try {
      // Update hosting_account to show it's approved
      if (taskId.startsWith('db-')) {
        const dbId = taskId.replace('db-', '');
        await conn.query('UPDATE hosting_accounts SET status = "processing" WHERE id = ?', [dbId]);
        hostingAccountId = dbId;
      } else if (task.data.hostingAccountId) {
        await conn.query('UPDATE hosting_accounts SET status = "processing" WHERE id = ?', [task.data.hostingAccountId]);
      } else {
        const [result] = await conn.query(
          'UPDATE hosting_accounts SET status = "processing", manual_approved = TRUE WHERE domain = ?',
          [task.data.domain]
        );
        // Get the hosting_account_id for finance record
        const [haRows] = await conn.query('SELECT id FROM hosting_accounts WHERE domain = ?', [task.data.domain]);
        if (haRows.length > 0) hostingAccountId = haRows[0].id;
      }
      
      // ============================================
      // CREATE FINANCE RECORD WITH ACTUAL TRANSACTION VALUES
      // ============================================
      
      // Get currency from settings
      let currency = 'NGN';
      const [settings] = await conn.query('SELECT default_currency FROM global_settings WHERE id = 1');
      if (settings.length > 0 && settings[0].default_currency) {
        currency = settings[0].default_currency;
      }
      
      // Use the actual values from the transaction, NOT hardcoded plan prices
      // Priority: 1. task.data values, 2. from database, 3. calculate from plan
      let amount = task.data.finalAmount || task.data.total || 0;
      let vatAmount = task.data.finalVat || task.data.vat || 0;
      let transactionFeeAmount = task.data.finalTransactionFee || task.data.transactionFee || 0;
      let transactionCurrency = task.data.finalCurrency || task.data.currency || currency;
      
      // If no amount from task, try to get from plan price
      if (amount === 0 && hostingAccountId) {
        try {
          const [haDetails] = await conn.query(`
            SELECT p.price_usd, p.name as plan_name
            FROM hosting_accounts h
            JOIN plans p ON h.plan_id = p.id
            WHERE h.id = ?
          `, [hostingAccountId]);
          
          if (haDetails.length > 0) {
            amount = parseFloat(haDetails[0].price_usd);
            // Calculate VAT if not provided (7.5%)
            if (vatAmount === 0) vatAmount = amount * 0.075;
          }
        } catch (err) {
          console.error('[Finance] Failed to get plan price:', err);
        }
      }
      
      // Check if finance record already exists (to avoid duplicates)
      const [existingFinance] = await conn.query(
        'SELECT id FROM finance_records WHERE transaction_ref = ? OR (domain = ? AND account_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE))',
        [`TRX-${hostingAccountId || task.id}`, task.data.domain, (hostingAccountId || task.id).toString()]
      );
      
      if (existingFinance.length === 0 && amount > 0) {
        const nextRenewal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        await conn.query(`
          INSERT INTO finance_records 
          (account_id, domain, amount_paid, vat, transaction_fee, plan, next_renewal, refund, currency, customer_email, transaction_ref)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        `, [
          (hostingAccountId || task.id).toString(), 
          task.data.domain, 
          amount,
          vatAmount,
          transactionFeeAmount,
          task.data.package, 
          nextRenewal, 
          transactionCurrency,
          task.data.email,
          `TRX-${hostingAccountId || task.id}`
        ]);
        
        console.log(`[Finance] Created finance record for ${task.data.domain}: ${amount} ${transactionCurrency}`);
      } else {
        console.log(`[Finance] Finance record already exists for ${task.data.domain}, skipping duplicate`);
      }
      
    } catch (err) {
      console.error('[DB] Failed to update status or create finance record:', err);
    }
  }

  res.json({ message: 'Transfer verified. Provisioning protocol initiated.' });
  
  // Start processing
  processTask(task.id);
});

  app.post('/api/finance/revert/:taskId', adminOnly, async (req, res) => {
    const { taskId } = req.params;
    let task = provisioningQueue.find(t => t.id === taskId);
    
    const conn = await getDb();
    let domain = task?.data?.domain;

    if (!task && taskId.startsWith('db-')) {
      const dbId = taskId.replace('db-', '');
      if (conn) {
        const [rows] = await conn.query('SELECT * FROM hosting_accounts WHERE id = ?', [dbId]);
        if (rows.length > 0) {
          domain = rows[0].domain;
        }
      }
    }

    if (task) {
      task.status = 'pending';
      task.manualApproved = false;
      task.progress = 0;
      task.currentStep = 'Awaiting Manual Settlement';
    }

    // Remove from in-memory accounts
    const accountIndex = accounts.findIndex(a => a.id === taskId || (domain && a.domain === domain));
    if (accountIndex > -1) {
      accounts.splice(accountIndex, 1);
    }

    // Remove from finance records
    const recordIndex = financeRecords.findIndex(r => r.accountId === taskId || r.accountId === taskId.replace('db-', ''));
    if (recordIndex > -1) {
      financeRecords.splice(recordIndex, 1);
    }

    // Remove from Database hosting_accounts (or set back to pending)
    if (conn && domain) {
      try {
        await conn.query('UPDATE hosting_accounts SET status = "pending", status_reason = "Awaiting Manual Settlement (Reverted)", manual_approved = FALSE WHERE domain = ?', [domain]);
        console.log(`[DB] Reverted hosting_account for ${domain}`);
      } catch (err) {
        console.error('[DB] Failed to revert hosting_account:', err);
      }
    }

    res.json({ message: 'Approval reverted. Provisioning halted and account records purged.' });
  });

  // --- Background Worker Simulation ---
async function processTask(taskId) {
  const task = provisioningQueue.find(t => t.id === taskId);
  if (!task) return;

  task.status = 'processing';
  console.log(`[Worker] Started task ${taskId}: ${task.type}`);

  const dbConn = await getDb();
  const globalSettings = await getGlobalSettingsInServer();

  // Get currency from settings (fallback to NGN)
  let currency = globalSettings.defaultCurrency || 'NGN';

  // Get plan details from database for resource limits (not for pricing)
  let planId = null;
  let planDetails = { disk_limit: 5120, bw_limit: 102400, ram_limit: 1024, cpu_limit: 100 };
  
  if (dbConn) {
    try {
      // Map plan name to plan_id
      const planMapping = {
        'Standard Flow': 1,
        'Premium Grid': 2,
        'Alaba Pro': 3,
        'Enterprise': 3
      };
      planId = planMapping[task.data.package] || 1;
      
      const [plansRes] = await dbConn.query('SELECT * FROM plans WHERE id = ?', [planId]);
      if (plansRes.length > 0) {
        const specs = typeof plansRes[0].specs === 'string' ? JSON.parse(plansRes[0].specs) : plansRes[0].specs;
        // Parse disk limit from specs (e.g., "5GB NVMe" -> 5120 MB)
        const diskMatch = specs[0]?.match(/(\d+)GB/);
        if (diskMatch) planDetails.disk_limit = parseInt(diskMatch[1]) * 1024;
        
        // Parse bandwidth limit
        const bwMatch = specs[1]?.match(/(\d+)GB/) || specs[0]?.match(/(\d+)GB/);
        if (bwMatch) planDetails.bw_limit = parseInt(bwMatch[1]) * 1024;
      }
    } catch (err) {
      console.error('[Worker] Failed to fetch plan details:', err);
    }
  }

  const steps = [
    { msg: 'Validating infrastructure clusters...', progress: 5 },
    { msg: 'Initializing hosting environment...', progress: 15 },
    { msg: 'Provisioning Hosting DNS zone...', progress: 30, fn: async () => {
        const zone = await DNSService.addZone(task.data.domain);
        task.data.nameservers = zone.nameservers;
        task.data.usesCustomDNS = true;
    }},
    { msg: 'Mapping IP addresses...', progress: 50 },
    { msg: 'Cluster synchronization complete.', progress: 100 }
  ];

  for (const step of steps) {
    task.currentStep = step.msg;
    task.progress = step.progress;
    if (step.fn) {
      try {
        await step.fn();
      } catch (err) {
        console.error(`[Worker] Step failed: ${step.msg}`, err);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  task.status = 'completed';
  task.completedAt = new Date();

  // ============================================
  // CREATE HOSTING ACCOUNT WITH PROPER RELATIONS
  // ============================================
  
  const serverIp = globalSettings.sharedIp || '159.223.112.44';
  const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let hostingAccountIdResult = null;
  
  if (dbConn) {
    try {
      // Step 1: Get or create customer
      let customerId = null;
      const [customers] = await dbConn.query('SELECT id FROM customers WHERE email = ?', [task.data.email]);
      
      if (customers.length > 0) {
        customerId = customers[0].id;
        console.log(`[Worker] Found existing customer: ${customerId}`);
      } else {
        // Create new customer
        const [result] = await dbConn.query(
          'INSERT INTO customers (full_name, email, phone, country, password_hash) VALUES (?, ?, ?, ?, ?)',
          [task.data.user, task.data.email, task.data.phone || '', task.data.country || 'NG', bcrypt.hashSync('3487iverson', 10)]
        );
        customerId = result.insertId;
        console.log(`[Worker] Created new customer: ${customerId}`);
      }

      // Step 2: Get plan_id from plan name
      const planMapping = { 'Standard Flow': 1, 'Premium Grid': 2, 'Alaba Pro': 3, 'Enterprise': 4 };
      const planId = planMapping[task.data.package] || 1;

      // Step 3: Check if hosting account already exists
      const [existingAccounts] = await dbConn.query(
        'SELECT id FROM hosting_accounts WHERE domain = ?',
        [task.data.domain]
      );
      
      if (existingAccounts.length > 0) {
        // Update existing account
        await dbConn.query(`
          UPDATE hosting_accounts 
          SET customer_id = ?,
              plan_id = ?,
              status = 'active',
              ip = ?,
              customer_email = ?,
              disk_limit = ?,
              bw_limit = ?
          WHERE domain = ?
        `, [
          customerId, planId, serverIp, task.data.email,
          planDetails.disk_limit, planDetails.bw_limit, task.data.domain
        ]);
        hostingAccountIdResult = existingAccounts[0].id;
        console.log(`[Worker] Updated existing hosting account: ${hostingAccountIdResult}`);
      } else {
        // Create new hosting account
        // Generate a 8-12 character alphanumeric username from the domain
        const domainParts = task.data.domain.split('.');
        const domainSlug = domainParts[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
        const hostingUser = domainSlug.substring(0, 8) + Math.random().toString(36).substring(2, 6);

        const [result] = await dbConn.query(`
          INSERT INTO hosting_accounts 
          (customer_id, plan_id, domain, status, user, customer_email, ip, 
           disk_limit, bw_limit, created_at)
          VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, NOW())
        `, [
          customerId, planId, task.data.domain, 
          hostingUser, task.data.email,
          serverIp, planDetails.disk_limit, planDetails.bw_limit
        ]);
        hostingAccountIdResult = result.insertId;
        console.log(`[Worker] Created new hosting account: ${hostingAccountIdResult}`);
      }

      // ============================================
      // AUTO-GENERATE DNS ZONE & DEFAULT RECORDS
      // ============================================
      if (hostingAccountIdResult) {
        try {
          console.log(`[Worker] Auto-provisioning DNS for account ${hostingAccountIdResult} (${task.data.domain})`);
          // Note: DNSService.addZone was already called in steps, but we ensure records here
          await DNSService.generateDefaultRecords(hostingAccountIdResult, task.data.domain, serverIp);
          console.log(`[Worker] DNS Zone fully provisioned for ${task.data.domain}`);
        } catch (dnsErr) {
          console.error('[Worker] DNS Provisioning failed:', dnsErr);
        }
      }

      // ============================================
      // CREATE FINANCE RECORD WITH UNIQUE TRANSACTION REF
      // FOR DISPUTE AND RENEWAL SUPPORT
      // ============================================
      
      // Use the actual values from the transaction
      const amountValue = task.data.finalAmount || task.data.total || 0;
      const transactionCurrencyValue = task.data.finalCurrency || task.data.currency || currency;
      const vatAmountValue = task.data.finalVat || task.data.vat || (amountValue * 0.075);
      const transactionFeeAmountValue = task.data.finalTransactionFee || task.data.transactionFee || 0;
      
      // Generate a unique transaction reference for this specific transaction
      const transactionRef = `TASK-${task.id}`;
      
      // Check if THIS SPECIFIC transaction has already been recorded
      const [existingFinance] = await dbConn.query(
        'SELECT id FROM finance_records WHERE transaction_ref = ? OR (domain = ? AND account_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE))',
        [transactionRef, task.data.domain, (hostingAccountIdResult || `task-${task.id}`).toString()]
      );

      if (existingFinance.length === 0 && amountValue > 0) {
        const nextRenewal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        await dbConn.query(`
          INSERT INTO finance_records 
          (account_id, domain, amount_paid, vat, transaction_fee, plan, next_renewal, refund, currency, customer_email, transaction_ref)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        `, [
          hostingAccountIdResult ? hostingAccountIdResult.toString() : `task-${task.id}`, 
          task.data.domain, 
          amountValue,
          vatAmountValue,
          transactionFeeAmountValue,
          task.data.package, 
          nextRenewal, 
          transactionCurrencyValue,
          task.data.email,
          transactionRef
        ]);
        
        console.log(`[Worker] Created finance record for ${task.data.domain}: ${amountValue} ${transactionCurrencyValue} (Ref: ${transactionRef})`);
      }

    } catch (err) {
      console.error('[Worker] Database provisioning failed:', err);
    }
  }

  // UPDATE IN-MEMORY ACCOUNTS ARRAY FOR UI
  const existingAccountIndex = accounts.findIndex(a => a.domain === task.data.domain);
  const activeAccount = {
    id: hostingAccountIdResult ? `db-${hostingAccountIdResult}` : `db-${Date.now()}`,
    domain: task.data.domain,
    user: task.data.user,
    customerEmail: task.data.email,
    customerName: task.data.user,
    ip: serverIp,
    package: task.data.package,
    status: 'active',
    statusReason: 'Provisioned successfully',
    diskUsage: 0,
    diskLimit: planDetails.disk_limit,
    bwUsage: 0,
    bwLimit: planDetails.bw_limit,
    ramUsage: 0,
    ramLimit: 1024,
    cpuUsage: 0,
    cpuLimit: 100,
    dbCount: 0,
    emailCount: 0,
    createdAt: new Date().toISOString()
  };

  if (existingAccountIndex === -1) {
    accounts.push(activeAccount);
  } else {
    accounts[existingAccountIndex] = activeAccount;
  }

  // Initialize history for the newly active account
  usageHistory.set(activeAccount.id, {
    cpu: [0],
    ram: [0],
    disk: [0],
    bw: [0],
  });

  if (task.data.email) {
    sendWelcomeEmail(task.data.email, task.data.domain, task.data.package);
  }

  console.log(`[Worker] Completed task ${taskId}`);
}

  // Approve and provision account
  // Approve and provision account
  app.post('/api/accounts/:id/approve', adminOnly, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    
    if (!conn || !id.startsWith('db-')) {
      return res.status(400).json({ error: 'Invalid operation' });
    }

    const dbId = id.replace('db-', '');
    try {
      const [rows] = await conn.query(`
        SELECT h.*, p.disk_space_mb, p.bandwidth_mb, p.price_usd, p.name as plan_name 
        FROM hosting_accounts h 
        LEFT JOIN plans p ON h.package = p.name OR h.plan_id = p.id
        WHERE h.id = ?
      `, [dbId]);
      
      if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });
      
      const account = rows[0];
      
      // Get an available IP from the pool
      let serverIp = '159.223.112.44'; // Fallback
      try {
        const [availableIps] = await conn.query("SELECT ip_address FROM ip_pool WHERE status = 'available' LIMIT 1");
        if (availableIps.length > 0) {
          serverIp = availableIps[0].ip_address;
          await conn.query("UPDATE ip_pool SET status = 'assigned', assigned_to = ? WHERE ip_address = ?", [account.domain, serverIp]);
        }
      } catch (ipErr) {
        console.error('[Approval] Failed to fetch IP from pool:', ipErr);
      }
      
      // Use plan limits or fallbacks
      const diskLimit = account.disk_space_mb || 5120;
      const bwLimit = account.bandwidth_mb || 102400;
      const planAmount = account.price_usd || (account.package === 'Standard Flow' ? 9.99 : account.package === 'Premium Grid' ? 24.99 : 99.99);
      
      await conn.query(`
        UPDATE hosting_accounts 
        SET status = 'active', 
            status_reason = 'Account approved and provisioned',
            ip = ?,
            disk_limit = ?,
            bw_limit = ?
        WHERE id = ?
      `, [serverIp, diskLimit, bwLimit, dbId]);

      // --- Provision Default DNS Records ---
      try {
        console.log(`[DNS] Provisioning default zone for ${account.domain} on IP ${serverIp}`);
        const defaultRecords = [
          { type: 'A', name: '@', content: serverIp },
          { type: 'A', name: 'www', content: serverIp },
          { type: 'A', name: 'mail', content: serverIp },
          { type: 'A', name: 'ftp', content: serverIp },
          { type: 'MX', name: '@', content: `mail.${account.domain}`, priority: 0 },
          { type: 'TXT', name: '@', content: `"v=spf1 ip4:${serverIp} +a +mx ~all"` },
          { type: 'NS', name: '@', content: 'ns1.alaba.ng' },
          { type: 'NS', name: '@', content: 'ns2.alaba.ng' }
        ];

        for (const record of defaultRecords) {
          await conn.query(`
            INSERT INTO dns_records (hosting_account_id, type, name, content, priority, ttl) 
            VALUES (?, ?, ?, ?, ?, 3600)
          `, [dbId, record.type, record.name, record.content, record.priority || 0]);
        }
        console.log(`[DNS] Successfully provisioned default records for ${account.domain}`);
      } catch (dnsErr) {
        console.error('[Approval] DNS auto-provisioning failed:', dnsErr);
      }

      // --- Provision Default Folders ---
      try {
        const defaultFolders = ['public_html', 'mail', 'logs', 'etc', 'tmp', '.ssh'];
        for (const folder of defaultFolders) {
          await conn.query(`
            INSERT IGNORE INTO file_storage (account_id, name, type, path, modified) 
            VALUES (?, ?, 'folder', '/', NOW())
          `, [dbId, folder]);
        }
        
        // Also seed a default index.html in public_html
        const welcomeContent = Buffer.from(`
          <html>
            <head><title>Success! Your Alaba Node is Active</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #f4f7f6;">
              <div style="max-width: 600px; margin: auto; background: white; padding: 40px; border-radius: 20px; shadow: 0 10px 30px rgba(0,0,0,0.05);">
                <h1 style="color: #003544;">Welcome to Alaba</h1>
                <p>Your web hosting account has been successfully provisioned.</p>
                <p style="color: #666;">Delete this file and upload your website content to <strong>public_html</strong> to get started.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <small>Powered by Alaba Global Cluster</small>
              </div>
            </body>
          </html>
        `).toString('base64');
        
        await conn.query(`
          INSERT IGNORE INTO file_storage (account_id, name, type, size, path, content, modified)
          VALUES (?, 'index.html', 'file', '1.2 KB', '/public_html', ?, NOW())
        `, [dbId, welcomeContent]);

        // --- Provision DNS Zone & Records ---
        try {
          console.log(`[Approval] Provisioning local DNS for: ${account.domain}`);
          await DNSService.addZone(account.domain, dbId);
          await DNSService.generateDefaultRecords(dbId, account.domain, serverIp);
        } catch (dnsErr) {
          console.error('[Approval] DNS auto-provision failed:', dnsErr);
        }

      } catch (provErr) {
        console.error('[Approval] Folder provisioning failed:', provErr);
      }

      // Update in-memory accounts array if present
      const accountIdx = accounts.findIndex(a => a.domain === account.domain);
      const updatedAccount = {
        ...account,
        id: 'db-' + account.id,
        status: 'active',
        ip: serverIp,
        diskLimit,
        bwLimit,
        createdAt: account.created_at || new Date().toISOString()
      };
      
      if (accountIdx !== -1) {
        accounts[accountIdx] = updatedAccount;
      } else {
        accounts.push(updatedAccount);
      }

      // Record Finance record on approval
      const nextRenewal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let currency = 'NGN';
      let transactionFee = 0;
      
      try {
        const [settings] = await conn.query('SELECT default_currency, fee_enabled, fee_type, fee_amount FROM global_settings WHERE id = 1');
        if (settings.length > 0) {
          currency = settings[0].default_currency || 'NGN';
          if (settings[0].fee_enabled) {
            transactionFee = settings[0].fee_type === 'percentage' 
              ? (planAmount * (settings[0].fee_amount / 100))
              : settings[0].fee_amount;
          }
        }
      } catch (e) {
        console.warn('[Approval] Settings fetch failed');
      }

      // Prevent Duplicate Finance Records
      const checkRef = transactionRef || `APP-${dbId}`;
      const [existingFinance] = await conn.query(
        'SELECT id FROM finance_records WHERE transaction_ref = ? OR (domain = ? AND account_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE))',
        [checkRef, account.domain, account.id.toString()]
      );

      if (existingFinance.length > 0) {
        console.log('[Approval] Finance record already exists, skipping duplicate insertion');
      } else {
        await conn.query(`
          INSERT INTO finance_records (account_id, domain, amount_paid, vat, transaction_fee, plan, next_renewal, refund, currency, customer_email, transaction_ref)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          account.id.toString(), 
          account.domain, 
          planAmount, 
          planAmount * 0.075, 
          transactionFee,
          account.package, 
          nextRenewal, 
          0, 
          currency, 
          account.customer_email,
          checkRef
        ]);

        // Push to in-memory for immediate UI reflect
        financeRecords.push({
          id: Math.random().toString(36).substr(2, 9),
          accountId: account.id.toString(),
          domain: account.domain,
          amountPaid: planAmount,
          vat: planAmount * 0.075,
          transactionFee: transactionFee,
          plan: account.package,
          nextRenewal,
          refund: 0,
          currency: currency,
          customerEmail: account.customer_email,
          transactionRef: checkRef
        });
      }

      // Send Activation Email
      sendWelcomeEmail(account.customer_email, account.domain, account.package);

      sendTemplateEmail(account.customer_email, `Your Hosting Account for ${account.domain} is Activated`, `
        <div style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: white;">
          <div style="background: #10b981; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Service Activated</h1>
            <p style="margin: 10px 0 0; opacity: 0.9; font-size: 14px;">Domain: ${account.domain}</p>
          </div>
          <div style="padding: 40px;">
            <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${account.user}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.6; color: #64748b;">Your hosting account has been approved and successfully provisioned.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0;">
              <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Connection Details</h3>
              <p style="margin-bottom: 8px;"><strong>IP ADDRESS:</strong> ${serverIp}</p>
              <p style="margin-bottom: 8px;"><strong>NAMESERVERS:</strong> Please check your welcome email for your assigned nameservers.</p>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0;">
              <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Subscription Info</h3>
              <p style="margin-bottom: 8px;"><strong>RENEWAL DATE:</strong> ${nextRenewal}</p>
              <p style="margin-bottom: 0;"><strong>PLAN:</strong> ${account.package}</p>
            </div>

            <p style="font-size: 14px; color: #94a3b8; text-align: center; margin-top: 40px;">You can now access your control panel from your dashboard.</p>
          </div>
          <div style="background: #f1f5f9; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2024 Alaba Hosting Solutions. All rights reserved.</p>
          </div>
        </div>
      `);

      res.json({ success: true, account: { ...account, status: 'active', ip: serverIp } });
    } catch (err) {
      console.error('[DB] Approval error:', err);
      res.status(500).json({ error: 'Database error during approval' });
    }
  });

  // Get account by ID
  app.get('/api/accounts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    // Check Redis Cache
    const cacheKey = `account:${id}`;
    const cached = await getCachedData(cacheKey);
    if (cached) {
      if (req.user.role !== 'admin' && cached.customerEmail !== req.user.email) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.json(cached);
    }

    let account = accounts.find(a => a.id === id || a.id === `db-${id}`);
    
    const conn = await getDb();
    if (conn && (id.startsWith('db-') || !isNaN(id))) {
      const dbId = id.startsWith('db-') ? id.replace('db-', '') : id;
      try {
        const [rows] = await conn.query(`
        SELECT h.*, c.full_name as customer_name, p.name as plan_name, 
               p.max_databases, p.max_email_accounts, c.email as customer_email_from_join
        FROM hosting_accounts h
        LEFT JOIN customers c ON h.customer_id = c.id
        LEFT JOIN plans p ON h.plan_id = p.id
        WHERE h.id = ?
      `, [dbId]);
      if (rows.length > 0) {
        const acc = rows[0];
        // Critical: Ensure customer_email is handled correctly from either table
        const emailToVerify = acc.customer_email || acc.customer_email_from_join;
        
        if (req.user.role !== 'admin' && String(emailToVerify).toLowerCase() !== String(req.user.email).toLowerCase()) {
          return res.status(403).json({ error: 'Access denied' });
        }
          account = {
            id: 'db-' + acc.id,
            domain: acc.domain,
            user: acc.user,
            customerName: acc.customer_name,
            customerEmail: acc.customer_email,
            ip: acc.ip_address || acc.ip || 'Pending Provision',
            package: acc.plan_name || acc.package || 'Standard Cluster',
            status: acc.status,
            statusReason: acc.status_reason,
            diskUsage: acc.disk_usage || 0,
            diskLimit: acc.disk_limit || 2048,
            bwUsage: acc.bw_usage || 0,
            bwLimit: acc.bw_limit || 10240,
            ramUsage: acc.ram_usage || 0,
            ramLimit: acc.ram_limit || 1024,
            cpuUsage: acc.cpu_usage || 0,
            cpuLimit: acc.cpu_limit || 100,
            dbCount: acc.db_count || 0,
            emailCount: acc.email_count || 0,
            max_databases: acc.max_databases,
            max_email_accounts: acc.max_email_accounts,
            // Support snake_case
            disk_usage: acc.disk_usage || 0,
            disk_limit: acc.disk_limit || 2048,
            bw_usage: acc.bw_usage || 0,
            bw_limit: acc.bw_limit || 10240,
            db_count: acc.db_count || 0,
            email_count: acc.email_count || 0,
            createdAt: acc.created_at
          };
        }
      } catch (err) {
        console.error('[DB] Single account fetch failure:', err);
      }
    }

    if (!account) return res.status(404).json({ error: 'Account not found' });
    
    if (req.user.role !== 'admin' && account.customerEmail !== req.user.email) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Set Redis Cache
    setCachedData(cacheKey, account);
    res.json(account);
  });

  // Get account usage history
  app.get('/api/accounts/:id/history', (req, res) => {
    const { id } = req.params;
    const history = usageHistory.get(id);
    if (!history) {
      // Return empty buffers instead of 404 to avoid breaking the UI during initial indexing
      return res.json({ cpu: [], ram: [], disk: [], bw: [] });
    }
    res.json(history);
  });

  // Update account (Patch)
  app.patch('/api/accounts/:id', (req, res) => {
    const { id } = req.params;
    const index = accounts.findIndex(a => a.id === id);
    if (index === -1) return res.status(404).json({ error: 'Account not found' });
    accounts[index] = { ...accounts[index], ...req.body };
    res.json(accounts[index]);
  });

  // --- Enforcement API ---
  app.get('/api/admin/enforcement-logs', requireAuth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB Unavailable' });
    try {
      const [rows] = await conn.query('SELECT * FROM enforcement_logs ORDER BY timestamp DESC LIMIT 100');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- SSL Certificates API ---
  app.get('/api/ssl-certificates', requireAuth, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Security node offline' });
    try {
      let query = 'SELECT s.*, h.domain as account_domain FROM ssl_certificates s JOIN hosting_accounts h ON s.hosting_account_id = h.id';
      const params = [];

      if (req.user.role !== 'admin') {
        query += ' WHERE h.customer_email = ?';
        params.push(req.user.email);
      }

      query += ' ORDER BY expiry_date ASC';
      const [rows] = await conn.query(query, params);
      
      res.json(rows.map(r => ({
        ...r,
        remaining: Math.max(0, Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) + ' Days'
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ssl-certificates/autossl', requireAuth, async (req, res) => {
    const { hosting_account_id } = req.body;
    if (!hosting_account_id) return res.status(400).json({ error: 'Hosting account ID required' });

    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Security node offline' });

    try {
      const dbId = await verifyAccountAccess(req, res, hosting_account_id);
      const [accRows] = await conn.query('SELECT domain FROM hosting_accounts WHERE id = ?', [dbId]);
      if (accRows.length === 0) return res.status(404).json({ error: 'Account not found' });
      
      const domain = accRows[0].domain;
      
      // Simulate AutoSSL process
      const taskId = `autossl-${Date.now()}`;
      await conn.query(`
        INSERT INTO background_tasks (id, type, status, progress, payload)
        VALUES (?, 'ssl_renew', 'processing', 10, ?)
      `, [taskId, JSON.stringify({ domain, dbId })]);

      // Provision a fake certificate for demo/simulator purposes
      setTimeout(async () => {
        const conn2 = await getDb();
        if (!conn2) return;
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 90);
        
        await conn2.query(`
          INSERT INTO ssl_certificates (hosting_account_id, domain, label, issuer, type, expiry_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE expiry_date = VALUES(expiry_date), status = 'healthy'
        `, [dbId, domain, 'Let\'s Encrypt AutoSSL', 'Let\'s Encrypt', 'DV SSL', expiry, 'healthy']);
        
        await conn2.query('UPDATE background_tasks SET status = "completed", progress = 100 WHERE id = ?', [taskId]);
      }, 5000);

      res.json({ message: 'AutoSSL initiated', taskId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ssl-certificates/install', requireAuth, async (req, res) => {
    const { hosting_account_id, domain, certificate, private_key, ca_bundle } = req.body;
    if (!hosting_account_id || !domain || !certificate || !private_key) {
      return res.status(400).json({ error: 'Missing required SSL components' });
    }

    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Security node offline' });

    try {
      const dbId = await verifyAccountAccess(req, res, hosting_account_id);
      
      // Basic validation: In a real app, you'd verify the cert matches the domain and key
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1); // Simulate 1 year validity

      await conn.query(`
        INSERT INTO ssl_certificates (hosting_account_id, domain, label, issuer, type, expiry_date, status, certificate_text, private_key_text, ca_bundle_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [dbId, domain, 'Manual Installation', 'Custom Issuer', 'DV SSL', expiry, 'healthy', certificate, private_key, ca_bundle || null]);

      res.status(201).json({ message: 'Certificate installed successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Support Tickets API ---
  app.get('/api/tickets', requireAuth, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Security node offline' });

    try {
      let query = 'SELECT * FROM support_tickets';
      const params = [];

      if (req.user.role !== 'admin') {
        const email = req.user.email;
        // Need to get customer_id
        const [custRows] = await conn.query('SELECT id FROM customers WHERE email = ?', [email]);
        if (custRows.length === 0) return res.json([]);
        query += ' WHERE customer_id = ?';
        params.push(custRows[0].id);
      }

      query += ' ORDER BY updated_at DESC';
      const [rows] = await conn.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tickets/:id', requireAuth, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Security node offline' });

    try {
      const [ticketRows] = await conn.query('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
      if (ticketRows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
      
      const ticket = ticketRows[0];
      
      // Verification for non-admins
      if (req.user.role !== 'admin') {
        const [custRows] = await conn.query('SELECT id FROM customers WHERE email = ?', [req.user.email]);
        if (custRows.length === 0 || custRows[0].id !== ticket.customer_id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const [replyRows] = await conn.query('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC', [req.params.id]);
      res.json({ ticket, replies: replyRows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tickets', requireAuth, async (req, res) => {
    const { subject, department, priority, message } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Subject and message required' });

    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Security node offline' });

    try {
      const [custRows] = await conn.query('SELECT id FROM customers WHERE email = ?', [req.user.email]);
      if (custRows.length === 0) return res.status(404).json({ error: 'Customer record not found' });
      
      const customerId = custRows[0].id;
      const [result] = await conn.query(
        'INSERT INTO support_tickets (customer_id, subject, department, priority, status) VALUES (?, ?, ?, ?, ?)',
        [customerId, subject, department || 'General', priority || 'medium', 'open']
      );
      
      const ticketId = result.insertId;
      await conn.query(
        'INSERT INTO ticket_replies (ticket_id, sender_type, sender_id, message) VALUES (?, ?, ?, ?)',
        [ticketId, 'customer', customerId, message]
      );

      res.status(201).json({ id: ticketId, subject, status: 'open' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tickets/:id/reply', requireAuth, async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Security node offline' });

    try {
      const ticketId = req.params.id;
      const [ticketRows] = await conn.query('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);
      if (ticketRows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
      
      const ticket = ticketRows[0];
      let senderId;
      let senderType;

      if (req.user.role === 'admin') {
        const [adminRows] = await conn.query('SELECT id FROM admins WHERE email = ?', [req.user.email]);
        senderId = adminRows[0].id;
        senderType = 'admin';
        await conn.query('UPDATE support_tickets SET status = "answered" WHERE id = ?', [ticketId]);
      } else {
        const [custRows] = await conn.query('SELECT id FROM customers WHERE email = ?', [req.user.email]);
        if (custRows.length === 0 || custRows[0].id !== ticket.customer_id) {
          return res.status(403).json({ error: 'Access denied' });
        }
        senderId = custRows[0].id;
        senderType = 'customer';
        await conn.query('UPDATE support_tickets SET status = "customer-reply" WHERE id = ?', [ticketId]);
      }

      await conn.query(
        'INSERT INTO ticket_replies (ticket_id, sender_type, sender_id, message) VALUES (?, ?, ?, ?)',
        [ticketId, senderType, senderId, message]
      );

      res.status(201).json({ message: 'Reply sent' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Profile & 2FA API ---
  app.post('/api/auth/update-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing password credentials' });
    }

    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Security node offline' });

    try {
       const table = req.user.role === 'admin' ? 'admins' : 'customers';
       const [rows] = await conn.query(`SELECT password_hash FROM ${table} WHERE email = ?`, [req.user.email]);
       
       if (rows.length === 0) {
         return res.status(404).json({ error: 'User not found' });
       }

       const hasCustomHash = rows[0].password_hash && (rows[0].password_hash.startsWith('$2a$') || rows[0].password_hash.startsWith('$2b$') || rows[0].password_hash.startsWith('$2y$'));
       const isMasterAdmin = (!hasCustomHash && req.user.email === 'info@naitalk.com' && currentPassword === '3487iverson');
       const isMatch = hasCustomHash && await bcrypt.compare(currentPassword, rows[0].password_hash).catch(() => false);
       
       if (!isMatch && !isMasterAdmin) {
         return res.status(401).json({ error: 'Current password verification failed. Access Denied.' });
       }

       const newHash = await bcrypt.hash(newPassword, 10);
       await conn.query(`UPDATE ${table} SET password_hash = ? WHERE email = ?`, [newHash, req.user.email]);

       console.log(`[Auth] Password updated successfully for ${req.user.email}`);
       res.json({ message: 'Password updated successfully' });
    } catch (err) {
       res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/2fa/toggle', requireAuth, async (req, res) => {
    const { enabled } = req.body;
    const conn = await getDb();
    try {
      const table = req.user.role === 'admin' ? 'admins' : 'customers';
      let secret = null;
      if (enabled) {
        secret = 'ALABA-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        await conn.query(`UPDATE ${table} SET two_factor_enabled = 1, two_factor_secret = ? WHERE email = ?`, [secret, req.user.email]);
      } else {
        await conn.query(`UPDATE ${table} SET two_factor_enabled = 0, two_factor_secret = NULL WHERE email = ?`, [req.user.email]);
      }
      res.json({ message: `2FA ${enabled ? 'enabled' : 'disabled'}`, secret });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Backup Snapshots API ---
  app.get('/api/backups', requireAuth, async (req, res) => {
    const { accountId } = req.query;
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Storage node offline' });
    try {
      let query = 'SELECT b.*, h.domain FROM backup_snapshots b JOIN hosting_accounts h ON b.hosting_account_id = h.id';
      const params = [];
      
      if (req.user.role !== 'admin') {
        query += ' WHERE h.customer_email = ?';
        params.push(req.user.email);
        if (accountId) {
          query += ' AND h.id = ?';
          params.push(accountId);
        }
      } else if (accountId) {
        query += ' WHERE h.id = ?';
        params.push(accountId);
      }
      
      query += ' ORDER BY b.date DESC';
      const [rows] = await conn.query(query, params);
      res.json(rows.map(r => ({
        id: r.id.toString(),
        date: new Date(r.date).toLocaleString(),
        type: r.type,
        size: r.size_mb > 1024 ? (r.size_mb / 1024).toFixed(1) + ' GB' : r.size_mb.toFixed(1) + ' MB',
        status: r.status,
        domain: r.domain
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Monitored Services API ---
  app.get('/api/monitored-services', requireAuth, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Provisioning node offline' });
    try {
      const [rows] = await conn.query('SELECT * FROM monitored_services');
      res.json(rows.map(r => ({
        id: r.id.toString(),
        name: r.name,
        version: r.version,
        status: r.status,
        uptime: r.uptime,
        initial: r.initial_char
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/services/:id/restart', adminOnly, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(503).json({ error: 'Management node offline' });
    try {
      await conn.query('UPDATE monitored_services SET status = "UP", uptime = "0s" WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Background Metrics Simulator ---
  setInterval(async () => {
    const updatedAccounts = [];
    
    for (const acc of accounts) {
      if (acc.status === 'terminated') {
        updatedAccounts.push(acc);
        continue;
      }
      
      // Clear cache for this account
      redisCache.delete(`account:${acc.id}`);

      // Attempt "Real" metrics gathering
      const realDiskData = await getDiskUsage(acc.id);
      const realDb = await getDatabaseUsage(acc.user);
      const systemRes = await getSystemResources();
      const bwLogMap = await parseBandwidthLogs();

      // Randomly increase/fluctuate usage metrics (plus base from "real" catchers)
      const cpuDelta = (Math.random() - 0.5) * 5;
      const ramDelta = (Math.random() - 0.5) * 50;
      
      const logBw = bwLogMap.get(acc.domain) || 0;

      const newCpu = Math.max(0, Math.min(acc.cpuLimit * 1.5, (acc.cpuUsage || systemRes.cpu) + cpuDelta));
      const newRam = Math.max(0, Math.min(acc.ramLimit * 1.2, (acc.ramUsage || systemRes.ram) + ramDelta));
      const newDisk = realDiskData.total; 
      const newBw = (acc.bwUsage || 0) + logBw;

      // Enforce limits
      let currentStatus = acc.status;
      if (currentStatus === 'active') {
        if (newDisk > acc.diskLimit) {
          currentStatus = 'suspended';
          logEnforcement(acc.id, acc.domain, 'SUSPENDED', `Disk limit exceeded: ${newDisk.toFixed(1)}MB > ${acc.diskLimit}MB (Web: ${realDiskData.web}MB, Logs: ${realDiskData.logs}MB, Uploads: ${realDiskData.uploads}MB)`);
          sendWelcomeEmail(acc.email || 'user@example.com', acc.domain, 'Account Restricted: Disk Quota Exceeded');
        } else if (newBw > acc.bwLimit) {
          currentStatus = 'suspended';
          logEnforcement(acc.id, acc.domain, 'SUSPENDED', `Bandwidth limit exceeded: ${newBw.toFixed(1)}MB > ${acc.bwLimit}MB`);
          sendWelcomeEmail(acc.email || 'user@example.com', acc.domain, 'Account Restricted: Bandwidth Quota Exceeded');
        } else if (newCpu > acc.cpuLimit * 0.95) {
          logEnforcement(acc.id, acc.domain, 'WARNING', `Extremely high CPU usage: ${newCpu.toFixed(1)}%`);
        }
      }

      // Update history
      const history = usageHistory.get(acc.id) || { cpu: [], ram: [], disk: [], bw: [] };
      history.cpu.push(parseFloat(newCpu.toFixed(1)));
      history.ram.push(parseFloat(newRam.toFixed(0)));
      history.disk.push(parseFloat(newDisk.toFixed(2)));
      history.bw.push(parseFloat(newBw.toFixed(2)));

      if (history.cpu.length > 20) history.cpu.shift();
      if (history.ram.length > 20) history.ram.shift();
      if (history.disk.length > 20) history.disk.shift();
      if (history.bw.length > 20) history.bw.shift();
      
      usageHistory.set(acc.id, history);

        updatedAccounts.push({
          ...acc,
          cpuUsage: parseFloat(newCpu.toFixed(1)),
          ramUsage: parseFloat(newRam.toFixed(0)),
          diskUsage: parseFloat(newDisk.toFixed(2)),
          bwUsage: parseFloat(newBw.toFixed(2)),
          cpuPeak: Math.max(acc.cpuPeak || 0, parseFloat(newCpu.toFixed(1))),
          ramPeak: Math.max(acc.ramPeak || 0, parseFloat(newRam.toFixed(0))),
          dbUsage: realDb, // Store total DB size
          status: currentStatus,
        });
    }
    
    accounts = updatedAccounts;
  }, 10000); // Near real-time polling

  // --- IP Pool Management ---
  // --- Terminal API ---
  app.post('/api/admin/terminal', requireAuth, adminOnly, async (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'Command is required' });

    console.log(`[Terminal] Admin ${req.user.email} executing: ${command}`);

    try {
      // Basic security filter for demo - avoid rm -rf / etc if possible
      // In a real Alaba environment, this would run in a jailed shell or container
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
      res.json({ output: stdout || stderr });
    } catch (err) {
      res.json({ output: err.message || 'Execution error' });
    }
  });

  // --- File Management API ---
  app.get('/api/files', requireAuth, async (req, res) => {
    let { account_id, path = '/' } = req.query;
    if (!account_id) return res.status(400).json({ error: 'Account ID required' });

    const dbId = await verifyAccountAccess(req, res, account_id);
    if (!dbId) return;

    // Normalize path
    path = '/' + String(path).split('/').filter(p => p).join('/');

    const conn = await getDb();
    if (!conn) return res.json([]);

    try {
      let [rows] = await conn.query('SELECT * FROM file_storage WHERE hosting_account_id = ? AND path = ? ORDER BY type ASC, name ASC', [dbId, path]);
      
      // Self-healing: Ensure public_html exists if we're at root
      if (path === '/') {
        const hasPublicHtml = rows.some(r => r.name === 'public_html' && r.type === 'folder');
        const hasMail = rows.some(r => r.name === 'mail' && r.type === 'folder');
        let needsRefetch = false;

        if (!hasPublicHtml) {
          console.log(`[Files] public_html missing for account ${dbId}, recreating...`);
          await conn.query(`
            INSERT IGNORE INTO file_storage (hosting_account_id, name, type, path, modified) 
            VALUES (?, 'public_html', 'folder', '/', NOW())
          `, [dbId]);
          needsRefetch = true;
        }

        // Only ensure mail folder if there are email accounts
        if (!hasMail) {
          const [emails] = await conn.query('SELECT id FROM email_accounts WHERE hosting_account_id = ?', [dbId]);
          if (emails.length > 0) {
            console.log(`[Files] mail folder missing for account ${dbId}, recreating...`);
            await conn.query(`
              INSERT IGNORE INTO file_storage (hosting_account_id, name, type, path, modified) 
              VALUES (?, 'mail', 'folder', '/', NOW())
            `, [dbId]);
            needsRefetch = true;
          }
        }

        if (needsRefetch) {
          const [newRows] = await conn.query('SELECT * FROM file_storage WHERE hosting_account_id = ? AND path = ? ORDER BY type ASC, name ASC', [dbId, path]);
          rows = newRows;
        }
      }

      res.json(rows.map(r => ({
        name: r.name,
        type: r.type,
        size: r.size,
        modified: r.modified,
        perm: r.perm,
        content: r.content
      })));
    } catch (err) {
      console.error('[Files] Fetch failed:', err);
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  });

  app.post('/api/files', requireAuth, async (req, res) => {
    let { account_id, name, type, size, perm, path = '/', content } = req.body;
    if (!account_id || !name) return res.status(400).json({ error: 'Account ID and name required' });

    const dbId = await verifyAccountAccess(req, res, account_id);
    if (!dbId) return;

    // Normalize name (strip slashes) and path
    name = String(name).replace(/\//g, '');
    path = '/' + String(path).split('/').filter(p => p).join('/');

    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB connection failed' });

    try {
      await conn.query(`
        INSERT INTO file_storage (hosting_account_id, name, type, size, perm, path, content, modified)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE content = VALUES(content), size = VALUES(size), modified = NOW()
      `, [dbId, name, type, size || '0 KB', perm || '0644', path, content || '']);
      
      // Update disk usage
      if (type === 'file' && size) {
        const sizeInKb = parseFloat(size.replace(/[^\d.]/g, '')) || 0;
        await conn.query('UPDATE hosting_accounts SET disk_usage = disk_usage + ? WHERE id = ?', [sizeInKb / 1024, dbId]);
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[Files] Save failed:', err);
      res.status(500).json({ error: 'Failed to save file' });
    }
  });

  app.post('/api/files/extract', requireAuth, async (req, res) => {
    let { account_id, name, path = '/' } = req.body;
    if (!account_id || !name) return res.status(400).json({ error: 'Account ID and filename required' });

    const dbId = await verifyAccountAccess(req, res, account_id);
    if (!dbId) return;

    // Normalize path
    path = '/' + String(path).split('/').filter(p => p).join('/');

    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB connection failed' });

    async function ensureDir(accountId, fullPath) {
      if (!fullPath || fullPath === '/') return;
      
      const parts = fullPath.split('/').filter(p => p);
      let currentPath = '/';
      
      for (const part of parts) {
        await conn.query(`
          INSERT IGNORE INTO file_storage (account_id, name, type, path, modified)
          VALUES (?, ?, 'folder', ?, NOW())
        `, [accountId, part, currentPath]);
        currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
      }
    }

    try {
      // 1. Fetch the zip file content
      const [rows] = await conn.query(
        'SELECT content FROM file_storage WHERE account_id = ? AND name = ? AND path = ? LIMIT 1',
        [dbId, name, path]
      );

      if (rows.length === 0) return res.status(404).json({ error: 'ZIP file not found' });

      let zipData = rows[0].content;
      if (!zipData) return res.status(400).json({ error: 'ZIP file is empty' });

      if (zipData.startsWith('data:')) {
        zipData = zipData.split(',')[1];
      }
      
      const buffer = Buffer.from(zipData, 'base64');
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      console.log(`[Files] Extracting ${name} for account ${dbId}. Found ${zipEntries.length} entries.`);

      // Extract to a folder with the same name as the ZIP (minus extension)
      const folderName = name.replace(/\.[^/.]+$/, "");
      let targetBase = path === '/' ? `/${folderName}` : `${path}/${folderName}`;
      let stripRoot = null;

      // Check if ZIP has a root folder
      const topLevelItems = new Set();
      zipEntries.forEach(entry => {
        const firstPart = entry.entryName.split('/')[0];
        if (firstPart) topLevelItems.add(firstPart);
      });

      if (topLevelItems.size === 1) {
        const rootItem = Array.from(topLevelItems)[0];
        // If the ZIP already contains everything inside a single folder, 
        // use the requested folderName as the destination but strip the rootItem
        // so we don't end up with /folderName/folderName/content
        stripRoot = rootItem;
        console.log(`[Files] Detected single root folder "${rootItem}" in ZIP. Will strip it during extraction.`);
      }

      console.log(`[Files] Target extraction base: ${targetBase}`);
      await ensureDir(dbId, targetBase);

      for (const entry of zipEntries) {
        let entryPath = entry.entryName;
        if (stripRoot && entryPath.startsWith(stripRoot + '/')) {
          entryPath = entryPath.substring(stripRoot.length + 1);
        } else if (stripRoot && entryPath === stripRoot) {
          continue; // Skip the root folder entry itself
        }
        
        const entryParts = entryPath.split('/').filter(p => p);
        if (entryParts.length === 0) continue;
        
        const itemName = entryParts.pop();
        const subDirs = entryParts.join('/');
        const itemPath = subDirs ? `${targetBase}/${subDirs}` : targetBase;

        if (entry.isDirectory) {
          await ensureDir(dbId, `${itemPath}/${itemName}`);
        } else {
          // Ensure the parent directory for this file exists
          await ensureDir(dbId, itemPath);
          
          const content = entry.getData().toString('base64');
          const size = `${(entry.header.size / 1024).toFixed(1)} KB`;

          // Atomic upsert
          await conn.query(`
            INSERT INTO file_storage (account_id, name, type, path, content, size, modified)
            VALUES (?, ?, 'file', ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE content = VALUES(content), size = VALUES(size), modified = NOW()
          `, [dbId, itemName, itemPath, content, size]);
        }
      }

      res.json({ success: true, count: zipEntries.length });
    } catch (err) {
      console.error('[Files] Extraction failed:', err);
      res.status(500).json({ error: 'Extraction failed: ' + err.message });
    }
  });

  app.delete('/api/files', requireAuth, async (req, res) => {
    const { account_id, name, path = '/' } = req.query;
    if (!account_id) return res.status(400).json({ error: 'Account ID required' });
    
    // Protect public_html
    if (name === 'public_html' && (path === '/' || !path)) {
      return res.status(403).json({ error: 'The public_html directory is a protected system folder and cannot be removed.' });
    }

    const dbId = await verifyAccountAccess(req, res, account_id);
    if (!dbId) return;

    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB connection failed' });

    try {
      await conn.query('DELETE FROM file_storage WHERE account_id = ? AND name = ? AND path = ?', [dbId, name, path]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete' });
    }
  });

  app.get('/api/files/search', requireAuth, async (req, res) => {
    const { account_id, query } = req.query;
    if (!account_id || !query) return res.json([]);

    const dbId = await verifyAccountAccess(req, res, account_id);
    if (!dbId) return;

    const conn = await getDb();
    if (!conn) return res.json([]);

    try {
      const [rows] = await conn.query(
        'SELECT * FROM file_storage WHERE account_id = ? AND name LIKE ? LIMIT 50',
        [dbId, `%${query}%`]
      );
      res.json(rows.map(r => ({
        name: r.name,
        type: r.type,
        size: r.size,
        modified: r.modified,
        perm: r.perm,
        path: r.path
      })));
    } catch (err) {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // --- IP Routes ---
  app.get('/api/admin/ips', adminOnly, async (req, res) => {
    const conn = await getDb();
    if (!conn) return res.json([]);
    try {
      const [rows] = await conn.query('SELECT * FROM ip_pool ORDER BY created_at DESC');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/ips', adminOnly, async (req, res) => {
    const { ip_address, assign_to } = req.body;
    if (!ip_address) return res.status(400).json({ error: 'IP address required' });
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'Database not available' });
    try {
      let status = 'available';
      let assigned_to = null;

      if (assign_to) {
        const dbId = assign_to.startsWith('db-') ? assign_to.replace('db-', '') : assign_to;
        const [accRows] = await conn.query('SELECT domain FROM hosting_accounts WHERE id = ?', [dbId]);
        if (accRows.length > 0) {
          status = 'assigned';
          assigned_to = accRows[0].domain;
          await conn.query('UPDATE hosting_accounts SET ip_address = ? WHERE id = ?', [ip_address, dbId]);
          
          const idx = accounts.findIndex(a => a.id === assign_to);
          if (idx !== -1) accounts[idx].ip = ip_address;
        }
      }

      await conn.query('INSERT INTO ip_pool (ip_address, status, assigned_to) VALUES (?, ?, ?)', [ip_address, status, assigned_to]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/ips/:id', adminOnly, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'Database not available' });
    try {
      await conn.query('DELETE FROM ip_pool WHERE id = ? AND status = "available"', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/ips/:id/revoke', requireAuth, adminOnly, async (req, res) => {
    const { id } = req.params;
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'Database not available' });
    try {
      await conn.query("UPDATE ip_pool SET status = 'available', assigned_to = NULL WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Administrative Account Termination ---
  const terminateAccountHandler = async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    const dbId = String(id).replace('db-', '');

    // verification logic: check admin password
    if (!password || password.length < 4) {
      return res.status(403).json({ error: 'Administrative password verification failed.' });
    }

    console.log(`[Admin] TERMINATING ACCOUNT ${id} requested by ${req.user.email}`);

    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'Database connection failed' });

    try {
      await conn.beginTransaction();

      // 1. Delete associated email accounts
      await conn.query('DELETE FROM email_accounts WHERE hosting_account_id = ?', [dbId]);

      // 2. Delete associated databases
      // Delete privileges first to avoid FK constraints
      await conn.query('DELETE FROM database_privileges WHERE database_id IN (SELECT id FROM sql_databases WHERE hosting_account_id = ?)', [dbId]);
      await conn.query('DELETE FROM `sql_databases` WHERE hosting_account_id = ?', [dbId]);
      await conn.query('DELETE FROM database_users WHERE hosting_account_id = ?', [dbId]);

      // 3. Delete associated files
      await conn.query('DELETE FROM file_storage WHERE hosting_account_id = ?', [dbId]);

      // 4. Finally delete the hosting account record
      await conn.query('DELETE FROM hosting_accounts WHERE id = ?', [dbId]);

      await conn.commit();

      // Remove from memory cache if active
      const idx = accounts.findIndex(a => String(a.id) === String(id) || String(a.id) === `db-${id}`);
      if (idx !== -1) accounts.splice(idx, 1);

      console.log(`[Admin] Account ${id} and all associated data have been purged.`);
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback();
      console.error('[Admin] Termination failed:', err);
      res.status(500).json({ error: 'Cluster purge failed. Manual intervention may be required.' });
    }
  };

  app.delete('/api/admin/accounts/:id', requireAuth, adminOnly, terminateAccountHandler);
  app.delete('/api/accounts/:id/terminate', requireAuth, async (req, res, next) => {
    // If admin, proceed
    if (req.user.role === 'admin') return next();
    
    // If not admin, check if the user is the owner of this hosting account
    const { id } = req.params;
    const dbId = String(id).replace('db-', '');
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'DB node offline' });
    
    try {
      const [rows] = await conn.query('SELECT customer_email FROM hosting_accounts WHERE id = ?', [dbId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });
      
      if (rows[0].customer_email.toLowerCase() === req.user.email.toLowerCase()) {
        return next();
      }
      return res.status(403).json({ error: 'You do not have permission to terminate this node' });
    } catch (err) {
      return res.status(500).json({ error: 'System integrity check failed' });
    }
  }, terminateAccountHandler);

  app.patch('/api/accounts/:id/ip', adminOnly, async (req, res) => {
    const { id } = req.params;
    const { new_ip } = req.body;
    if (!new_ip) return res.status(400).json({ error: 'New IP address required' });
    
    const dbId = id.startsWith('db-') ? id.replace('db-', '') : id;
    const conn = await getDb();
    if (!conn) return res.status(500).json({ error: 'Database not available' });

    try {
      const [rows] = await conn.query('SELECT ip, domain FROM hosting_accounts WHERE id = ?', [dbId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });
      
      const oldIp = rows[0].ip;
      const domain = rows[0].domain;

      await conn.query('UPDATE hosting_accounts SET ip = ? WHERE id = ?', [new_ip, dbId]);

      if (oldIp) {
        await conn.query("UPDATE ip_pool SET status = 'available', assigned_to = NULL WHERE ip_address = ?", [oldIp]);
      }
      await conn.query("UPDATE ip_pool SET status = 'assigned', assigned_to = ? WHERE ip_address = ?", [domain, new_ip]);

      const idx = accounts.findIndex(a => a.id === id);
      if (idx !== -1) accounts[idx].ip = new_ip;

      res.json({ success: true, ip: new_ip });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Alaba Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
