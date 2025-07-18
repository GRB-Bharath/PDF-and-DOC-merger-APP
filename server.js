const express = require('express');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const appRoutes = require('./src/app');

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const app = express();
const port = 3000;

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing uploads and JSON
app.use(fileUpload({
  debug: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes for merging logic
app.use('/api', appRoutes);

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at: http://localhost:${port}`);
});
