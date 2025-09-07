@echo off
echo Demarrage du serveur HTTPS pour TerranoKidsFind...
echo.

REM Verifier si Node.js est installe
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js n'est pas installe ou pas dans le PATH
    echo Tentative avec Python...
    goto :python_server
)

REM Demarrer le serveur Node.js HTTPS
echo Demarrage du serveur Node.js HTTPS...
node server.js
if %errorlevel% neq 0 (
    echo Echec du serveur Node.js, tentative avec Python...
    goto :python_server
)
goto :end

:python_server
REM Verifier si Python est installe
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo Python n'est pas installe non plus
    echo Ouverture directe du fichier HTML...
    goto :direct_open
)

REM Demarrer serveur Python simple
echo Demarrage du serveur Python HTTP...
echo ATTENTION: Certaines fonctionnalites seront limitees en HTTP
echo Ouvrez votre navigateur sur: http://localhost:8080
python -m http.server 8080
goto :end

:direct_open
echo Ouverture directe du fichier HTML dans le navigateur...
echo ATTENTION: Fonctionnalites limitees (geolocalisation, etc.)
start index.html
goto :end

:end
pause
