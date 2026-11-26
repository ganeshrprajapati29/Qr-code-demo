const config = require('../config');
const Pickup = require('../models/Pickup');
const Setting = require('../models/Setting');
const { refresh, OPEN } = require('./pickups');
const { removeImage } = require('./photos');
const { createBackup } = require('./backup');

// expire pickups, raise "no response" alerts
async function tickPickups() {
  const s = await Setting.get();
  const open = await Pickup.find({ status: { $in: OPEN } });
  for (const p of open) await refresh(p, s);
}

// delete pickers' photos after N days (privacy)
async function cleanupPhotos() {
  const s = await Setting.get();
  const cutoff = new Date(Date.now() - s.pickupPhotoRetentionDays * 86400000);
  const old = await Pickup.find({ createdAt: { $lt: cutoff }, photo: { $ne: '' }, photoDeletedAt: null });
  for (const p of old) {
    await removeImage('pickups', p.photo);
    p.photoDeletedAt = new Date();
    p.photo = '';
    await p.save();
  }
  return old.length;
}

async function dailyBackup() {
  const s = await Setting.get();
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: config.timeZone, hour: 'numeric', hour12: false }).format(new Date()));
  const last = s.lastBackupAt ? Date.now() - s.lastBackupAt.getTime() : Infinity;
  if (hour >= s.backupHour && last > 20 * 3600 * 1000) {
    await createBackup('auto');
    s.lastBackupAt = new Date();
    await s.save();
    console.log('[backup] daily backup done');
  }
}

function start() {
  const run = async (fn) => {
    try {
      await fn();
    } catch (e) {
      console.error('[scheduler]', fn.name, e.message);
    }
  };
  const t1 = setInterval(() => run(tickPickups), 30 * 1000);
  const t2 = setInterval(() => {
    run(dailyBackup);
    run(cleanupPhotos);
  }, 10 * 60 * 1000);
  [t1, t2].forEach((t) => t.unref());
  setTimeout(() => { run(dailyBackup); run(cleanupPhotos); }, 15000).unref();
}

module.exports = { start, tickPickups, cleanupPhotos, dailyBackup };
