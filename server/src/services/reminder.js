const config = require('../config');
const { formatINR } = require('../utils/money');

function buildReminderText(customer, shopName = config.shopName) {
  const amount = formatINR(Math.round(customer.balance * 100));
  return `नमस्ते ${customer.name} जी, ${shopName} में आपका ₹${amount} बाक़ी है। कृपया सुविधा अनुसार जल्द भुगतान करें। धन्यवाद 🙏`;
}

function buildLinks(customer, text) {
  const intl = `91${customer.phone}`;
  const encoded = encodeURIComponent(text);
  return {
    whatsappUrl: `https://wa.me/${intl}?text=${encoded}`,
    smsUrl: `sms:+${intl}?body=${encoded}`,
  };
}

module.exports = { buildReminderText, buildLinks };
