const Audit = require('../models/Audit');

async function audit(req, action, detail = '') {
  try {
    await Audit.create({ user: req.user?._id, userName: req.user ? `${req.user.name} (${req.user.username})` : 'system', action, detail: String(detail).slice(0, 300) });
  } catch {
    /* never block the request on audit */
  }
}
module.exports = { audit };
