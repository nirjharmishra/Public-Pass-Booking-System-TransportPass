const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const dbPath = path.join(__dirname, 'transport.db');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Admin middleware
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Helper: Get user by ID
function getUserById(userId, callback) {
    db.get('SELECT id, name, email, phone, wallet_balance, role FROM users WHERE id = ?', [userId], callback);
}

// AUTH ROUTES
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        console.log('Registering new user:', email);
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint')) {
                        console.log('Email already registered:', email);
                        return res.status(400).json({ error: 'Email already registered' });
                    }
                    console.error('Registration database error:', err);
                    return res.status(500).json({ error: 'Registration failed' });
                }

                console.log('User registered successfully with ID:', this.lastID);
                const token = jwt.sign({ id: this.lastID, email, role: 'user' }, JWT_SECRET);
                getUserById(this.lastID, (err, user) => {
                    if (err) {
                        console.error('Error fetching user after registration:', err);
                        return res.status(500).json({ error: 'Error fetching user' });
                    }
                    if (!user) {
                        console.error('User not found after registration, ID:', this.lastID);
                        return res.status(500).json({ error: 'User not found after registration' });
                    }
                    console.log('Registration complete for user:', user.email);
                    res.json({ token, user });
                });
            }
        );
    } catch (error) {
        console.error('Registration server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    console.log('Login attempt for email:', email);

    if (!email || !password) {
        console.log('Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            console.log('User not found for email:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        try {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                console.log('Invalid password for email:', email);
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
            const { password: _, ...userWithoutPassword } = user;
            console.log('Login successful for user:', user.email);
            res.json({ token, user: userWithoutPassword });
        } catch (error) {
            console.error('Error during password comparison:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });
});

// USER ROUTES
app.get('/api/users/wallet', authenticateToken, (req, res) => {
    db.get('SELECT wallet_balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ balance: row ? row.wallet_balance : 0 });
    });
});

// PASS ROUTES
app.get('/api/passes', (req, res) => {
    db.all('SELECT * FROM passes ORDER BY category, provider, type', (err, rows) => {
        if (err) {
            console.error('Error fetching passes:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!rows || rows.length === 0) {
            console.log('No passes found in database');
            return res.json([]);
        }
        console.log(`Fetched ${rows.length} passes from database`);
        res.json(rows);
    });
});

app.get('/api/passes/:id', (req, res) => {
    db.get('SELECT * FROM passes WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Pass not found' });
        }
        res.json(row);
    });
});

// BOOKING ROUTES
app.post('/api/bookings', authenticateToken, (req, res) => {
    const { pass_id } = req.body;
    const userId = req.user.id;

    if (!pass_id) {
        return res.status(400).json({ error: 'Pass ID is required' });
    }

    // Get pass details
    db.get('SELECT * FROM passes WHERE id = ?', [pass_id], (err, pass) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!pass) {
            return res.status(404).json({ error: 'Pass not found' });
        }

        // Check if user already has an active booking for this pass
        db.get(
            `SELECT * FROM bookings 
             WHERE user_id = ? AND pass_id = ? AND status = 'active' AND expiry_date > datetime('now')`,
            [userId, pass_id],
            (err, existingBooking) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (existingBooking) {
                    return res.status(400).json({ 
                        error: 'You already have an active pass for this transport. Please wait for it to expire or renew it.' 
                    });
                }

                // Check wallet balance
                db.get('SELECT wallet_balance FROM users WHERE id = ?', [userId], async (err, user) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    if (user.wallet_balance < pass.price) {
                        return res.status(400).json({ error: 'Insufficient wallet balance' });
                    }

                    // Calculate expiry date
                    const purchaseDate = new Date();
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + pass.validity_days);

                    // Create booking and update wallet in transaction
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');

                        // Deduct from wallet
                        db.run(
                            'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?',
                            [pass.price, userId],
                            (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Payment processing failed' });
                                }

                                // Create booking
                                db.run(
                                    'INSERT INTO bookings (user_id, pass_id, purchase_date, expiry_date) VALUES (?, ?, ?, ?)',
                                    [userId, pass_id, purchaseDate.toISOString(), expiryDate.toISOString()],
                                    function(err) {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ error: 'Booking creation failed' });
                                        }

                                        // Create transaction record
                                        db.run(
                                            'INSERT INTO transactions (user_id, transaction_type, amount, description, status) VALUES (?, ?, ?, ?, ?)',
                                            [userId, 'purchase', pass.price, `Purchase: ${pass.provider} - ${pass.type} Pass`, 'completed'],
                                            (err) => {
                                                if (err) {
                                                    db.run('ROLLBACK');
                                                    return res.status(500).json({ error: 'Transaction record failed' });
                                                }

                                                db.run('COMMIT', (err) => {
                                                    if (err) {
                                                        return res.status(500).json({ error: 'Transaction commit failed' });
                                                    }
                                                    res.json({ 
                                                        message: 'Booking created successfully',
                                                        bookingId: this.lastID 
                                                    });
                                                });
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    });
                });
            });
        });
    });

