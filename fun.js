require('dotenv').config()
const Discord = require('discord.js')
const client = new Discord.Client()

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
})

client.on('message', async message => {
  const { content } = message
  if (content === 'SHOW ME THE EMOJIS') {
    const emojis = [...client.emojis.values()]
    let list = []
    while (!message.deleted) {
      const emoji = emojis.shift()
      const [first, ...rest] = await list
      if (rest.length >= 19) {
        await first.remove()
        list = [...rest, await message.react(emoji)]
      } else {
        list = [...list, await message.react(emoji)]
      }
      emojis.push(emoji)
    }
    console.log(233)
  }
})

client.login(process.env.TOKEN)
