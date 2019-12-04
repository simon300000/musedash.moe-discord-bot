require('dotenv').config()
const Discord = require('discord.js')
const client = new Discord.Client()
const got = require('got')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const search = async query => (await got(new URL(`https://api.musedash.moe/search/${query}`), { json: true })).body
const player = async id => (await got(new URL(`https://api.musedash.moe/player/${id}`), { json: true })).body
const music = async id => Object.values((await got('https://api.musedash.moe/albums', { json: true })).body)
  .flatMap(({ music: w }) => Object.values(w))
  .find(({ uid }) => uid === id)

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
})

const boxLength = 40

const makeDiffResult = async ({ nickname, bestPlay, perfects, plays, avg, id }) => {
  const lines = []

  {
    const nicknameLength = nickname.length
    const spaceLength = boxLength - 4 - nicknameLength
    lines[0] = `-${' '.repeat(Math.max(0, Math.floor(spaceLength / 2)))}[${nickname}]${' '.repeat(Math.max(0, Math.ceil(spaceLength / 2)))}-`
  }

  {
    const idLength = id.length
    const lineLength = boxLength - 2 - idLength
    lines[1] = `${'+'.repeat(Math.max(0, Math.floor(lineLength / 2)))}[${id}]${'+'.repeat(Math.max(0, Math.ceil(lineLength / 2)))}`
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
    const { score, acc, i: index, difficulty: difficultyNum, platform } = bestPlay
    const levelDesigner = levelDesigners[difficultyNum] || levelDesigners[0]

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

client.on('message', async ({ content, channel }) => {
  const send = async (...args) => {
    const message = await channel.send(...args)
    await wait(1000 * 90)
    message.delete()
  }
  if (content.startsWith('!moe')) {
    const [menu, ...items] = content.replace('!moe', '').split(' ').filter(Boolean)
    if (!menu || menu === 'help') {
      send(`Type \`!moe search name\` to search for player
Type \`!moe player id/name\` to lookup player's info`)
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
    if (menu === 'player') {
      if (!items.length) {
        send('Type `!moe player id/name` to lookup player\'s info')
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
        const result = players.map(({ plays, user: { nickname, user_id: id } }) => {
          const avg = Math.round(plays.map(({ acc }) => acc).reduce((a, b) => a + b) / plays.length * 100) / 100
          const perfects = plays.filter(({ acc }) => acc === 100).length
          const bestPlay = plays
            .sort(({ score: a }, { score: b }) => b - a)
            .sort(({ i: a }, { i: b }) => a - b)[0]
          return { nickname, bestPlay, perfects, plays, avg, id }
        })
        send((await Promise.all(result.map(makeDiffResult))).join('\n'))
      }
    }
  }
})

client.login(process.env.TOKEN)
