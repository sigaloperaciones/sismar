module.exports = {
  apps: [{
    name: 'sismar-app',
    cwd: __dirname + '/..',            // raíz del repo SISMAR
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3002',
    env: { NODE_ENV: 'production', PORT: '3002' },
    max_restarts: 10,
    restart_delay: 3000,
  }],
}
