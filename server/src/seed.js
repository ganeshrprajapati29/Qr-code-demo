// Inserts FAKE demo customers and entries. Usage: npm run seed  (add --reset to wipe first)
const mongoose = require('mongoose');
const config = require('./config');
const Customer = require('./models/Customer');
const Transaction = require('./models/Transaction');

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

const demo = [
  { name: 'रमेश कुमार (डेमो)', phone: '9000000001', txns: [['udhar', 1200, 12, 'आटा, दाल'], ['udhar', 450, 6, 'तेल'], ['jama', 500, 2, 'नकद']] },
  { name: 'सुनीता देवी (डेमो)', phone: '9000000002', txns: [['udhar', 860, 9, 'राशन'], ['jama', 860, 1, 'UPI']] },
  { name: 'Amit Verma (Demo)', phone: '9000000003', txns: [['udhar', 2350.5, 15, 'महीने का सामान'], ['jama', 1000, 8, 'नकद']] },
  { name: 'मोहन लाल (डेमो)', phone: '9000000004', txns: [['udhar', 320, 3, 'दूध, ब्रेड']] },
  { name: 'Priya Singh (Demo)', phone: '9000000005', txns: [['jama', 200, 4, 'एडवांस']] },
];

async function run() {
  await mongoose.connect(config.mongoUri);
  if (process.argv.includes('--reset')) {
    await Promise.all([Customer.deleteMany({}), Transaction.deleteMany({})]);
    console.log('[seed] wiped existing data');
  }
  for (const d of demo) {
    const exists = await Customer.findOne({ phone: d.phone });
    if (exists) continue;
    const c = await Customer.create({ name: d.name, phone: d.phone });
    await Transaction.insertMany(
      d.txns.map(([type, rupees, ago, note]) => ({ customer: c._id, type, amount: Math.round(rupees * 100), date: daysAgo(ago), note }))
    );
    console.log(`[seed] added ${d.name}`);
  }
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
