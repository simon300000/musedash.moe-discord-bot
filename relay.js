require('dotenv').config()

const { CQWebSocket, CQText, CQImage, CQAt } = require('cq-websocket')

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

const numEmoji = ['♾', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

const atTable = {}

const atFinder = (currentID, targetID) => {
  if (!atTable[currentID]) {
    atTable[currentID] = {}
  }
  if (!atTable[targetID]) {
    atTable[targetID] = {}
  }
  const tagetAts = Object.entries(atTable[targetID])
  return [(name, id) => { atTable[currentID][name] = id }, (text, replacer, textReplacer = text => text) => text
    .split('@')
    .flatMap((txt, index) => {
      if (index) {
        const atTarget = tagetAts.find(([name]) => txt.startsWith(name))
        if (atTarget) {
          const [name, id] = atTarget
          return [replacer(id), textReplacer(txt.replace(name, ''))]
        } else {
          return textReplacer(`@${txt}`)
        }
      } else {
        return textReplacer(txt)
      }
    })
  ]
}

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
      const [saveAt, findAt] = atFinder(channel.id, qq)
      const { member, attachments, content } = message

      const attachment = [...attachments.values()].map(({ url }) => url)
      const msg = [`[${member.displayName}]: ${content}`, ...attachment].join('\n')
      saveAt(member.displayName, member.id)

      let ats = 0
      await bot('send_group_msg', {
        group_id: qq,
        message: findAt(msg, id => {
          ats++
          return new CQAt(id)
        }, text => new CQText(text))
      })

      message.react('✔')
      if (ats) {
        message.react(numEmoji[ats] || numEmoji[0])
      }
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
      const [save, findAt] = atFinder(ctx.group_id, discord)
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

      save(sender.nickname, sender.user_id)

      channel.send(findAt(`\`${sender.nickname}\` ${text}`, id => `<@${id}>`).join(''), { files: images })
    }
  }
})

/**
 *
 *
 */

client.login(process.env.RELAY_TOKEN)
bot.connect()
