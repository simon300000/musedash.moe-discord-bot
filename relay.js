require('dotenv').config()

const { CQWebSocket, CQText } = require('cq-websocket')

const Discord = require('discord.js')

const wsConfig = {
  host: '127.0.0.1',
  port: 6700
}

const discordQQMap = new Map()
const qqDiscordMap = new Map()

/**
 *
 *
 */

/**
 *
 *
 */

discordQQMap.forEach((channel, id) => qqDiscordMap.set(channel, id))

const client = new Discord.Client()
client.on('ready', () => console.log(`Logged in as ${client.user.tag}`))

const bot = new CQWebSocket(wsConfig)
bot.on('socket.connecting', (_socketType, attempts) => console.log('CONNECTING', attempts))
bot.on('socket.connect', (_socketType, _sock, attempts) => console.log('CONNECT', attempts))
bot.on('socket.failed', (_socketType, attempts) => console.error('FAILED', attempts))
bot.on('socket.error', e => console.error('ERROR', e))

/**
 *
 *
 */

client.on('message', async message => {
  const { channel } = message
  if (discordQQMap.has(channel.id)) {
    const qq = discordQQMap.get(channel.id)
    const { member, attachments, content } = message

    const attachment = [...attachments.values()].map(({ url }) => url)
    const msg = [`${member.displayName}: ${content}`, ...attachment].join('\n')
    bot('send_group_msg', { group_id: qq, message: [new CQText(msg)] })
  }
})

/**
 *
 *
 */

client.login(process.env.RELAY_TOKEN)
bot.connect()