app.get('/api/bookings/active', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all(
        `SELECT b.*, p.provider, p.category, p.type, p.coverage, p.price 
         FROM bookings b 
         JOIN passes p ON b.pass_id = p.id 
         WHERE b.user_id = ? AND b.status = 'active' AND b.expiry_date > datetime('now')
         ORDER BY b.expiry_date`,
        [userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

app.get('/api/bookings/expired', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all(
        `SELECT b.*, p.provider, p.category, p.type, p.coverage, p.price 
         FROM bookings b 
         JOIN passes p ON b.pass_id = p.id 
         WHERE b.user_id = ? AND (b.status = 'expired' OR b.expiry_date <= datetime('now'))
         ORDER BY b.expiry_date DESC`,
        [userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

app.post('/api/bookings/:id/renew', authenticateToken, (req, res) => {
    const bookingId = req.params.id;
    const userId = req.user.id;

    // Get booking with pass details
    db.get(
        `SELECT b.*, p.* FROM bookings b 
         JOIN passes p ON b.pass_id = p.id 
         WHERE b.id = ? AND b.user_id = ?`,
        [bookingId, userId],
        (err, booking) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            // Check wallet balance
            db.get('SELECT wallet_balance FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                if (user.wallet_balance < booking.price) {
                    return res.status(400).json({ error: 'Insufficient wallet balance' });
                }

                // Calculate new expiry date
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + booking.validity_days);

                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    // Deduct from wallet
                    db.run(
                        'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?',
                        [booking.price, userId],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Payment processing failed' });
                            }

                            // Update booking
                            db.run(
                                'UPDATE bookings SET expiry_date = ?, status = ? WHERE id = ?',
                                [expiryDate.toISOString(), 'active', bookingId],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Renewal failed' });
                                    }

                                    // Create transaction record
                                    db.run(
                                        'INSERT INTO transactions (user_id, transaction_type, amount, description, status) VALUES (?, ?, ?, ?, ?)',
                                        [userId, 'renewal', booking.price, `Renewal: ${booking.provider} - ${booking.type} Pass`, 'completed'],
                                        (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return res.status(500).json({ error: 'Transaction record failed' });
                                            }

                                            db.run('COMMIT', (err) => {
                                                if (err) {
                                                    return res.status(500).json({ error: 'Transaction commit failed' });
                                                }
                                                res.json({ message: 'Pass renewed successfully' });
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                });
            });
        }
    );
});

app.get('/api/bookings/:id/receipt', authenticateToken, (req, res) => {
    const bookingId = req.params.id;
    const userId = req.user.id;

    db.get(
        `SELECT b.*, p.provider, p.type, p.price 
         FROM bookings b 
         JOIN passes p ON b.pass_id = p.id 
         WHERE b.id = ? AND b.user_id = ?`,
        [bookingId, userId],
        (err, booking) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }
            res.json(booking);
        }
    );
});

// TRANSACTION ROUTES
app.post('/api/transactions/topup', authenticateToken, (req, res) => {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount < 100) {
        return res.status(400).json({ error: 'Minimum top-up amount is ₹100' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Add to wallet
        db.run(
            'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
            [amount, userId],
            (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Top-up failed' });
                }

                // Create transaction record
                db.run(
                    'INSERT INTO transactions (user_id, transaction_type, amount, description, status) VALUES (?, ?, ?, ?, ?)',
                    [userId, 'topup', amount, `Wallet Top-Up: ₹${amount}`, 'completed'],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Transaction record failed' });
                        }

                        db.run('COMMIT', (err) => {
                            if (err) {
                                return res.status(500).json({ error: 'Transaction commit failed' });
                            }
                            res.json({ message: 'Top-up successful', transactionId: this.lastID });
                        });
                    }
                );
            }
        );
    });
});

