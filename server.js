const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Generate self-signed certificate if it doesn't exist
const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('Génération du certificat SSL auto-signé...');
    try {
        execSync(`openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=FR/ST=Paris/L=Paris/O=TerranoKidsFind/CN=localhost"`, { cwd: __dirname });
        console.log('Certificat SSL généré avec succès!');
    } catch (error) {
        console.error('Erreur lors de la génération du certificat:', error.message);
        console.log('Utilisation du serveur HTTP simple à la place...');
        
        // Fallback to HTTP server
        const http = require('http');
        const server = http.createServer(requestHandler);
        server.listen(8080, () => {
            console.log('🚀 Serveur HTTP démarré sur http://localhost:8080');
            console.log('⚠️  Certaines fonctionnalités (géolocalisation) peuvent être limitées en HTTP');
        });
        return;
    }
}

const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
};

function requestHandler(req, res) {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    const extname = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Fichier non trouvé');
            } else {
                res.writeHead(500);
                res.end('Erreur serveur: ' + error.code);
            }
        } else {
            // Add security headers
            res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; img-src 'self' data: https: blob:; media-src 'self' data: https: blob:;");
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

const server = https.createServer(options, requestHandler);

server.listen(8443, () => {
    console.log('🚀 Serveur HTTPS sécurisé démarré!');
    console.log('📱 Application accessible sur: https://localhost:8443');
    console.log('✅ Toutes les fonctionnalités sont maintenant disponibles:');
    console.log('   - Géolocalisation GPS');
    console.log('   - Cartes interactives');
    console.log('   - Notifications push');
    console.log('   - Reconnaissance vocale');
    console.log('   - Accès caméra/microphone');
    console.log('');
    console.log('⚠️  Acceptez le certificat auto-signé dans votre navigateur');
    console.log('   (Cliquez sur "Avancé" puis "Continuer vers localhost")');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('Port 8443 occupé, essai sur le port 8444...');
        server.listen(8444, () => {
            console.log('🚀 Serveur HTTPS démarré sur: https://localhost:8444');
        });
    } else {
        console.error('Erreur serveur:', err);
    }
});
