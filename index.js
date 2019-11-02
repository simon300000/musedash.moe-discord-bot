require('dotenv').config()
const Discord = require('discord.js')
const client = new Discord.Client()
const got = require('got')

const search = async query => (await got(`https://api.musedash.moe/search/${query}`, { json: true })).body
const player = async id => (await got(`https://api.musedash.moe/player/${id}`, { json: true })).body

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
})

client.on('message', async ({ content, channel }) => {
  const send = (...args) => channel.send(...args)
  if (content.startsWith('!moe')) {
    const [menu, ...items] = content.replace('!moe', '').split(' ').filter(Boolean)
    if (!menu || menu === 'help') {
      send('Type `!moe search name` to search for player')
    }
    if (menu === 'search') {
      const query = items.join(' ')
      if (!query) {
        send('Type `!moe search name` to search for player')
      } else {
        const body = await search(query)
        const length = body.length
        const result = [`Search result of **${query}** (${body.length})`, ...Array(5)
          .fill()
          .map((_, i) => body[i])
          .filter(Boolean)
          .map(([name, id]) => `**${name}**, \`!moe player ${id}\``)
        ]
        if (length > 5) {
          result.push(`> ${length - 5} more player are hidden`)
        } else if (!length) {
          result.push('> Caaaaan\'t find anyone')
        }
        send(result.join('\n'))
      }
    }
    if (menu === 'info') {
      if (!items.length) {
        send('Type `!moe info name` to lookup player\'s info')
      } else {
        const bodies = await Promise.all([...new Set(items)].map(id => player(id).catch(() => undefined)))
        const players = bodies.filter(Boolean)
        const result = players.map(({ plays, user: { nickname, user_id: id } }) => {
          const avg = Math.round(plays.map(({ acc }) => acc).reduce((a, b) => a + b) / plays.length * 100) / 100
          const perfects = plays.filter(({ acc }) => acc === 100).length
          return `**${nickname}** *(${id})*
Records: **${plays.length}**
Perfects: **${perfects}**
Average Accuracy: **${avg}%**
https://musedash.moe/player/${id}`
        })
        send(result.join('\n'))
      }
    }
  }
})

client.login(process.env.TOKEN)