app.get('/api/transactions', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC',
        [userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

app.get('/api/transactions/:id/receipt', authenticateToken, (req, res) => {
    const transactionId = req.params.id;
    const userId = req.user.id;

    db.get(
        'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
        [transactionId, userId],
        (err, transaction) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!transaction) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            res.json(transaction);
        }
    );
});

// ADMIN ROUTES
app.get('/api/admin/passes', authenticateToken, requireAdmin, (req, res) => {
    db.all('SELECT * FROM passes ORDER BY id', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/admin/passes', authenticateToken, requireAdmin, (req, res) => {
    const { provider, category, type, price, validity_days, coverage, logo_url } = req.body;

    if (!provider || !category || !type || !price || !validity_days) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.run(
        'INSERT INTO passes (provider, category, type, price, validity_days, coverage, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [provider, category, type, price, validity_days, coverage || null, logo_url || null],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create pass' });
            }
            res.json({ message: 'Pass created successfully', id: this.lastID });
        }
    );
});

app.put('/api/admin/passes/:id', authenticateToken, requireAdmin, (req, res) => {
    const { provider, category, type, price, validity_days, coverage, logo_url } = req.body;
    const passId = req.params.id;

    db.run(
        'UPDATE passes SET provider = ?, category = ?, type = ?, price = ?, validity_days = ?, coverage = ?, logo_url = ? WHERE id = ?',
        [provider, category, type, price, validity_days, coverage || null, logo_url || null, passId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update pass' });
            }
            res.json({ message: 'Pass updated successfully' });
        }
    );
});

app.delete('/api/admin/passes/:id', authenticateToken, requireAdmin, (req, res) => {
    const passId = req.params.id;

    db.run('DELETE FROM passes WHERE id = ?', [passId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete pass' });
        }
        res.json({ message: 'Pass deleted successfully' });
    });
});

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    db.all('SELECT id, name, email, phone, wallet_balance, role, created_at FROM users ORDER BY id', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = req.params.id;

    // Prevent deleting admin users
    db.get('SELECT role FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.role === 'admin') {
            return res.status(400).json({ error: 'Cannot delete admin users' });
        }

        // Delete user and related data
        db.serialize(() => {
            db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
            db.run('DELETE FROM bookings WHERE user_id = ?', [userId]);
            db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to delete user' });
                }
                res.json({ message: 'User deleted successfully' });
            });
        });
    });
});

app.get('/api/admin/bookings', authenticateToken, requireAdmin, (req, res) => {
    db.all(
        `SELECT b.*, p.provider, p.category, p.type, p.coverage, p.price,
                u.name as user_name, u.email as user_email
         FROM bookings b 
         JOIN passes p ON b.pass_id = p.id 
         JOIN users u ON b.user_id = u.id
         ORDER BY b.purchase_date DESC`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

app.delete('/api/admin/bookings/:id', authenticateToken, requireAdmin, (req, res) => {
    const bookingId = req.params.id;

    db.run('DELETE FROM bookings WHERE id = ?', [bookingId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete booking' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        res.json({ message: 'Booking deleted successfully' });
    });
});

app.get('/api/admin/transactions', authenticateToken, requireAdmin, (req, res) => {
    db.all(
        `SELECT t.*, u.name as user_name, u.email as user_email 
         FROM transactions t 
         JOIN users u ON t.user_id = u.id 
         ORDER BY t.transaction_date DESC`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

app.get('/api/admin/statistics', authenticateToken, requireAdmin, (req, res) => {
    db.serialize(() => {
        let stats = {};

        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            stats.totalUsers = row.count;

            db.get('SELECT COUNT(*) as count FROM passes', (err, row) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                stats.totalPasses = row.count;

                db.get('SELECT COUNT(*) as count FROM bookings', (err, row) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    stats.totalBookings = row.count;

                    db.get('SELECT SUM(amount) as total FROM transactions WHERE transaction_type IN ("purchase", "renewal") AND status = "completed"', (err, row) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        stats.totalRevenue = row.total || 0;
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Make sure to run "npm run init-db" to initialize the database');
});

