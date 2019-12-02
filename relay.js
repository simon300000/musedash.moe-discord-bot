require('dotenv').config()

const { CQWebSocket, CQText, CQImage } = require('cq-websocket')

const Discord = require('discord.js')

const got = require('got')

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

/* #2 */
discordQQMap.set('650819506523865098', 795649800)

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
  const { author } = message
  if (author.id !== client.user.id) {
    const { channel } = message
    if (discordQQMap.has(channel.id)) {
      const qq = discordQQMap.get(channel.id)
      const { member, attachments, content } = message

      const attachment = [...attachments.values()].map(({ url }) => url)
      const msg = [`[${member.displayName}]: ${content}`, ...attachment].join('\n')
      bot('send_group_msg', { group_id: qq, message: [new CQText(msg)] })
    }
  }
})

/**
 *
 *
 */

bot.on('message.group', (_, ctx, tags) => {
  if (qqDiscordMap.has(ctx.group_id)) {
    const discord = qqDiscordMap.get(ctx.group_id)
    if (client.channels.has(discord)) {
      const channel = client.channels.get(discord)

      const { sender } = ctx

      const images = tags
        .filter(tag => tag instanceof CQImage)
        .map(({ file, url }) => new Discord.Attachment(got.stream(url), file))
      const text = ctx.raw_message
        .split('')
        .reduce(([last, ...rest], char) => {
          const [cq] = last
          const current = [cq, char]
          if (char === '[') {
            current[0] = true
          } else if (char === ']') {
            current[0] = false
          }
          return [current, last, ...rest]
        }, [
          [false, '']
        ])
        .filter(([cq]) => !cq)
        .map(([_cq, char]) => char)
        .filter(char => !['[', ']'].includes(char))
        .reverse()
        .join('')

      channel.send(`\`${sender.nickname}\` ${text}`, { files: images })
    }
  }
})

/**
 *
 *
 */

client.login(process.env.RELAY_TOKEN)
bot.connect()
