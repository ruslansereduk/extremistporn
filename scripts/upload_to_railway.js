#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Read local database
const dbPath = path.join(__dirname, '..', 'extremist_materials.db');
const db = new Database(dbPath);

// Railway API endpoint
const RAILWAY_URL = 'https://extremistporn-production.up.railway.app';

async function uploadData() {
    console.log('📊 Uploading database to Railway...\n');

    // Get ALL materials (not just those with source_file)
    const materials = db.prepare('SELECT content, court_decision, source_file FROM materials').all();

    console.log(`Found ${materials.length} materials to upload`);

    // Upload in batches
    const batchSize = 500;
    let totalUploaded = 0;

    for (let i = 0; i < materials.length; i += batchSize) {
        const batch = materials.slice(i, i + batchSize);

        console.log(`Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(materials.length / batchSize)} (${batch.length} items)...`);

        try {
            const response = await fetch(`${RAILWAY_URL}/api/admin/bulk-upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ materials: batch })
            });

            const result = await response.json();
            if (response.ok) {
                totalUploaded += result.inserted;
                console.log(`  ✓ Inserted: ${result.inserted}, Duplicates: ${result.duplicates}`);
            } else {
                console.error(`  ✗ Error: ${result.error}`);
            }
        } catch (error) {
            console.error(`  ✗ Failed: ${error.message}`);
        }
    }

    console.log(`\n✅ Upload complete: ${totalUploaded} materials uploaded`);

    // Verify
    const verifyRes = await fetch(`${RAILWAY_URL}/api/stats`);
    const stats = await verifyRes.json();
    console.log(`\n📊 Railway database now has: ${stats.total} records`);
}

uploadData().catch(console.error);
