// server/index.js
const app = require('./app');

const PORT = process.env.PORT || 3001;

// Start the server only if this file is run directly (not imported by a test)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
        // Add other startup logs here if you have them
    });
}