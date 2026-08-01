// ecosystem.config.js — definición reproducible del daemon de sync (PM2).
//
// Antes este proceso se levantaba a mano (`pm2 start sync.js --name scores365-sync`)
// con `watch` desactivado, así que cada cambio de código requería un
// `pm2 restart` manual. Este archivo lo deja declarativo y activa `watch`
// acotado SOLO a las carpetas de código del sync.
//
// IMPORTANTE — por qué NO se vigila `database/`:
//   El sync escribe archivos de estado en runtime dentro de `database/`
//   (`.scores365-state.json`, `.conversation-context.json`). Vigilar esa
//   carpeta provocaría un loop de reinicios infinito. Los cambios en
//   `database/connection.js` son raros; para esos usar `npm run deploy:sync`.
//
// Uso:
//   pm2 start ecosystem.config.js --only scores365-sync
//   pm2 save
//   npm run deploy:sync   # git pull + reload idempotente

module.exports = {
  apps: [
    {
      name: 'scores365-sync',
      script: 'sync.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      time: true, // prefija timestamp en los logs de pm2

      // Auto-reload al cambiar código del sync. Solo carpetas de fuente;
      // ninguna de ellas recibe escrituras en runtime (verificado: los
      // writes van a admin/, database/ o la raíz).
      watch: ['sync.js', 'src', 'services', 'utils'],
      watch_delay: 1000, // debounce para no reiniciar en ráfaga
      ignore_watch: [
        'node_modules',
        '\\.git',
        'database', // estado de sync escrito en runtime → nunca vigilar
        'dashboard',
        'admin',
        'tests',
        '.*\\.log$',
        '.*\\.tmp$',
        '.*\\.json$', // userNames.json y otros estados JSON
      ],

      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
