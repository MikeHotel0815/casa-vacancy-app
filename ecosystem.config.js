// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'casa-vacancy-app-server', // Name Ihrer Anwendung in PM2
      script: 'server/index.js',    // Pfad zur Hauptdatei Ihres Servers (aus dem Projekt-Root)
      // cwd: './server/', // Setzt das Arbeitsverzeichnis auf /server, wenn PM2 vom Root gestartet wird und script nur 'index.js' ist

      instances: 1, // Anzahl der Instanzen (für Clustering, 'max' für maximale CPU-Kerne)
      autorestart: true, // Startet die App automatisch neu, wenn sie abstürzt
      watch: false, // Deaktiviert das Beobachten von Dateiänderungen für Neustarts (in Produktion meist false)
                  // Für Entwicklung kann es nützlich sein: watch: ['./server'], ignore_watch : ["node_modules", "client"]
      max_memory_restart: '1G', // Startet neu, wenn Speicher über 1GB geht

      // Umgebungsvariablen, die für diese App spezifisch sind
      // Diese überschreiben Variablen aus .env, wenn sie hier gesetzt sind.
      // Es ist oft besser, .env für produktive Geheimnisse zu verwenden und PM2 nur Umgebungsspezifika wie NODE_ENV zu setzen.
      // PM2 lädt automatisch eine .env Datei aus dem CWD der App (oder dem CWD von PM2, wenn nicht anders angegeben).
      env: {
        NODE_ENV: 'development', // Standardumgebung
      },
      env_production: {
        NODE_ENV: 'production',
        // PORT: 5000, // Kann hier überschrieben werden, wenn nötig
        // --- WICHTIG: Fügen Sie hier Ihre produktiven Umgebungsvariablen hinzu oder stellen Sie sicher, ---
        // --- dass eine .env Datei im `server` Verzeichnis auf Ihrem Produktionsserver existiert. ---
        // Beispiele (NICHT FÜR GIT COMMIT MIT ECHTEN WERTEN):
        // DB_NAME: 'prod_db_name',
        // DB_USER: 'prod_db_user',
        // DB_PASSWORD: 'prod_db_password',
        // DB_HOST: 'prod_db_host',
        // JWT_SECRET: 'sehr_geheimes_produktions_jwt_secret',
        // VITE_API_URL: 'https://ihre-domain.com/api' // Wenn das Frontend die API unter diesem Pfad erwartet
      }
    }
    // Sie könnten hier weitere Apps hinzufügen, z.B. einen Frontend-Build-Prozess oder Worker
    /*
    {
      name: 'client-build-watch',
      script: 'npm',
      args: 'run build --prefix client', // oder 'run dev --prefix client' für Entwicklung
      watch: ['./client/src'],
      ignore_watch: ["node_modules"],
      autorestart: false, // Normalerweise nicht für Build-Prozesse
      env: {
        NODE_ENV: 'development'
      }
    }
    */
  ],

  // Optional: Deployment-Konfiguration (wenn Sie PM2 für Deployments verwenden)
  /*
  deploy : {
    production : {
       user : 'your_ssh_user', // SSH Benutzername
       host : 'your_server_ip', // IP-Adresse Ihres Servers
       ref  : 'origin/main', // Oder Ihr Produktionsbranch z.B. origin/prod
       repo : 'git@github.com:your_username/your_project.git', // URL Ihres Git-Repositories
       path : '/var/www/production/casa-vacancy-app', // Zielpfad auf dem Server
       // Befehle, die vor dem Deployment lokal ausgeführt werden (selten benötigt)
       'pre-deploy-local': '',
       // Befehle, die nach dem Deployment auf dem Server ausgeführt werden:
       // Dependencies installieren, Client bauen, PM2 neu laden
       'post-deploy' : 'cd server && npm install && cd ../client && npm install && npm run build && cd .. && pm2 reload ecosystem.config.js --env production',
       // Befehle für das erstmalige Setup (z.B. Klonen des Repos)
       'pre-setup': ''
    }
  }
  */
};
