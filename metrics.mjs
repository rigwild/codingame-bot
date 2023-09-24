//
// Expose metrics for Prometheus
//

// @ts-check
import http from 'http'
import url from 'url'
import * as Prometheus from 'prom-client'

const register = new Prometheus.Registry()

if (process.env.USE_METRICS === '1') {
  register.setDefaultLabels({ app: 'codingame-bot' })

  http
    .createServer(async (req, res) => {
      const route = url.parse(req.url || '').pathname
      if (route === '/metrics') {
        res.setHeader('Content-Type', register.contentType)
        res.end(await register.metrics())
        return
      }
      res.end()
    })
    .listen(62622)

  Prometheus.collectDefaultMetrics({ register })
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
}
