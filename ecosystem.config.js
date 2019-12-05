module.exports = {
  apps: [{
    name: 'musedash.moe discord bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false
  }, {
    name: 'MuseDash QQ-Discord relay',
    script: 'relay.js',
    instances: 1,
    autorestart: true,
    watch: false
  }, {
    name: 'MuseDash discord fun bot',
    script: 'fun.js',
    instances: 1,
    autorestart: true,
    watch: false
  }]
}
