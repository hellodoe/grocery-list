const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from current directory
app.use(express.static(__dirname));

// Ensure SQLite database directory exists
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database
const db = new DatabaseSync(path.join(dbDir, 'database.db'));

// Bootstrap tables
db.exec(`
    CREATE TABLE IF NOT EXISTS groceries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        supplier TEXT,
        completed INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        image TEXT
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        name TEXT PRIMARY KEY
    )
`);

// Bootstrap purchase history table
db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        supplier TEXT,
        price REAL NOT NULL,
        purchaseDate TEXT NOT NULL,
        image TEXT
    )
`);

// Run migrations to add image column if tables already existed without it
try {
    db.exec(`ALTER TABLE groceries ADD COLUMN image TEXT`);
} catch (e) {
    // Column already exists or table does not exist
}
try {
    db.exec(`ALTER TABLE purchase_history ADD COLUMN image TEXT`);
} catch (e) {
    // Column already exists
}

// Bootstrap default product suggestions if empty
const defaultProducts = ['Avocado', 'Lapte', 'Pâine', 'Ouă', 'Mere', 'Banane', 'Brânză', 'Unt', 'Apă', 'Cafea', 'Roșii', 'Cartofi'];
const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (countRow.count === 0) {
    const insertStmt = db.prepare('INSERT OR IGNORE INTO products (name) VALUES (?)');
    defaultProducts.forEach(prod => insertStmt.run(prod));
    console.log('Bootstrapped default product suggestions to database.');
}

// --- API Endpoints ---

// Get all grocery items
app.get('/api/groceries', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM groceries ORDER BY createdAt DESC').all();
        const items = rows.map(row => ({
            ...row,
            completed: row.completed === 1
        }));
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new grocery item
app.post('/api/groceries', (req, res) => {
    try {
        const { id, name, quantity, unit, supplier, completed, createdAt, image } = req.body;
        db.prepare('INSERT INTO groceries (id, name, quantity, unit, supplier, completed, createdAt, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, name, quantity, unit, supplier, completed ? 1 : 0, createdAt, image || null);
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update grocery item
app.put('/api/groceries/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, quantity, unit, supplier, completed, image } = req.body;
        db.prepare('UPDATE groceries SET name = ?, quantity = ?, unit = ?, supplier = ?, completed = ?, image = ? WHERE id = ?')
          .run(name, quantity, unit, supplier, completed ? 1 : 0, image || null, id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a single grocery item
app.delete('/api/groceries/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM groceries WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear all grocery items
app.delete('/api/groceries', (req, res) => {
    try {
        db.prepare('DELETE FROM groceries').run();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all product suggestions
app.get('/api/products', (req, res) => {
    try {
        const rows = db.prepare('SELECT name FROM products ORDER BY name ASC').all();
        res.json(rows.map(row => row.name));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new product suggestion
app.post('/api/products', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        db.prepare('INSERT OR IGNORE INTO products (name) VALUES (?)').run(name.trim());
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Purchase History Endpoints ---

// Add a list of completed purchases to history and delete them from active list
app.post('/api/history', (req, res) => {
    try {
        const items = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Body must be an array' });
        }

        db.exec('BEGIN TRANSACTION');
        const insertStmt = db.prepare(`
            INSERT INTO purchase_history (name, quantity, unit, supplier, price, purchaseDate, image)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const deleteStmt = db.prepare('DELETE FROM groceries WHERE id = ?');

        for (const item of items) {
            insertStmt.run(
                item.name,
                item.quantity,
                item.unit,
                item.supplier || null,
                parseFloat(item.price) || 0,
                item.purchaseDate || new Date().toISOString(),
                item.image || null
            );
            if (item.activeId) {
                deleteStmt.run(item.activeId);
            }
        }

        db.exec('COMMIT');
        res.status(201).json({ success: true });
    } catch (err) {
        try { db.exec('ROLLBACK'); } catch (_) {}
        res.status(500).json({ error: err.message });
    }
});

// Get full purchase history
app.get('/api/history', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM purchase_history ORDER BY purchaseDate DESC').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get monthly expenses and supplier breakdown
app.get('/api/statistics', (req, res) => {
    try {
        const monthly = db.prepare(`
            SELECT substr(purchaseDate, 1, 7) as month, SUM(price) as total
            FROM purchase_history
            GROUP BY month
            ORDER BY month ASC
        `).all();

        const supplier = db.prepare(`
            SELECT COALESCE(supplier, 'Fără magazin') as supplier, SUM(price) as total
            FROM purchase_history
            GROUP BY supplier
            ORDER BY total DESC
        `).all();

        const totalSpentRow = db.prepare('SELECT SUM(price) as total FROM purchase_history').get();

        res.json({
            monthly,
            supplier,
            totalSpent: totalSpentRow.total || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all route to serve the frontend SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
