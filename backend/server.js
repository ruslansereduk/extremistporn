const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Set correct MIME types for module scripts
app.use((req, res, next) => {
    if (req.url.endsWith('.js')) {
        res.type('application/javascript');
    }
    next();
});

// Serve static files from React build
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// Admin API routes
const adminRoutes = require('./admin-routes');
app.use('/api/admin', adminRoutes);

// API routes...

app.get('/api/search', (req, res) => {
    const query = req.query.q;
    if (!query || query.trim().length === 0) {
        return res.json({ results: [] });
    }

    try {
        // Use FTS5 MATCH query
        // We search in both content and court_decision
        // Simple query: match the exact phrase or words
        // We can use the simple query syntax for FTS5

        const stmt = db.prepare(`
      SELECT rowid as id, content, court_decision, snippet(materials_fts, 0, '<b>', '</b>', '...', 64) as snippet
      FROM materials_fts 
      WHERE materials_fts MATCH ? 
      ORDER BY rank 
      LIMIT 50
    `);

        // Prepare query string for FTS
        // Escape double quotes
        const sanitizedQuery = query.replace(/"/g, '""');
        // Wrap in quotes for phrase search or just pass as is?
        // Let's try simple match first. If user types "book", it matches.
        // If user types "book author", it matches documents containing both.
        // FTS5 syntax: "book author" means both.
        // We might want to append '*' to the last word for prefix matching.

        const ftsQuery = `"${sanitizedQuery}"*`; // Phrase search with prefix matching

        const results = stmt.all(ftsQuery);

        // Log the search query for analytics
        try {
            db.prepare('INSERT INTO search_logs (query, results_count) VALUES (?, ?)').run(query, results.length);
        } catch (logErr) {
            console.error('Failed to log search:', logErr);
        }

        res.json({ results });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Analytics endpoints
app.get('/api/analytics/top-searches', (req, res) => {
    try {
        const results = db.prepare(`
            SELECT query, COUNT(*) as count, MAX(timestamp) as last_searched
            FROM search_logs
            GROUP BY LOWER(query)
            ORDER BY count DESC
            LIMIT 10
        `).all();
        res.json({ topSearches: results });
    } catch (err) {
        console.error('Top searches error:', err);
        res.status(500).json({ error: 'Failed to fetch top searches' });
    }
});

app.get('/api/analytics/timeline', (req, res) => {
    try {
        // Get materials grouped by court decision date
        // We'll extract the year from court_decision field
        const results = db.prepare(`
            SELECT 
                substr(court_decision, -4) as year,
                COUNT(*) as count
            FROM materials
            WHERE year GLOB '[0-9][0-9][0-9][0-9]'
            GROUP BY year
            ORDER BY year
        `).all();
        res.json({ timeline: results });
    } catch (err) {
        console.error('Timeline error:', err);
        res.status(500).json({ error: 'Failed to fetch timeline' });
    }
});

app.get('/api/analytics/last-update', (req, res) => {
    try {
        const lastUpdate = db.prepare(`
            SELECT timestamp, items_added, total_items
            FROM updates_log
            ORDER BY timestamp DESC
            LIMIT 1
        `).get();
        res.json({ lastUpdate: lastUpdate || null });
    } catch (err) {
        console.error('Last update error:', err);
        res.status(500).json({ error: 'Failed to fetch last update' });
    }
});

// Get stats
app.get('/api/stats', (req, res) => {
    try {
        const row = db.prepare('SELECT COUNT(*) as count FROM materials').get();
        res.json({ total: row.count });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get material by ID
app.get('/api/materials/:id', (req, res) => {
    const id = req.params.id;
    try {
        const stmt = db.prepare('SELECT * FROM materials WHERE id = ?');
        const material = stmt.get(id);

        if (!material) {
            return res.status(404).json({ error: 'Material not found' });
        }

        res.json(material);
    } catch (err) {
        console.error('Get material error:', err);
        res.status(500).json({ error: 'Failed to fetch material' });
    }
});

// Handle SPA routing - return index.html for any unknown routes
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

const { startScheduler } = require('./scheduler');

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startScheduler();
});
