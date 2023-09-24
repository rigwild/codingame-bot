// @ts-check
/// <reference types="./types.d.ts" />

import fs from 'fs'
import { ofetch } from 'ofetch'

// Hidden user ID with short format like 5102134
const USER_ID = process.env.USER_ID
// `cgSession` cookie
const SESSION_TOKEN = process.env.SESSION_TOKEN

if (!SESSION_TOKEN || !USER_ID) {
  console.error('Please set SESSION_TOKEN and USER_ID environment variables')
  process.exit(1)
}

const seenPublicHandles = new Set(
  fs.existsSync('public-handles.txt') ? fs.readFileSync('public-handles.txt', 'utf-8').trim().split('\n') : []
)
fs.mkdirSync('clash-db', { recursive: true })

const defaultHeaders = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.5',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Brave";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'sec-gpc': '1',
  cookie: `cgSession=${SESSION_TOKEN}; AWSALB=KgA6zqFx1jEeLxlTQdB2GIAl6k04rp05YK1L4d2Qx8ZQC/yzuZiUGjGac9jMU4SF7qn/bZeyx6DKYH2ZRsD6A7eYYDT93pNeqaAGLS27SQiOEjvS3glz4HKQpgLr; AWSALBCORS=KgA6zqFx1jEeLxlTQdB2GIAl6k04rp05YK1L4d2Qx8ZQC/yzuZiUGjGac9jMU4SF7qn/bZeyx6DKYH2ZRsD6A7eYYDT93pNeqaAGLS27SQiOEjvS3glz4HKQpgLr`,
}

const getPendingClashes = async () => {
  /** @type {Clash[]} */
  const data = await ofetch('https://www.codingame.com/services/ClashOfCode/findPendingClashes', {
    headers: defaultHeaders,
    referrer: 'https://www.codingame.com/multiplayer/clashofcode',
    body: [],
    method: 'POST',
  })
  return data
}

const joinWaitingClash = async () => {
  await ofetch('https://www.codingame.com/services/ClashOfCode/playClash', {
    headers: defaultHeaders,
    referrer: 'https://www.codingame.com/multiplayer/clashofcode',
    body: [USER_ID, null],
    method: 'POST',
  })
}

const getClashContent = async publicHandle => {
  const { handle } = await ofetch('https://www.codingame.com/services/ClashOfCode/startClashTestSession', {
    headers: defaultHeaders,
    referrer: `https://www.codingame.com/clashofcode/clash/${publicHandle}`,
    body: [USER_ID, publicHandle],
    method: 'POST',
  })
  /** @type {ClashDetails} */
  const data = await ofetch('https://www.codingame.com/services/TestSession/startTestSession', {
    headers: defaultHeaders,
    referrer: `https://www.codingame.com/clashofcode/clash/${publicHandle}`,
    body: [handle],
    method: 'POST',
  })
  return data
}

const getClashValidSolutions = async publicHandle => {
  /** @type {ClashhReport} */
  const reportData = await ofetch('https://www.codingame.com/services/ClashOfCode/findClashReportInfoByHandle', {
    headers: defaultHeaders,
    referrer: `https://www.codingame.com/clashofcode/clash/report/${publicHandle}`,
    body: [publicHandle],
    method: 'POST',
  })

  /** @type {ClashSubmission[]} */
  const solutions = await Promise.all(
    reportData.players
      .filter(x => x.score === 100 && x.solutionShared)
      .map(player =>
        ofetch('https://www.codingame.com/services/Solution/findSolution', {
          headers: defaultHeaders,
          referrer: `https://www.codingame.com/clashofcode/clash/report/${publicHandle}`,
          body: [USER_ID, player.submissionId],
          method: 'POST',
        })
      )
  )
  return solutions
}

