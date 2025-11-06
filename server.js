const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// parse urlencoded bodies (for forms)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ensure database pragmas are applied (require will run initialization in database.js)
const db = require('./database');

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const playerRoutes = require('./routes/players');
const gameRoutes = require('./routes/games');
const loanRoutes = require('./routes/loans');
const uploadRoutes = require('./routes/upload');

// Use routes
app.use('/api/players', playerRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/upload', uploadRoutes);

// Serve dashboard.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        message: "Teen Patti Tracker API is running"
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: "Route not found: " + req.path });
});

// Generic error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
    console.log("📍 Frontend: http://localhost:" + PORT);
    console.log("📍 API: http://localhost:" + PORT + "/api");
    console.log("📊 Health: http://localhost:" + PORT + "/api/health");
});