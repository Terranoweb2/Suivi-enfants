#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Building TerranoKidsFind for Netlify...');

// Vérifier si nous sommes dans un environnement de build Netlify
const isNetlify = process.env.NETLIFY === 'true';
console.log(`Environment: ${isNetlify ? 'Netlify' : 'Local'}`);

// Créer le dossier de build s'il n'existe pas
const buildDir = path.join(__dirname, 'dist');
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

// Copier les fichiers essentiels
const filesToCopy = [
    'index.html',
    'simple-server.html',
    'package.json',
    'README.md'
];

filesToCopy.forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(buildDir, file);
    
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied ${file}`);
    } else {
        console.log(`⚠️  ${file} not found, skipping`);
    }
});

// Copier le dossier public
const publicDir = path.join(__dirname, 'public');
const destPublicDir = path.join(buildDir, 'public');

if (fs.existsSync(publicDir)) {
    if (!fs.existsSync(destPublicDir)) {
        fs.mkdirSync(destPublicDir, { recursive: true });
    }
    
    const publicFiles = fs.readdirSync(publicDir);
    publicFiles.forEach(file => {
        const src = path.join(publicDir, file);
        const dest = path.join(destPublicDir, file);
        fs.copyFileSync(src, dest);
    });
    console.log('✅ Copied public directory');
}

// Copier le dossier assets
const assetsDir = path.join(__dirname, 'assets');
const destAssetsDir = path.join(buildDir, 'assets');

if (fs.existsSync(assetsDir)) {
    if (!fs.existsSync(destAssetsDir)) {
        fs.mkdirSync(destAssetsDir, { recursive: true });
    }
    
    // Fonction récursive pour copier le dossier assets
    function copyDir(src, dest) {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        entries.forEach(entry => {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                }
                copyDir(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }
    
    copyDir(assetsDir, destAssetsDir);
    console.log('✅ Copied assets directory');
}

// Créer un fichier _redirects pour Netlify
const redirectsContent = `/*    /index.html   200
/api/*    /.netlify/functions/:splat   200`;

fs.writeFileSync(path.join(buildDir, '_redirects'), redirectsContent);
console.log('✅ Created _redirects file');

// Créer un fichier _headers pour optimiser les performances
const headersContent = `/*
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable`;

fs.writeFileSync(path.join(buildDir, '_headers'), headersContent);
console.log('✅ Created _headers file');

// Optimiser index.html pour la production
const indexPath = path.join(buildDir, 'index.html');
if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Ajouter des meta tags pour l'optimisation
    const metaTags = `
    <!-- Netlify Optimization -->
    <meta name="robots" content="index, follow">
    <meta name="googlebot" content="index, follow">
    <meta property="og:title" content="TerranoKidsFind - Sécurité Familiale">
    <meta property="og:description" content="Application de sécurité familiale complète avec géolocalisation adaptative">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://terranokidsfind.netlify.app">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="TerranoKidsFind - Sécurité Familiale">
    <meta name="twitter:description" content="Application de sécurité familiale complète">
    `;
    
    // Insérer les meta tags après le title existant
    indexContent = indexContent.replace(
        /<title>.*?<\/title>/,
        `<title>TerranoKidsFind - Sécurité Familiale</title>${metaTags}`
    );
    
    // Ajouter un service worker pour le cache
    const swScript = `
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                        console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                        console.log('SW registration failed: ', registrationError);
                    });
            });
        }
    </script>`;
    
    // Insérer le script avant la fermeture du body
    indexContent = indexContent.replace('</body>', `${swScript}\n</body>`);
    
    fs.writeFileSync(indexPath, indexContent);
    console.log('✅ Optimized index.html for production');
}

// Créer un service worker simple
const swContent = `
const CACHE_NAME = 'terrano-kids-find-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/simple-server.html',
    '/assets/favicon.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
        )
    );
});
`;

fs.writeFileSync(path.join(buildDir, 'sw.js'), swContent);
console.log('✅ Created service worker');

console.log('\n🎉 Build completed successfully!');
console.log('📁 Build output: ./dist/');
console.log('🚀 Ready for Netlify deployment!');
console.log('\nNext steps:');
console.log('1. Connect your GitHub repo to Netlify');
console.log('2. Set build command: npm run build:netlify');
console.log('3. Set publish directory: dist');
console.log('4. Deploy!');
