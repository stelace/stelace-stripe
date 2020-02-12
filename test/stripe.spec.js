require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const {
  testTools: { lifecycle, auth, util }
} = require('stelace-server')

const { WebhookManager } = util

const { before, beforeEach, after } = lifecycle
const { getSystemKey, getAccessTokenHeaders } = auth

const secretApiKey = process.env.STRIPE_SECRET_API_KEY
const tunnel = {
  auth: process.env.NGROK_AUTH,
  subdomain: process.env.NGROK_SUBDOMAIN,
  authToken: process.env.NGROK_AUTH_TOKEN
}

// perform Stripe tests only if the secret API key is provided
if (!secretApiKey) {
  test('No Stripe tests', async (t) => {
    t.pass()
  })
} else {
  test.before(async t => {
    await before({
      name: 'stelaceStripe'
    })(t)
    await beforeEach()(t)

    const systemKey = getSystemKey()

    await request(t.context.serverUrl)
      .patch('/config/private')
      .send({
        stelace: {
          integrations: {
            stripe: {
              secretApiKey
            }
          }
        }
      })
      .set({
        'x-stelace-system-key': systemKey,
        'x-platform-id': t.context.platformId,
        'x-stelace-env': t.context.env
      })
      .expect(200)
  })

  test('stripe request works and webhook is triggered', async (t) => {
    const authorizationHeaders = await getAccessTokenHeaders({
      t,
      permissions: [
        'integrations:read_write:stripe',
        'event:list:all',
      ]
    })

    const webhookUrl = `/integrations/stripe/webhooks/e${t.context.platformId}_${t.context.env}`
    let webhook

    const createWebhook = async (tunnelUrl) => {
      const { body: w } = await request(t.context.serverUrl)
        .post('/integrations/stripe/request')
        .send({
          method: 'webhookEndpoints.create',
          args: {
            enabled_events: ['*'],
            url: `${tunnelUrl}${webhookUrl}`
          }
        })
        .set(authorizationHeaders)
        .expect(200)

      webhook = w
    }

    const removeWebhook = async () => {
      await request(t.context.serverUrl)
        .post('/integrations/stripe/request')
        .send({
          method: 'webhookEndpoints.del',
          args: webhook.id
        })
        .set(authorizationHeaders)
        .expect(200)
    }

    const removeWebhookOnExit = async () => {
      if (webhook) await removeWebhook()
    }

    // remove created webhook if tests are manually interrupted (via Ctrl+C for instance)
    ['SIGHUP', 'SIGINT', 'SIGTERM'].forEach(signal => {
      process.on(signal, removeWebhookOnExit)
    })

    const webhookManager = new WebhookManager({
      t,
      tunnel,
      isWebhookSimulated: false,
      createWebhook,
      removeWebhook
    })
    await webhookManager.start()

    try {
      await webhookManager.updatePrivateConfig({
        stelace: {
          integrations: {
            stripe: {
              webhookSecret: webhook.secret
            }
          }
        }
      })

      const { body: customer } = await request(t.context.serverUrl)
        .post('/integrations/stripe/request')
        .send({
          method: 'customers.create',
          args: {
            name: 'Jenny Rosen',
            email: 'jenny.rosen@example.com',
            description: 'Customer for jenny.rosen@example.com',
          }
        })
        .set(authorizationHeaders)
        .expect(200)

      const { body: product } = await request(t.context.serverUrl)
        .post('/integrations/stripe/request')
        .send({
          method: 'products.create',
          args: {
            name: 'T-shirt',
            type: 'good',
            description: 'Comfortable cotton t-shirt',
            attributes: ['size', 'gender']
          }
        })
        .set(authorizationHeaders)
        .expect(200)

      await request(t.context.serverUrl)
        .post('/integrations/stripe/request')
        .send({
          method: 'products.del',
          args: product.id
        })
        .set(authorizationHeaders)
        .expect(200)

      await request(t.context.serverUrl)
        .post('/integrations/stripe/request')
        .send({
          method: 'customers.del',
          args: customer.id
        })
        .set(authorizationHeaders)
        .expect(200)

      await webhookManager.waitForEvents()

      const { body: { results: events } } = await request(t.context.serverUrl)
        .get('/events')
        .set(authorizationHeaders)
        .expect(200)

      // 'stripe' prefix added to event type
      const createdCustomerEvent = events.find(e => e.type === 'stripe_customer.created')
      const deletedCustomerEvent = events.find(e => e.type === 'stripe_customer.deleted')
      const createdProductEvent = events.find(e => e.type === 'stripe_product.created')
      const deletedProductEvent = events.find(e => e.type === 'stripe_product.deleted')

      t.truthy(createdCustomerEvent)
      t.truthy(deletedCustomerEvent)
      t.truthy(createdProductEvent)
      t.truthy(deletedProductEvent)

      t.is(createdCustomerEvent.metadata.data.object.id, customer.id)
      t.is(deletedCustomerEvent.metadata.data.object.id, customer.id)
      t.is(createdProductEvent.metadata.data.object.id, product.id)
      t.is(deletedProductEvent.metadata.data.object.id, product.id)
    } finally {
      await removeWebhookOnExit()
    }
  })

  test.after(after())
}
