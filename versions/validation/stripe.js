module.exports = function createValidation (deps) {
  const {
    utils: {
      validation: { Joi }
    }
  } = deps

  const schemas = {}

  // ////////// //
  // 2019-05-20 //
  // ////////// //
  schemas['2019-05-20'] = {}
  schemas['2019-05-20'].request = {
    body: Joi.object().keys({
      method: Joi.string().required(),
      args: Joi.array().items().single()
    })
  }
  schemas['2019-05-20'].webhook = null

  const validationVersions = {
    '2019-05-20': [
      {
        target: 'stripe.pluginRequest',
        schema: schemas['2019-05-20'].request
      },
      {
        target: 'stripe.webhooks',
        schema: schemas['2019-05-20'].webhook
      }
    ]
  }

  return validationVersions
}
