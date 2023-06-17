import { config } from "dotenv"
import { ApplicationCommandOptionType, Client, GatewayIntentBits } from 'discord.js'

import { Level } from 'level'

config()

const db = new Level('./db')

const binding = db.sublevel('binding')

const search = query => fetch(`https://api.musedash.moe/search/${query}`).then(res => res.json())
const player = id => fetch(`https://api.musedash.moe/player/${id}`).then(res => res.json())
const music = id => fetch('https://api.musedash.moe/albums')
  .then(res => res.json())
  .then(res => Object
    .values(res)
    .flatMap(({ music: w }) => Object.values(w))
    .find(({ uid }) => uid === id))

const client = new Client({ intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds] })

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
})

const boxLength = 40

const makeDiffResult = async ({ nickname, bestPlay, perfects, plays, avg, id, rl }) => {
  const lines = []

  {
    const nicknameLength = nickname.length
    const spaceLength = boxLength - 4 - nicknameLength
    lines.push(`-${' '.repeat(Math.max(0, Math.floor(spaceLength / 2)))}[${nickname}]${' '.repeat(Math.max(0, Math.ceil(spaceLength / 2)))}-`)
  }

  if (rl !== undefined) {
    const rlRound = Math.round(rl * 1000) / 1000
    const fill = `RL: ${rlRound}`
    const spaceLength = boxLength - 2 - fill.length
    lines.push(`-${' '.repeat(Math.max(0, Math.floor(spaceLength / 2)))}${fill}${' '.repeat(Math.max(0, Math.ceil(spaceLength / 2)))}-`)
  }

  {
    const idLength = id.length
    const lineLength = boxLength - 2 - idLength
    lines.push(`${'+'.repeat(Math.max(0, Math.floor(lineLength / 2)))}[${id}]${'+'.repeat(Math.max(0, Math.ceil(lineLength / 2)))}`)
  }

  {
    const contents = []

    contents.push(['Records', plays.length])
    contents.push(['Perfects', perfects])
    contents.push(['Average Accuracy', `${avg}%`])

    const longestTitleLength = Math.max(...contents.map(([title]) => title.length))

    lines.push(...contents.map(([title, content]) => `+ ${title}: ${' '.repeat(Math.max(0, longestTitleLength - title.length + 2))}${content}`))
  }

  {
    const { levelDesigner: levelDesigners, difficulty, English: { name, author } } = await music(bestPlay.uid)
    const { score, acc, i: rawIndex, difficulty: difficultyNum, platform } = bestPlay
    const levelDesigner = levelDesigners[difficultyNum] || levelDesigners[0]
    const index = rawIndex + 1

    const contents = []

    {
      const title = `#${index} => Highest rank/score`
      const titleSpaceLength = boxLength - title.length - 2
      lines.push(`-${' '.repeat(Math.max(0, Math.ceil(titleSpaceLength / 2)))}${title}${' '.repeat(Math.max(0, Math.floor(titleSpaceLength / 2)))}-`)

      const nameAuthor = `!「${name}」by ${author}`
      const nameAuthorSpaceLength = boxLength - nameAuthor.length
      lines.push(`${nameAuthor}${' '.repeat(Math.max(0, nameAuthorSpaceLength))}`)
    }

    contents.push([`#${index} ${platform}`, `Lv.${difficulty[difficultyNum]} - ${levelDesigner}`])
    contents.push([`Score: ${score}`, `Accuracy: ${Math.round(acc * 100) / 100}%`])

    const longestLeftContentLength = Math.max(...contents.map(([left]) => left.length))

    lines.push(...contents.map(([left, right]) => `! ${left}${' '.repeat(Math.max(1, longestLeftContentLength - left.length + 4 + Math.min(0, boxLength - left.length - right.length - 10)))}${right}`))
  }

  return ['```diff', ...lines.map(line => {
    if (line.length < boxLength) {
      return `${line}${' '.repeat(boxLength - line.length - 1)}${line[0]}`
    } else {
      return line
    }
  }), '```', `https://musedash.moe/player/${id}`].join('\n')
}

const searchCommand = async query => {
  if (!query) {
    return 'Type `!moe search name` to search for player'
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
    return result.join('\n')
  }
}

