require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from current directory
app.use(express.static(__dirname));

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project-id')) {
    console.warn('⚠️ WARNING: Supabase URL or Key is not configured correctly in .env. Please configure them to connect to your database.');
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

// --- API Endpoints ---

// Get all grocery items
app.get('/api/groceries', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('groceries')
            .select('*')
            .order('createdAt', { ascending: false }); // Match frontend schema property createdAt
            
        if (error) {
            // Fallback for column names matching created_at vs createdAt
            if (error.message && error.message.includes('createdAt')) {
                const retry = await supabase
                    .from('groceries')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (retry.error) throw retry.error;
                return res.json(retry.data.map(row => ({ ...row, completed: !!row.completed })));
            }
            throw error;
        }
        res.json(data.map(row => ({ ...row, completed: !!row.completed })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new grocery item
app.post('/api/groceries', async (req, res) => {
    try {
        const { id, name, quantity, unit, supplier, completed, createdAt, image } = req.body;
        // Upsert/Insert supporting both snake_case created_at and camelCase createdAt
        const { error } = await supabase
            .from('groceries')
            .insert([{
                id,
                name,
                quantity,
                unit,
                supplier,
                completed: !!completed,
                created_at: createdAt,
                image
            }]);
            
        if (error) throw error;
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update grocery item
app.put('/api/groceries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, quantity, unit, supplier, completed, image } = req.body;
        const { error } = await supabase
            .from('groceries')
            .update({
                name,
                quantity,
                unit,
                supplier,
                completed: !!completed,
                image
            })
            .eq('id', id);
            
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a single grocery item
app.delete('/api/groceries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('groceries')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear all grocery items
app.delete('/api/groceries', async (req, res) => {
    try {
        const { error } = await supabase
            .from('groceries')
            .delete()
            .neq('id', ''); // Delete all rows
            
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all product suggestions
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('name')
            .order('name', { ascending: true });
            
        if (error) throw error;
        res.json(data.map(row => row.name));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new product suggestion
app.post('/api/products', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        const { error } = await supabase
            .from('products')
            .upsert([{ name: name.trim() }], { onConflict: 'name' });
            
        if (error) throw error;
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a list of completed purchases to history and delete them from active list
app.post('/api/history', async (req, res) => {
    try {
        const items = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Body must be an array' });
        }

        const historyRows = items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            supplier: item.supplier || null,
            price: parseFloat(item.price) || 0,
            purchase_date: item.purchaseDate || new Date().toISOString(),
            image: item.image || null
        }));

        const { error: insertError } = await supabase
            .from('purchase_history')
            .insert(historyRows);

        if (insertError) throw insertError;

        // Delete active grocery items
        const activeIds = items.map(item => item.activeId).filter(Boolean);
        if (activeIds.length > 0) {
            const { error: deleteError } = await supabase
                .from('groceries')
                .delete()
                .in('id', activeIds);
                
            if (deleteError) throw deleteError;
        }

        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get full purchase history
app.get('/api/history', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('purchase_history')
            .select('*')
            .order('purchase_date', { ascending: false });
            
        if (error) throw error;
        
        const mapped = data.map(row => ({
            ...row,
            purchaseDate: row.purchase_date // map to camelCase for frontend
        }));
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get monthly expenses and supplier breakdown
app.get('/api/statistics', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('purchase_history')
            .select('*');
            
        if (error) throw error;
        
        const monthlyMap = {};
        let totalSpent = 0;
        const supplierMap = {};
        
        data.forEach(row => {
            const price = parseFloat(row.price) || 0;
            totalSpent += price;
            
            const dateStr = row.purchase_date || new Date().toISOString();
            const month = dateStr.substring(0, 7); // YYYY-MM
            
            monthlyMap[month] = (monthlyMap[month] || 0) + price;
            
            const supplier = row.supplier || 'Fără magazin';
            supplierMap[supplier] = (supplierMap[supplier] || 0) + price;
        });
        
        const monthly = Object.keys(monthlyMap).sort().map(month => ({
            month,
            total: monthlyMap[month]
        }));
        
        const supplier = Object.keys(supplierMap).map(name => ({
            supplier: name,
            total: supplierMap[name]
        })).sort((a, b) => b.total - a.total);
        
        res.json({
            monthly,
            supplier,
            totalSpent
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
