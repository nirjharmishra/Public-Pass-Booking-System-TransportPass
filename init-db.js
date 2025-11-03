const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'transport.db');
const db = new sqlite3.Database(dbPath);

// Helper function to close database
function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
    });
}

// Create tables and initialize data
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        wallet_balance REAL DEFAULT 0,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Passes table
    db.run(`CREATE TABLE IF NOT EXISTS passes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        price REAL NOT NULL,
        validity_days INTEGER NOT NULL,
        coverage TEXT,
        logo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Bookings table
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        pass_id INTEGER NOT NULL,
        purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiry_date DATETIME NOT NULL,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (pass_id) REFERENCES passes(id)
    )`);

    // Transactions table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'completed',
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`, () => {
        console.log('Database tables created successfully!');
        
        // Insert default admin user (password: admin123)
        bcrypt.hash('admin123', 10, (err, hash) => {
            if (err) {
                console.error('Error hashing admin password:', err);
                closeDatabase();
                return;
            }
            db.run(`INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
                ['Admin User', 'admin@transportpass.com', hash, 'admin'],
                function(err) {
                    if (err) {
                        console.error('Error creating admin user:', err);
                    } else {
                        if (this.changes > 0) {
                            console.log('Admin user created: admin@transportpass.com / admin123');
                        } else {
                            console.log('Admin user already exists');
                        }
                    }
                    
                    // Insert sample passes after admin user is created
                    insertSamplePasses();
                });
        });
    });
});

// Insert sample passes
function insertSamplePasses() {
    // Use data URIs for simple colored circles instead of external placeholder service
    // This avoids network errors and works offline
    const getLogoUrl = (provider, color) => {
        const firstLetter = provider.charAt(0).toUpperCase();
        // Create SVG string
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="${color}"/><text x="40" y="50" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${firstLetter}</text></svg>`;
        // Convert to base64 using Node.js Buffer (btoa is browser-only)
        const base64 = Buffer.from(svg).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
    };
    
    const samplePasses = [
        ['RedBus', 'bus', 'daily', 99, 1, 'All routes, Unlimited rides', getLogoUrl('RedBus', '#e74c3c')],
        ['RedBus', 'bus', 'weekly', 299, 7, 'All routes, Unlimited rides', getLogoUrl('RedBus', '#e74c3c')],
        ['RedBus', 'bus', 'monthly', 999, 30, 'All routes, Unlimited rides', getLogoUrl('RedBus', '#e74c3c')],
        ['RedBus', 'bus', 'student', 599, 90, 'All routes, Student discount', getLogoUrl('RedBus', '#e74c3c')],
        ['State Transport', 'bus', 'daily', 79, 1, 'State-wide routes', getLogoUrl('State Transport', '#3498db')],
        ['State Transport', 'bus', 'weekly', 249, 7, 'State-wide routes', getLogoUrl('State Transport', '#3498db')],
        ['State Transport', 'bus', 'monthly', 799, 30, 'State-wide routes', getLogoUrl('State Transport', '#3498db')],
        ['State Transport', 'bus', 'corporate', 1999, 180, 'State-wide, Corporate discount', getLogoUrl('State Transport', '#3498db')],
        ['Indian Railways', 'train', 'daily', 199, 1, 'All classes, Unlimited travel', getLogoUrl('Indian Railways', '#f39c12')],
        ['Indian Railways', 'train', 'weekly', 599, 7, 'All classes, Unlimited travel', getLogoUrl('Indian Railways', '#f39c12')],
        ['Indian Railways', 'train', 'monthly', 1499, 30, 'All classes, Unlimited travel', getLogoUrl('Indian Railways', '#f39c12')],
        ['Indian Railways', 'train', 'student', 899, 90, 'All classes, Student discount', getLogoUrl('Indian Railways', '#f39c12')],
        ['Metro', 'train', 'daily', 99, 1, 'Unlimited rides', getLogoUrl('Metro', '#9b59b6')],
        ['Metro', 'train', 'weekly', 299, 7, 'Unlimited rides', getLogoUrl('Metro', '#9b59b6')],
        ['Metro', 'train', 'monthly', 899, 30, 'Unlimited rides', getLogoUrl('Metro', '#9b59b6')],
        ['Metro', 'train', 'student', 449, 90, 'Unlimited rides, Student discount', getLogoUrl('Metro', '#9b59b6')],
        ['IndiGo', 'flight', 'daily', 499, 1, 'Domestic flights only', getLogoUrl('IndiGo', '#e74c3c')],
        ['IndiGo', 'flight', 'weekly', 1499, 7, 'Domestic flights only', getLogoUrl('IndiGo', '#e74c3c')],
        ['IndiGo', 'flight', 'monthly', 3999, 30, 'Domestic flights only', getLogoUrl('IndiGo', '#e74c3c')],
        ['IndiGo', 'flight', 'student', 2499, 90, 'Domestic flights, Student discount', getLogoUrl('IndiGo', '#e74c3c')],
        ['IndiGo', 'flight', 'corporate', 9999, 180, 'All routes, Corporate discount', getLogoUrl('IndiGo', '#e74c3c')],
        ['Air India', 'flight', 'daily', 599, 1, 'All routes', getLogoUrl('Air India', '#26a69a')],
        ['Air India', 'flight', 'weekly', 1999, 7, 'All routes', getLogoUrl('Air India', '#26a69a')],
        ['Air India', 'flight', 'monthly', 5999, 30, 'All routes', getLogoUrl('Air India', '#26a69a')],
        ['Air India', 'flight', 'student', 3499, 90, 'All routes, Student discount', getLogoUrl('Air India', '#26a69a')],
        ['Air India', 'flight', 'corporate', 14999, 180, 'All routes, Corporate discount', getLogoUrl('Air India', '#26a69a')],
        ['SpiceJet', 'flight', 'daily', 399, 1, 'Domestic flights only', getLogoUrl('SpiceJet', '#ff6b35')],
        ['SpiceJet', 'flight', 'weekly', 1299, 7, 'Domestic flights only', getLogoUrl('SpiceJet', '#ff6b35')],
        ['SpiceJet', 'flight', 'monthly', 2999, 30, 'Domestic flights only', getLogoUrl('SpiceJet', '#ff6b35')],
        ['SpiceJet', 'flight', 'student', 1999, 90, 'Domestic flights, Student discount', getLogoUrl('SpiceJet', '#ff6b35')],
        ['SpiceJet', 'flight', 'corporate', 7999, 180, 'All routes, Corporate discount', getLogoUrl('SpiceJet', '#ff6b35')]
    ];

    db.run(`DELETE FROM passes`, (err) => {
        if (err) {
            console.error('Error clearing passes:', err);
            closeDatabase();
            return;
        }

        const stmt = db.prepare(`INSERT INTO passes (provider, category, type, price, validity_days, coverage, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        
        samplePasses.forEach(pass => {
            stmt.run(pass);
        });
        
        stmt.finalize((err) => {
            if (err) {
                console.error('Error inserting sample passes:', err);
            } else {
                console.log('Sample passes inserted successfully');
            }
            console.log('Database initialized successfully!');
            closeDatabase();
        });
    });
}