const playerCommand = async (items, id) => {
  if (!items.length) {
    if (id) {
      const currentBind = await binding.get(id).catch(() => undefined)
      if (currentBind) {
        return playerCommand([currentBind])
      }
    }
    return 'Type `!moe player id/name` to lookup player\'s info'
  } else {
    if (items[0].length < 32) {
      const [result] = await search(items.join(' '))
      items.length = 0
      if (result) {
        items[0] = result[1]
      }
    }
    const bodies = await Promise.all([...new Set(items)].map(id => player(id).catch(() => undefined)))
    const players = bodies.filter(Boolean)
    const result = players.map(({ plays, user: { nickname, user_id: id }, rl }) => {
      const avg = Math.round(plays.map(({ acc }) => acc).reduce((a, b) => a + b) / plays.length * 100) / 100
      const perfects = plays.filter(({ acc }) => acc === 100).length
      const bestPlay = plays
        .sort(({ score: a }, { score: b }) => b - a)
        .sort(({ i: a }, { i: b }) => a - b)[0]
      return { nickname, bestPlay, perfects, plays, avg, id, rl }
    })
    if (!result.length) {
      return 'Can not find this user'
    } else {
      return (await Promise.all(result.map(makeDiffResult))).join('\n')
    }
  }
}

const bindCommand = async (id, discordId) => {
  if (!id) {
    const currentBind = await binding.get(discordId).catch(() => undefined)
    if (currentBind) {
      const { user: { user_id, nickname } } = await player(currentBind)
      return `Hi ${nickname} (${user_id}),
type \`!moe bind id\` to change`
    } else {
      return 'Type `!moe bind id` to bind your discord account with musedash.moe'
    }
  } else {
    const { user: { user_id, nickname } } = await player(id)
    if (user_id === '404') {
      return 'User not found'
    } else {
      await binding.put(discordId, user_id)
      return `hi, ${nickname}!, bind success!`
    }
  }
}

const helpCommand = () => `Type \`!moe search name\` to search for player
Type \`!moe player id/name\` to lookup player's info
Type \`!moe bind id\` to bind your discord account with musedash.moe, so you can use \`!moe player\` without id`

client.on('ready', async () => {
  await client.application.commands.create({
    name: 'moe',
    description: 'musedash.moe bot',
    options: [{
      name: 'search',
      description: 'search for player',
      descriptionLocalizations: {
        'zh-CN': '搜索玩家'
      },
      type: ApplicationCommandOptionType.Subcommand,
      options: [{
        name: 'name',
        description: 'player name',
        descriptionLocalizations: {
          'zh-CN': '昵称'
        },
        type: ApplicationCommandOptionType.String,
        required: true
      }]
    }, {
      name: 'player',
      description: 'lookup player\'s info',
      descriptionLocalizations: {
        'zh-CN': '查看玩家信息'
      },
      type: ApplicationCommandOptionType.Subcommand,
      options: [{
        name: 'id',
        description: 'player id/name',
        descriptionLocalizations: {
          'zh-CN': '玩家 id/昵称'
        },
        type: ApplicationCommandOptionType.String,
        required: false
      }]
    }, {
      name: 'bind',
      description: 'bind your discord account with musedash.moe',
      descriptionLocalizations: {
        'zh-CN': '绑定你的 MuseDash 账号'
      },
      type: ApplicationCommandOptionType.Subcommand,
      options: [{
        name: 'id',
        description: 'player id',
        descriptionLocalizations: {
          'zh-CN': '玩家 id'
        },
        type: ApplicationCommandOptionType.String,
      }]
    }
    ]
  })
})

client.on('messageCreate', async message => {
  const { content, author: { id } } = message
  const send = string => message.reply(string)
  if (content.startsWith('!moe')) {
    const [menu, ...items] = content.replace('!moe', '').split(' ').filter(Boolean)
    if (!menu || menu === 'help') {
      send(helpCommand())
    }
    if (menu === 'search') {
      const query = items.join(' ')
      send(await searchCommand(query))
    }
    if (menu === 'player') {
      send(await playerCommand(items, id))
    }
    if (menu === 'bind') {
      send(await bindCommand(items[0], id))
    }
  }
})

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName, options, user: { id } } = interaction
    await interaction.deferReply()
    const send = async string => interaction.editReply(string)
    if (commandName === 'moe') {
      switch (options.getSubcommand()) {
        case 'search':
          const query = options.getString('name')
          send(await searchCommand(query))
          break
        case 'player':
          const playerId = options.getString('id')
          send(await playerCommand(playerId ? [playerId] : [], id))
          break
        case 'bind':
          const bindId = options.getString('id')
          send(await bindCommand(bindId, id))
          break
      }
    }
  }
})

client.login(process.env.TOKEN)
