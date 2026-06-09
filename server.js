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
        createdAt TEXT NOT NULL
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        name TEXT PRIMARY KEY
    )
`);

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
        const { id, name, quantity, unit, supplier, completed, createdAt } = req.body;
        db.prepare('INSERT INTO groceries (id, name, quantity, unit, supplier, completed, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, name, quantity, unit, supplier, completed ? 1 : 0, createdAt);
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update grocery item
app.put('/api/groceries/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, quantity, unit, supplier, completed } = req.body;
        db.prepare('UPDATE groceries SET name = ?, quantity = ?, unit = ?, supplier = ?, completed = ? WHERE id = ?')
          .run(name, quantity, unit, supplier, completed ? 1 : 0, id);
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

// Catch-all route to serve the frontend SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
