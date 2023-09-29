// @ts-check

import puppeteer from 'puppeteer-extra'
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha'
import { MetricsUtils } from '../metrics.mjs'

// User ID in short format like 1234321, you can find it by viewing source of Codingame page
// `"userId":1234321,"email`:"..."
const USER_ID = process.env.USER_ID
// `cgSession` cookie
const SESSION_TOKEN = process.env.SESSION_TOKEN
const TWOCAPTCHA_API_TOKEN = process.env.TWOCAPTCHA_API_TOKEN

if (!SESSION_TOKEN || !USER_ID || !TWOCAPTCHA_API_TOKEN) {
  console.error('Please set SESSION_TOKEN, USER_ID, TWOCAPTCHA_API_TOKEN environment variables')
  process.exit(1)
}

puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: '2captcha',
      token: TWOCAPTCHA_API_TOKEN,
    },
  })
)

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

;(async () => {
  // use windows width of iPhone 14
  const browser = await puppeteer.launch({
    // headless: false,
    defaultViewport: {
      width: 1920,
      height: 1024,
    },
    args: [
      '--window-size=1920,1024',
      '--disable-features=IsolateOrigins,site-per-process,SitePerProcess',
      '--flag-switches-begin',
      '--disable-site-isolation-trials',
      '--flag-switches-end',
    ],
  })
  const [page] = await browser.pages()
  await page.setCookie({
    name: 'cgSession',
    value: SESSION_TOKEN,
    domain: 'www.codingame.com',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  })

  for (let i = 1; true; i++) {
    console.log(`[${i}] Check if we need to validate a captcha...`)

    try {
      await page.goto('https://www.codingame.com/multiplayer/clashofcode', { waitUntil: 'networkidle0' })
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('[translate="content-details.joinClash"]'),
      ])

      const { captchas } = await page.findRecaptchas()
      if (captchas.length === 0) {
        console.log('We were not asked to solve a captcha!')
        break
      }

      MetricsUtils.codingame_bot_captcha_attempt.inc()
      await page.solveRecaptchas()

      console.log('Captcha solved!')
      MetricsUtils.codingame_bot_captcha_success.inc()
      break
    } catch (error) {
      console.error('Failed to solve captcha', error)
    }

    console.log('Waiting 5 minutes..')
    await wait(5 * 60 * 1000)
  }
})()
