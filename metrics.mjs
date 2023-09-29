//
// Push metrics to Prometheus
//
// Set `PROMETHEUS_GATEWAY_ENDPOINT=http://127.0.0.1:9091` with the endpoint of the Prometheus Push Gateweay
//
// See https://github.com/prometheus/exporter-toolkit/blob/master/docs/web-configuration.md
//

// @ts-check
import * as Prometheus from 'prom-client'

const CLIENT_LABEL = 'codingame-bot'

const register = new Prometheus.Registry()

if (process.env.PROMETHEUS_GATEWAY_ENDPOINT) {
  const GATEWAY_ENDPOINT = process.env.PROMETHEUS_GATEWAY_ENDPOINT

  console.log(`\n\n[Metrics] Metrics are enabled, will push them to ${GATEWAY_ENDPOINT} in the background\n\n`)

  const gateway = new Prometheus.Pushgateway(GATEWAY_ENDPOINT, {}, register)

  register.setDefaultLabels({ app: CLIENT_LABEL })
  Prometheus.collectDefaultMetrics({ register })

  async function pushMetrics() {
    const res = await gateway.push({ jobName: CLIENT_LABEL })
    const resp = /** @type {any} */ (res.resp)
    if (resp?.statusCode !== 200 && resp?.statusCode !== 204) {
      throw new Error(`[Metrics] Bad response status code from gateway ${resp.statusCode}`)
    }
    // console.log('[Metrics] Pushed metrics to gateway')
  }

  pushMetrics()
    .catch(err => {
      throw new Error(
        '[Metrics] Error on first push of metrics to gateway, exiting program ',
        // @ts-ignore
        { cause: err }
      )
    })
    .then(() => {
      // Start pushing metrics on a regular basis in the background
      setInterval(() => {
        pushMetrics().catch(err => console.error('[Metrics] Error pushing metrics to gateway', err))
      }, 5_000)
    })
} else {
  console.log(
    '\n\n[Metrics] Metrics are disabled, set `PROMETHEUS_GATEWAY_ENDPOINT` in your environment to enable them\n\n'
  )
}

export const MetricsUtils = {
  codingame_bot_clash_join: new Prometheus.Counter({
    name: 'codingame_bot_clash_join',
    help: 'Count entered a Clash of Code match',
    registers: [register],
  }),

  codingame_bot_clash_question_save_new: new Prometheus.Counter({
    name: 'codingame_bot_clash_question_save_new',
    help: 'How many times we started a Clash of Code match and saved its question data',
    registers: [register],
  }),
  codingame_bot_clash_question_has_solution: new Prometheus.Counter({
    name: 'codingame_bot_clash_question_has_solution',
    help: 'How many times we landed on a Clash of Code match with a question that we already had a solution for',
    registers: [register],
  }),

  codingame_bot_clash_solutions_fetch: new Prometheus.Counter({
    name: 'codingame_bot_clash_solutions_fetch',
    help: 'How many times we fetched a Clash of Code match solutions',
    registers: [register],
  }),
  codingame_bot_clash_solutions_new: new Prometheus.Counter({
    name: 'codingame_bot_clash_solutions_new',
    help: 'How many times a Clash of Code match contains full pass solutions that we did not have before',
    registers: [register],
  }),

  codingame_bot_error: new Prometheus.Counter({
    name: 'codingame_bot_error',
    help: 'How many times an error occured',
    registers: [register],
  }),
  codingame_bot_error_4xx: new Prometheus.Counter({
    name: 'codingame_bot_error_4xx',
    help: 'How many times a we received a 4XX HTTP error status code',
    registers: [register],
  }),

  codingame_bot_captcha_attempt: new Prometheus.Counter({
    name: 'codingame_bot_captcha_attempt',
    help: 'How many times a we tried to solve a captcha',
    registers: [register],
  }),
  codingame_bot_captcha_success: new Prometheus.Counter({
    name: 'codingame_bot_captcha_success',
    help: 'How many times a we successfully solved a captcha',
    registers: [register],
  }),
}
