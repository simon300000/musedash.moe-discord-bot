module.exports = {
  apps: [{
    name: 'musedash.moe discord bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false
  }]
}
