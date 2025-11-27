const express = require('express');
const db = require('./db');

const router = express.Router();

// Middleware for JSON parsing
router.use(express.json({ limit: '50mb' }));

// POST /api/admin/bulk-upload - bulk upload materials
router.post('/bulk-upload', (req, res) => {
    try {
        const { materials } = req.body;

        if (!Array.isArray(materials)) {
            return res.status(400).json({ error: 'materials must be an array' });
        }

        const insertStmt = db.prepare('INSERT INTO materials (content, court_decision, source_file) VALUES (?, ?, ?)');
        const checkStmt = db.prepare('SELECT id FROM materials WHERE content = ? AND court_decision = ? LIMIT 1');

        let inserted = 0;
        let duplicates = 0;

        db.transaction(() => {
            for (const item of materials) {
                const existing = checkStmt.get(item.content, item.court_decision);
                if (!existing) {
                    insertStmt.run(item.content, item.court_decision, item.source_file || null);
                    inserted++;
                } else {
                    duplicates++;
                }
            }
        })();

        res.json({ inserted, duplicates, total: materials.length });
    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({ error: 'Bulk upload failed' });
    }
});

// GET /api/admin/analytics/stats - общая статистика
router.get('/analytics/stats', (req, res) => {
    try {
        const totalMaterials = db.prepare('SELECT COUNT(*) as count FROM materials').get();
        const totalSources = db.prepare('SELECT COUNT(DISTINCT source_file) as count FROM materials WHERE source_file IS NOT NULL').get();
        const processedFiles = db.prepare('SELECT COUNT(*) as count FROM processed_files').get();

        // Последнее обновление
        const lastUpdate = db.prepare(`
            SELECT processed_at, records_count 
            FROM processed_files 
            ORDER BY processed_at DESC 
            LIMIT 1
        `).get();

        // Статистика поисков
        const searchesTotal = db.prepare('SELECT COUNT(*) as count FROM search_logs').get();
        const searchesToday = db.prepare(`
            SELECT COUNT(*) as count 
            FROM search_logs 
            WHERE DATE(timestamp) = DATE('now')
        `).get();

        res.json({
            totalMaterials: totalMaterials.count,
            totalSources: totalSources.count,
            processedFiles: processedFiles.count,
            lastUpdate: lastUpdate ? {
                date: lastUpdate.processed_at,
                recordsAdded: lastUpdate.records_count
            } : null,
            searches: {
                total: searchesTotal.count,
                today: searchesToday.count
            }
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /api/admin/analytics/sources - статистика по файлам-источникам
router.get('/analytics/sources', (req, res) => {
    try {
        const sources = db.prepare(`
            SELECT 
                filename,
                file_hash,
                processed_at,
                records_count
            FROM processed_files
            ORDER BY processed_at DESC
        `).all();

        // Также получить текущее количество записей из каждого источника
        const sourcesWithCurrent = sources.map(source => {
            const current = db.prepare(`
                SELECT COUNT(*) as count 
                FROM materials 
                WHERE source_file = ?
            `).get(source.filename);

            return {
                ...source,
                currentCount: current.count
            };
        });

        res.json({ sources: sourcesWithCurrent });
    } catch (err) {
        console.error('Sources error:', err);
        res.status(500).json({ error: 'Failed to fetch sources' });
    }
});

// GET /api/admin/analytics/recent - последние добавления
router.get('/analytics/recent', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const recent = db.prepare(`
            SELECT 
                id,
                content,
                court_decision,
                source_file
            FROM materials
            WHERE source_file IS NOT NULL
            ORDER BY id DESC
            LIMIT ?
        `).all(limit);

        res.json({ recent });
    } catch (err) {
        console.error('Recent error:', err);
        res.status(500).json({ error: 'Failed to fetch recent materials' });
    }
});

// GET /api/admin/analytics/timeline - статистика по датам решений
router.get('/analytics/timeline', (req, res) => {
    try {
        // Извлечь год из court_decision (формат: "... от DD.MM.YYYY")
        const timeline = db.prepare(`
            SELECT 
                substr(court_decision, -4) as year,
                COUNT(*) as count
            FROM materials
            WHERE court_decision LIKE '% от %'
                AND year GLOB '[12][0-9][0-9][0-9]'
            GROUP BY year
            ORDER BY year DESC
        `).all();

        res.json({ timeline });
    } catch (err) {
        console.error('Timeline error:', err);
        res.status(500).json({ error: 'Failed to fetch timeline' });
    }
});

// GET /api/admin/analytics/visitors - статистика посещений
router.get('/analytics/visitors', (req, res) => {
    try {
        // Unique visitors (24h)
        const uniqueToday = db.prepare(`
            SELECT COUNT(DISTINCT ip_hash) as count 
            FROM visitor_logs 
            WHERE timestamp > datetime('now', '-24 hours')
        `).get();

        // Unique visitors (7d)
        const uniqueWeek = db.prepare(`
            SELECT COUNT(DISTINCT ip_hash) as count 
            FROM visitor_logs 
            WHERE timestamp > datetime('now', '-7 days')
        `).get();

        // Device distribution (simplified based on User-Agent)
        const devices = db.prepare(`
            SELECT 
                CASE 
                    WHEN user_agent LIKE '%Mobile%' OR user_agent LIKE '%Android%' OR user_agent LIKE '%iPhone%' THEN 'Mobile'
                    ELSE 'Desktop'
                END as device_type,
                COUNT(*) as count
            FROM visitor_logs
            WHERE timestamp > datetime('now', '-30 days')
            GROUP BY device_type
        `).all();

        // Top referrers
        const referrers = db.prepare(`
            SELECT 
                CASE 
                    WHEN referer IS NULL OR referer = '' THEN 'Direct'
                    ELSE substr(referer, 0, 40)
                END as source,
                COUNT(*) as count
            FROM visitor_logs
            WHERE timestamp > datetime('now', '-30 days')
            GROUP BY source
            ORDER BY count DESC
            LIMIT 10
        `).all();

        res.json({
            uniqueVisitors: {
                today: uniqueToday.count,
                week: uniqueWeek.count
            },
            devices,
            referrers
        });
    } catch (err) {
        console.error('Visitor stats error:', err);
        res.status(500).json({ error: 'Failed to fetch visitor stats' });
    }
});

// ========================================
// Update Management Endpoints
// ========================================

// POST /api/admin/update/trigger - Trigger manual update
router.post('/update/trigger', async (req, res) => {
    try {
        // Check if update is already running
        const running = db.prepare(`
            SELECT id FROM update_status 
            WHERE status = 'running' 
            ORDER BY started_at DESC LIMIT 1
        `).get();

        if (running) {
            return res.status(409).json({
                error: 'Update already in progress',
                status: 'running'
            });
        }

        // Start update in background
        const { updateData } = require('./updater');

        // Don't await - run in background
        updateData().catch(err => {
            console.error('Background update error:', err);
        });

        res.json({
            success: true,
            message: 'Update started',
            status: 'running'
        });
    } catch (error) {
        console.error('Trigger update error:', error);
        res.status(500).json({ error: 'Failed to trigger update' });
    }
});

// GET /api/admin/update/status - Get current update status
router.get('/update/status', (req, res) => {
    try {
        const current = db.prepare(`
            SELECT * FROM update_status 
            ORDER BY started_at DESC LIMIT 1
        `).get();

        if (!current) {
            return res.json({
                status: 'idle',
                lastUpdate: null
            });
        }

        res.json(current);
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// GET /api/admin/update/history - Get update history
router.get('/update/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const history = db.prepare(`
            SELECT * FROM update_status 
            ORDER BY started_at DESC 
            LIMIT ?
        `).all(limit);

        res.json({ history });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
});

module.exports = router;
