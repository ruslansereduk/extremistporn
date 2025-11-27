const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path from environment or default
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'extremist_materials.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Create main table
db.exec(`
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    court_decision TEXT,
    source_file TEXT
  );
`);

// Create FTS table
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS materials_fts USING fts5(content, court_decision, content='materials', content_rowid='id', tokenize='unicode61');
`);

// Triggers to keep FTS updated
db.exec(`
  CREATE TRIGGER IF NOT EXISTS materials_ai AFTER INSERT ON materials BEGIN
    INSERT INTO materials_fts(rowid, content, court_decision) VALUES(new.id, new.content, new.court_decision);
END;
  CREATE TRIGGER IF NOT EXISTS materials_ad AFTER DELETE ON materials BEGIN
    INSERT INTO materials_fts(materials_fts, rowid, content, court_decision) VALUES('delete', old.id, old.content, old.court_decision);
END;
  CREATE TRIGGER IF NOT EXISTS materials_au AFTER UPDATE ON materials BEGIN
    INSERT INTO materials_fts(materials_fts, rowid, content, court_decision) VALUES('delete', old.id, old.content, old.court_decision);
    INSERT INTO materials_fts(rowid, content, court_decision) VALUES(new.id, new.content, new.court_decision);
END;
`);

// Create analytics tables
db.exec(`
  CREATE TABLE IF NOT EXISTS search_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    results_count INTEGER DEFAULT 0
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS updates_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    items_added INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS visitor_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash TEXT NOT NULL,
    user_agent TEXT,
    referer TEXT,
    path TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create extremist organizations table
db.exec(`
  CREATE TABLE IF NOT EXISTS extremist_organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    decision TEXT,
    date_added DATE DEFAULT CURRENT_DATE,
    source_file TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create extremist individuals table
db.exec(`
  CREATE TABLE IF NOT EXISTS extremist_individuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    decision TEXT,
    category TEXT CHECK(category IN ('citizen', 'foreign')),
    date_added DATE DEFAULT CURRENT_DATE,
    source_file TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create update status tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS update_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    source_name TEXT,
    status TEXT NOT NULL CHECK(status IN ('running', 'success', 'error', 'cancelled')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    items_added INTEGER DEFAULT 0,
    items_total INTEGER DEFAULT 0,
    error_message TEXT
  );
`);

// Create processed files tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS processed_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    records_count INTEGER DEFAULT 0
  );
`);

module.exports = db;
