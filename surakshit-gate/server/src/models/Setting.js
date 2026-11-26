const mongoose = require('mongoose');

const DEFAULTS = {
  schoolName: 'डेमो पब्लिक स्कूल',
  officePhone: '',
  otpTtlMin: 10,
  parentTimeoutMin: 5,
  pickupPhotoRetentionDays: 30,
  backupHour: 2,
  sessionName: '2026-27',
  dismissalTime: '12:00',
  repeatGraceMin: 2,
};

const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'main' },
    schoolName: { type: String, default: DEFAULTS.schoolName, maxlength: 80 },
    officePhone: { type: String, default: DEFAULTS.officePhone },
    otpTtlMin: { type: Number, default: DEFAULTS.otpTtlMin, min: 5, max: 10 },
    parentTimeoutMin: { type: Number, default: DEFAULTS.parentTimeoutMin, min: 2, max: 10 },
    pickupPhotoRetentionDays: { type: Number, default: DEFAULTS.pickupPhotoRetentionDays, min: 1, max: 365 },
    backupHour: { type: Number, default: DEFAULTS.backupHour, min: 0, max: 23 },
    sessionName: { type: String, default: DEFAULTS.sessionName, maxlength: 20 },
    // before this time (India) a second scan of a child who is inside raises an alert
    dismissalTime: { type: String, default: DEFAULTS.dismissalTime, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    // a repeat within this many minutes is treated as the guard scanning twice by mistake
    repeatGraceMin: { type: Number, default: DEFAULTS.repeatGraceMin, min: 0, max: 30 },
    lastBackupAt: { type: Date, default: null },
  },
  { timestamps: true }
);

settingSchema.statics.get = async function get() {
  let s = await this.findById('main');
  if (!s) s = await this.create({ _id: 'main' });
  return s;
};

module.exports = mongoose.model('Setting', settingSchema);
module.exports.DEFAULTS = DEFAULTS;
