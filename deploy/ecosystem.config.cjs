module.exports = {
  apps: [{
    name: 'sismar-app',
    cwd: __dirname + '/..',            // raíz del repo SISMAR
    script: 'node_modules/next/dist/bin/next',
    // -H 127.0.0.1: la app escucha SOLO en loopback (Guardian). Caddy es el
    // único expuesto a internet; el acceso directo a :3002 queda rechazado.
    args: 'start -H 127.0.0.1 -p 3002',
    env: { NODE_ENV: 'production', PORT: '3002', HOSTNAME: '127.0.0.1' },
    max_restarts: 10,
    restart_delay: 3000,
  }],
}
