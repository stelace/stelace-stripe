const createService = require('../services/stripe')

let stripe
let deps = {}

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions,
    restifyAuthorizationParser
  } = middlewares
  const {
    wrapAction,
    getRequestContext
  } = helpers

  server.post({
    name: 'stripe.pluginRequest',
    path: '/integrations/stripe/request'
  }, checkPermissions([
    'integrations:read_write:stripe',
    'integrations:read_write:all' // does not currently exist
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const { args, method } = req.body
    ctx = Object.assign({}, ctx, { args, method })

    return stripe.sendRequest(ctx)
  }))

  server.post({
    name: 'stripe.webhooks',
    path: '/integrations/stripe/webhooks/:publicPlatformId',
    manualAuth: true
  }, restifyAuthorizationParser, wrapAction(async (req, res) => {
    const { publicPlatformId } = req.params
    const stripeSignature = req.headers['stripe-signature']

    return stripe.webhook({
      _requestId: req._requestId,
      publicPlatformId,
      stripeSignature,
      rawBody: req.rawBody,
      deps
    })
  }))
}

function start (startParams) {
  deps = Object.assign({}, startParams)

  const {
    communication: { getRequester }
  } = deps

  const configRequester = getRequester({
    name: 'Stripe service > Config Requester',
    key: 'config'
  })

  Object.assign(deps, {
    configRequester,
  })

  stripe = createService(deps)
}

function stop () {
  const {
    configRequester,
  } = deps

  configRequester.close()

  deps = null
}

module.exports = {
  init,
  start,
  stop
}
