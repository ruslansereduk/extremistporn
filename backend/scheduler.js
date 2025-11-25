const cron = require('node-cron');
const { updateData } = require('./updater');

function startScheduler() {
    console.log('Starting update scheduler...');

    // Schedule to run every 3 days at 3:00 AM
    // Cron syntax: minute hour day-of-month month day-of-week
    // "0 3 */3 * *" means "At 03:00 on every 3rd day-of-month" 
    // Wait, "*/3" in day-of-month field means "every 3 days starting from day 1".
    // This is close enough to "every 3 days".
    cron.schedule('0 3 */3 * *', () => {
        console.log('Running scheduled data update...');
        updateData();
    });

    console.log('Scheduler started. Next update will run according to schedule (every 3 days).');

    // Optional: Run immediately on startup if needed? 
    // The user didn't explicitly ask for immediate run, but it's often good practice.
    // Let's stick to the schedule for now, but maybe log that we are ready.
}

module.exports = { startScheduler };
