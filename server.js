const express = require('express');
const path = require('path');
const fileUpload = require('express-fileupload');
const appRoutes = require('./src/app');

const app = express();
const port = 3000;

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing uploads and JSON
app.use(fileUpload());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes for merging logic
app.use('/api', appRoutes);

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at: http://localhost:${port}`);
});
