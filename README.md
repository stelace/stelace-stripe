# Stelace plugin: Stripe wrapper

[Stripe-node](
  https://github.com/stripe/stripe-node
) library endpoints are wrapped for convenience in this plugin so you can use them right from Stelace SDK or [Workflows](
  https://stelace.com/docs/command/workflows
).

[![CircleCI](https://circleci.com/gh/stelace/stelace.svg?style=svg)](https://circleci.com/gh/stelace/stelace)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-yellow.svg)](https://standardjs.com)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)

> For instructions about using and developing Stelace plugins, have a look at [server docs](https://github.com/stelace/stelace/blob/dev/docs/plugins.md).

## Example usage

With [JavaScript SDK](https://github.com/stelace/stelace.js):

```js
const { createInstance } = require('stelace')

// Please ensure the code is run in a secure environment
// The API key must include the permission 'integrations:read_write:stripe'
const stelace = createInstance({ apiKey: 'seck_...' })

const customers = await stelace.forward.post('/integrations/stripe/request', {
  // It will invoke the method `stripe.customers.list` from Stripe Node.js SDK
  // https://github.com/stripe/stripe-node
  // method invoked without parameters
  method: 'customers.list'
})

const customer = await stelace.forward.post('/integrations/stripe/request', {
  method: 'customers.create',

  // one parameter
  args: {
    name: 'Jenny Rosen'
  }
})

const updatedCustomer = await stelace.forward.post('/integrations/stripe/request', {
  method: 'customers.update',

  // multiple parameters
  args: [
    customer.id,
    {
      email: 'jenny.rosen@example.com'
    }
  ]
})

const deletedCustomer = await stelace.forward.post('/integrations/stripe/request', {
  method: 'customers.del',

  // one parameter
  args: customer.id
})
```

With plain REST API calls, using [axios](https://github.com/axios/axios):

```js
const axios = require('axios')

const encodeBase64 = str => Buffer.from(str).toString('base64')

// Please ensure the code is run in a secure environment
// The API key must include the permission 'integrations:read_write:stripe'
const secretApiKey = 'seck_...'

const authorizationHeaders = {
  authorization: `Basic ${encodeBase64(`${secretApiKey}:`)}`
}

const { data: customers } = await axios.post(
  'https://api.stelace.com/integrations/stripe/request',

  // It will invoke the method `stripe.customers.list` from Stripe Node.js SDK
  // https://github.com/stripe/stripe-node
  // method invoked without parameters
  { method: 'customers.list' },
  { headers: authorizationHeaders }
)

const { data: customer } = await axios.post(
  'https://api.stelace.com/integrations/stripe/request',
  {
    method: 'customers.create',

    // one parameter
    args: {
      name: 'Jenny Rosen'
    }
  },
  { headers: authorizationHeaders }
)

const { data: updatedCustomer } = await axios.post(
  'https://api.stelace.com/integrations/stripe/request',
  {
    method: 'customers.update',

    // multiple parameters
    args: [
      customer.id,
      {
        email: 'jenny.rosen@example.com'
      }
    ]
  },
  { headers: authorizationHeaders }
)

const { data: deletedCustomer } = await axios.post(
  'https://api.stelace.com/integrations/stripe/request',
  {
    method: 'customers.del',

    // one parameter
    args: customer.id
  },
  { headers: authorizationHeaders }
)
```

## Configuration

The Stripe plugin works if the following private configuration values are provided:

With Stelace SDK:

```js
await stelace.config.updatePrivate({
  stelace: {
    integrations: {
      stripe: {
        secretApiKey, // Stripe secret API key

        // Stripe webhook secret,
        // optional but recommended if you want to have access to Stripe events within Stelace
        webhookSecret
      }
    }
  }
})
```

Equivalent to:

```js
await axios.patch(
  'https://api.stelace.com/config/private',
  {
    // config body
  },
  { headers: authorizationHeaders }
)
```

## Tests and development

You’ll be able to run plugin tests as long as a Stripe secret API key is provided in the .env file, or in CI environment.

```sh
STRIPE_SECRET_API_KEY=...
```

Before launching tests, please ensure plugins specified in the environment variable `INSTALLED_PLUGINS` are installed:

```sh
yarn
yarn plugins:server
```

and that databases are up and running after:

```sh
yarn --cwd node_modules/stelace-server/ run docker:db
```

Then you can run plugin tests with `yarn test`.

Run plugin tests _and_ all server tests with `yarn test:server`.

## License

Stelace Copyright © 2018-present Sharinplace SAS.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

A copy of the GNU General Public License is included in this program,
and is also available at [https://www.gnu.org/licenses/gpl-3.0.txt](
  https://www.gnu.org/licenses/gpl-3.0.txt).
