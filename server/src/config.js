require('dotenv').config({ quiet: true });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5055,
  host: process.env.HOST || '127.0.0.1',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/udhar_khata',
  shopName: process.env.SHOP_NAME || 'हमारी दुकान',
  corsOrigin: process.env.CORS_ORIGIN || '',
  clientDist: process.env.CLIENT_DIST || '',
  whatsapp: {
    token: process.env.WA_TOKEN || '',
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID || '',
    templateName: process.env.WA_TEMPLATE_NAME || '',
    templateLang: process.env.WA_TEMPLATE_LANG || 'hi',
    apiVersion: process.env.WA_API_VERSION || 'v21.0',
  },
};

config.whatsapp.enabled = Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);

module.exports = config;
