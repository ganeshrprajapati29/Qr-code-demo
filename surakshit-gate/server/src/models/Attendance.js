const mongoose = require('mongoose');

// one document per student per school day (India date)
const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    className: { type: String, required: true }, // class on that day
    date: { type: String, required: true }, // YYYY-MM-DD (Asia/Kolkata)
    inAt: { type: Date, required: true },
    inBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    outAt: { type: Date, default: null },
    outBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    outMode: { type: String, enum: ['parent', 'pickup', null], default: null },
    pickup: { type: mongoose.Schema.Types.ObjectId, ref: 'Pickup', default: null },
  },
  { timestamps: true }
);
attendanceSchema.index({ student: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, className: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
