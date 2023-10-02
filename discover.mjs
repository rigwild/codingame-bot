// @ts-check
/// <reference types="./types.d.ts" />

import fs from 'fs'
import { ofetch, FetchError } from 'ofetch'
import { MetricsUtils } from './metrics.mjs'

// User ID in short format like 1234321, you can find it by viewing source of Codingame page
// `"userId":1234321,"email`:"..."
const USER_ID = process.env.USER_ID
// `cgSession` cookie
let SESSION_TOKEN = process.env.SESSION_TOKEN

if (!SESSION_TOKEN || !USER_ID) {
  console.error('Please set SESSION_TOKEN and USER_ID environment variables')
  process.exit(1)
}

const seenPublicHandles = new Set(
  fs.existsSync('_public-handles.txt') ? fs.readFileSync('_public-handles.txt', 'utf-8').trim().split('\n') : []
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

const isHttp4xxError = error => {
  if (error instanceof FetchError) {
    const statusCode = error.statusCode || -1
    return statusCode >= 400 && statusCode < 500
  }
  return false
}

const readSessionTokenFromFile = () => {
  if (fs.existsSync('_session-token.txt')) {
    const json = JSON.parse(fs.readFileSync('_session-token.txt', 'utf-8') || '{ lastUpdated: 0 }')
    if (json.sessionToken !== SESSION_TOKEN && json.lastUpdated > Date.now() - 1000 * 60 * 60 * 2) {
      console.log('Updating session token from file')
      SESSION_TOKEN = json.sessionToken
    }
  }
}

const addErrorMetrics = error => {
  MetricsUtils.codingame_bot_error.inc()
  if (isHttp4xxError(error)) MetricsUtils.codingame_bot_error_4xx.inc()
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

/**
 * @param {string} testSessionHandle
 * @param {string} code
 * @param {string} programmingLanguageId
 * @returns
 */
const submitClashSolution = async (testSessionHandle, code, programmingLanguageId) => {
  const data = await ofetch('https://www.codingame.com/services/TestSession/submit', {
    headers: defaultHeaders,
    referrer: 'https://www.codingame.com/multiplayer/clashofcode',
    body: [testSessionHandle, { code, programmingLanguageId }, null],
    method: 'POST',
  })
  return data
}

const shareMyClashSolution = async publicHandle => {
  await ofetch('https://www.codingame.com/services/ClashOfCode/shareCodinGamerSolutionByHandle', {
    headers: defaultHeaders,
    referrer: `https://www.codingame.com/clashofcode/clash/${publicHandle}`,
    body: [USER_ID, publicHandle],
    method: 'POST',
  })
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
    addErrorMetrics(error)
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
    fs.appendFileSync('_public-handles.txt', publicHandle + '\n')
    console.log(`Joined a new clash of code match: ${publicHandle}`)
    MetricsUtils.codingame_bot_clash_join.inc()
    return publicHandle
  } catch (error) {
    console.error('Error joining clash', error)
    addErrorMetrics(error)
  }
}

async function fetchAndSaveClashContent(publicHandle) {
  try {
    console.log(`Fetching clash content for handle "${publicHandle}"`)
    const clashContent = await getClashContent(publicHandle)
    const questionId = clashContent.currentQuestion.question.id
    let solutionsCount = 0
    if (!hasClashContent(questionId)) {
      console.log(`Saving clash content for handle "${publicHandle}" and question "${questionId}"`)
      fs.writeFileSync(`clash-db/${questionId}.json`, JSON.stringify(clashContent, null, 2))
      fs.appendFileSync('_clash-questions.txt', `${publicHandle}-${questionId}\n`)
      MetricsUtils.codingame_bot_clash_question_save_new.inc()
    } else {
      // Check if we have a solution for it
      /** @type {ClashDetails} */
      const questionData = JSON.parse(fs.readFileSync(`clash-db/${questionId}.json`, 'utf-8'))
      solutionsCount = questionData.solutions ? questionData.solutions.length : 0
      console.log(
        `Clash content for handle "${publicHandle}" and question "${questionId}" is already in database ` +
          `with ${solutionsCount} solutions`
      )
      MetricsUtils.codingame_bot_clash_question_has_solution.inc()
    }
    return { testSessionHandle: clashContent.testSessionHandle, questionId, solutionsCount }
  } catch (error) {
    console.error(`Error fetching clash content for handle "${publicHandle}"`, error)
    addErrorMetrics(error)
  }
}

async function submitSolution(publicHandle, testSessionHandle, questionId) {
  try {
    /** @type {ClashDetails} */
    const questionData = JSON.parse(
      fs.existsSync(`clash-db/${questionId}.json`) ? fs.readFileSync(`clash-db/${questionId}.json`, 'utf-8') : '{}'
    )

    if (!questionData.solutions || questionData.solutions.length === 0) {
      return
    }

    const pickedSolution = questionData.solutions[Math.floor(Math.random() * questionData.solutions.length)]
    await submitClashSolution(testSessionHandle, pickedSolution.code, pickedSolution.programmingLanguageId)
    console.log(`Submitted solution for handle "${publicHandle}" and question "${questionId}"`)
    MetricsUtils.codingame_bot_clash_submit.inc()
    setTimeout(async () => {
      await shareMyClashSolution(publicHandle)
      console.log(`Shared solution for handle "${publicHandle}" and question "${questionId}"`)
    }, 15000)
  } catch (error) {
    console.error(`Error fetching clash content for handle "${publicHandle}"`, error)
    addErrorMetrics(error)
  }
}

async function fetchAndSaveClashSolutions(publicHandle, questionId) {
  try {
    console.log(`Fetching clash solutions for handle "${publicHandle}" and question "${questionId}"`)
    const fetchedSolutions = await getClashValidSolutions(publicHandle)
    MetricsUtils.codingame_bot_clash_solutions_fetch.inc()

    if (fetchedSolutions.length > 0) {
      /** @type {ClashDetails} */
      const questionData = JSON.parse(
        fs.existsSync(`clash-db/${questionId}.json`) ? fs.readFileSync(`clash-db/${questionId}.json`, 'utf-8') : '{}'
      )
      const newSolutions = fetchedSolutions.filter(x => !(questionData.solutions || []).some(y => y.code === x.code))
      if (newSolutions.length > 0) {
        questionData.solutions = [...(questionData.solutions || []), ...newSolutions]
        // console.log('content', questionData)
        console.log(
          `Saving valid clash solutions for handle "${publicHandle}" and question "${questionId}", ${fetchedSolutions.length} solutions found, ${newSolutions.length} were not in database`
        )
        fs.writeFileSync(`clash-db/${questionId}.json`, JSON.stringify(questionData, null, 2))
        MetricsUtils.codingame_bot_clash_solutions_new.inc()
      } else {
        console.log(
          `No new solutions for handle "${publicHandle}" and question "${questionId}", already have them in database`
        )
      }
    } else {
      console.log(`No 100% pass clash solutions for handle "${publicHandle}" and question "${questionId}"`)
    }
  } catch (error) {
    console.error(`Error fetching clash content for handle "${publicHandle}"`, error)
    addErrorMetrics(error)
  }
}

// Process manually if closed the process
async function _processManually() {
  const _clashQuestions = (
    fs.existsSync('_clash-questions_missed.txt') ? fs.readFileSync('_clash-questions_missed.txt', 'utf-8') : ''
  )
    .trim()
    .split('\n')
    .map(x => x.trim().split('-'))

  for (const [publicHandle, questionId] of _clashQuestions) {
    await fetchAndSaveClashSolutions(publicHandle, questionId).catch(error => {
      console.error('Error fetching clash solutions', error)
      addErrorMetrics(error)
    })
    await wait(250)
  }
}

;(async () => {
  setTimeout(() => {
    _processManually()
  }, 20 * 60 * 1000)

  for (let i = 1; true; i++) {
    process.stdout.write(`[${i}] `)
    readSessionTokenFromFile()

    try {
      const publicHandle = await discoverThenJoinClashWaitingRoom()

      if (publicHandle) {
        // Fetch the clash content in 2 minutes, so we are sure the clash started
        setTimeout(async () => {
          const clashContent = await fetchAndSaveClashContent(publicHandle)
          console.log('clashContent', clashContent)
          if (clashContent) {
            setTimeout(() => {
              if (clashContent.solutionsCount > 0) {
                submitSolution(publicHandle, clashContent.testSessionHandle, clashContent.questionId)
              }
            }, Math.random() * 4 * 60 * 1000)

            // Fetch the clash solutions in 17 minutes, so we are sure the clash ended
            setTimeout(() => {
              fetchAndSaveClashSolutions(publicHandle, clashContent.questionId)
            }, 17 * 60 * 1000)
          }
        }, 2 * 60 * 1000)
      }
    } catch (error) {
      console.error('Global error', error)
      addErrorMetrics(error)
    }

    console.log('Waiting 20 seconds..')
    await wait(20_000)
  }
})()
