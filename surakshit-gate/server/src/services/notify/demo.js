const config = require('../../config');

// Demo provider: no real SMS/WhatsApp. Messages appear in the "डेमो: माँ-बाप का फोन" screen.
// Numbers ending in 0000 behave like a wrong / switched-off number (to demo the alert).
module.exports = {
  name: 'demo',
  async send(msg) {
    if (msg.to.endsWith('0000')) {
      const e = new Error('नंबर पर मैसेज नहीं पहुँचा (डेमो: नंबर बंद/गलत)');
      e.numberProblem = true;
      throw e;
    }
    return { providerId: `demo-${msg._id}`, deliverAfterMs: config.messages.demoDeliverMs };
  },
};