const hasClashContent = publicHandle => fs.existsSync(`clash-db/${publicHandle}.json`)

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function discoverThenJoinClashWaitingRoom() {
  console.log(`Fetching pending clash of code match...`)

  let clashes
  try {
    clashes = await getPendingClashes()
  } catch (error) {
    console.error('Error fetching clashes', error)
    return
  }

  if (clashes.length === 0) {
    console.log('No pending clash of code matches found')
    return
  }

  const publicHandle = clashes[0].publicHandle

  if (seenPublicHandles.has(publicHandle)) {
    console.log('No new clash of code match found')
    return
  }

  try {
    await joinWaitingClash()
    seenPublicHandles.add(publicHandle)
    fs.appendFileSync('public-handles.txt', publicHandle + '\n')
    console.log(`Joined a new clash of code match: ${publicHandle}`)
  } catch (error) {
    console.error('Error joining clash', error)
  }

  return publicHandle
}

async function fetchAndSaveClashContent(publicHandle) {
  try {
    console.log(`Fetching clash content for handle "${publicHandle}"`)
    const clashContent = await getClashContent(publicHandle)
    const questionId = clashContent.currentQuestion.question.id
    if (!hasClashContent(questionId)) {
      console.log(`Saving clash content for handle "${publicHandle}" and question "${questionId}"`)
      fs.writeFileSync(`clash-db/${questionId}.json`, JSON.stringify(clashContent, null, 2))
      fs.appendFileSync('clash-questions.txt', `${publicHandle}-${questionId}\n`)
    } else {
      console.log(
        `Clash content for handle "${publicHandle}" and question "${questionId}" is already in the database, will still look for solutions`
      )
    }
    return questionId
  } catch (error) {
    console.error(`Error fetching clash content for handle "${publicHandle}"`, error)
  }
}

async function fetchAndSaveClashSolutions(publicHandle, questionId) {
  try {
    console.log(`Fetching clash solutions for handle "${publicHandle}" and question "${questionId}"`)
    const solutions = await getClashValidSolutions(publicHandle)

    if (solutions.length > 0) {
      console.log(
        `Saving valid clash solutions for handle "${publicHandle}" and question "${questionId}", ${solutions.length} solutions found`
      )
      /** @type {ClashDetails} */
      const content = JSON.parse(
        fs.existsSync(`clash-db/${questionId}.json`) ? fs.readFileSync(`clash-db/${questionId}.json`, 'utf-8') : '{}'
      )
      const newSolutions = solutions.filter(x => !(content.solutions || []).some(y => y.code === x.code))
      if (newSolutions.length > 0) {
        content.solutions = [...(content.solutions || []), ...newSolutions]
        console.log('content', content)
        fs.writeFileSync(`clash-db/${questionId}.json`, JSON.stringify(content, null, 2))
      } else {
        console.log(
          `No new solutions for handle "${publicHandle}" and question "${questionId}", already have them in database`
        )
      }
    } else {
      console.log(`No valid clash solutions for handle "${publicHandle}" and question "${questionId}"`)
    }
  } catch (error) {
    console.error(`Error fetching clash content for handle "${publicHandle}"`, error)
  }
}

;(async () => {
  // await fetchAndSaveClashSolutions('3289022ee60f8b1c48baec59958eae39b420bed', '737259')
  // return
  for (let i = 1; true; i++) {
    process.stdout.write(`[${i}] `)

    try {
      const publicHandle = await discoverThenJoinClashWaitingRoom()

      if (publicHandle) {
        // Fetch the clash content in 2 minutes, so we are sure the clash started
        setTimeout(async () => {
          const questionId = await fetchAndSaveClashContent(publicHandle)

          if (questionId) {
            // Fetch the clash solutions in 17 minutes, so we are sure the clash ended
            setTimeout(() => {
              fetchAndSaveClashSolutions(publicHandle, questionId)
            }, 17 * 60 * 1000)
          }
        }, 2 * 60 * 1000)
      }
    } catch (error) {
      console.error('Global error', error)
    }

    console.log('Waiting 20 seconds..')
    await wait(20_000)
  }
})()
