const Stripe = require('stripe')
const debug = require('debug')('stelace:integrations:stripe')
const _ = require('lodash')
const { parsePublicPlatformId } = require('stelace-util-keys')

module.exports = function createService (deps) {
  const {
    createError,
    communication: { stelaceApiRequest },

    configRequester,
  } = deps

  return {
    sendRequest,
    webhook
  }

  async function sendRequest (req) {
    const { env, method, args = [{}] } = req

    const privateConfig = await configRequester.communicate(req)({
      type: '_getConfig',
      access: 'private'
    })

    const { secretApiKey } = _.get(privateConfig, 'stelace.integrations.stripe', {})
    if (!secretApiKey) throw createError(403, 'Stripe secret API key not configured')

    const stripe = Stripe(secretApiKey)

    if (typeof _.get(stripe, method) !== 'function') {
      throw createError(400, 'Stripe method not found', { public: { method } })
    }

    try {
      // awaiting to handle error in catch block
      return await _.invoke(stripe, method, ...args) // promise
    } catch (err) {
      const errorMessage = 'Stripe error'
      const errObject = { expose: true }

      const reveal = !(process.env.NODE_ENV === 'production' && env === 'live')
      const errDetails = {
        stripeMethod: method,
        stripeError: err
      }
      if (reveal) _.set(errObject, 'public', errDetails)

      throw createError(err.http_status_code, errorMessage, errObject)
    }
  }

  async function webhook ({ _requestId, stripeSignature, rawBody, publicPlatformId }) {
    debug('Stripe integration: webhook event %O', rawBody)

    const { hasValidFormat, platformId, env } = parsePublicPlatformId(publicPlatformId)
    if (!hasValidFormat) throw createError(403)

    if (_.isEmpty(rawBody)) throw createError(400, 'Event object body expected')

    const req = {
      _requestId,
      platformId,
      env
    }

    const privateConfig = await configRequester.communicate(req)({
      type: '_getConfig',
      access: 'private'
    })

    const { secretApiKey, webhookSecret } = _.get(privateConfig, 'stelace.integrations.stripe', {})
    if (!secretApiKey) throw createError(403, 'Stripe API key not configured')
    if (!webhookSecret) throw createError(403, 'Stripe Webhook secret not configured')

    const stripe = Stripe(secretApiKey)

    let event

    // Verify Stripe webhook signature
    // https://stripe.com/docs/webhooks/signatures
    try {
      event = stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret)
    } catch (err) {
      throw createError(403)
    }

    // prefix prevents overlapping with other event types
    const type = `stripe_${event.type}`
    const params = {
      type,
      orderBy: 'createdDate',
      order: 'desc',
      page: 1
    }

    const headers = {
      'x-stelace-version': '2019-05-20',
    }

    const { results: sameEvents } = await stelaceApiRequest('/events', {
      platformId,
      env,
      headers,
      payload: {
        objectId: event.id,
        nbResultsPerPage: 1,
        ...params
      }
    })

    // Stripe webhooks may send same events multiple times
    // https://stripe.com/docs/webhooks/best-practices#duplicate-events
    if (sameEvents.length) {
      debug('Stripe integration: idempotency check with event id: %O', sameEvents)
    }

    await stelaceApiRequest('/events', {
      platformId,
      env,
      headers,
      method: 'POST',
      payload: {
        // https://stripe.com/docs/api/events/types
        // No Stripe event name currently has two underscores '__', which would cause an error
        type,
        objectId: event.id, // just a convention to easily retrieve events, objectId being indexed
        emitterId: 'stripe',
        metadata: event
      }
    })

    return { success: true }
  }
}
