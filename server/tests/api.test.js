process.env.NODE_ENV = 'test';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { toPaise } = require('../src/utils/money');
const { normalizePhone } = require('../src/utils/phone');

let mongod;
let app;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await mongoose.model('Customer').syncIndexes();
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.model('Customer').syncIndexes();
});

const addCustomer = (name = 'रमेश', phone = '9876543210') =>
  request(app).post('/api/customers').send({ name, phone });

test('money + phone helpers', () => {
  assert.equal(toPaise('250'), 25000);
  assert.equal(toPaise('99.5'), 9950);
  assert.equal(toPaise('0.1'), 10);
  assert.ok(Number.isNaN(toPaise('-5')));
  assert.ok(Number.isNaN(toPaise('1.234')));
  assert.ok(Number.isNaN(toPaise('abc')));
  assert.equal(normalizePhone('+91 98765-43210'), '9876543210');
  assert.equal(normalizePhone('09876543210'), '9876543210');
});

test('health endpoint', async () => {
  const r = await request(app).get('/api/health').expect(200);
  assert.equal(r.body.ok, true);
});

test('adds a customer and rejects bad input / duplicates', async () => {
  const r = await addCustomer('  रमेश   कुमार ', '+91 98765 43210').expect(201);
  assert.equal(r.body.customer.name, 'रमेश कुमार');
  assert.equal(r.body.customer.phone, '9876543210');
  assert.equal(r.body.customer.balance, 0);

  await addCustomer('X', '9876543211').expect(400);
  await addCustomer('सुरेश', '12345').expect(400);
  const dup = await addCustomer('दूसरा', '9876543210').expect(409);
  assert.match(dup.body.error, /पहले से/);
});

test('balance = udhar - jama, with paise precision', async () => {
  const { body } = await addCustomer().expect(201);
  const id = body.customer.id;
  const post = (type, amount) => request(app).post(`/api/customers/${id}/transactions`).send({ type, amount, date: '2026-01-10' });

  await post('udhar', '1200').expect(201);
  await post('udhar', '450.75').expect(201);
  const last = await post('jama', '500.25').expect(201);
  assert.equal(last.body.customer.balance, 1150.5);
  assert.equal(last.body.customer.totalUdhar, 1650.75);
  assert.equal(last.body.customer.totalJama, 500.25);

  await post('udhar', '0').expect(400);
  await post('udhar', '-10').expect(400);
  await post('kuch', '10').expect(400);

  const detail = await request(app).get(`/api/customers/${id}`).expect(200);
  assert.equal(detail.body.transactions.length, 3);
  assert.equal(detail.body.customer.balance, 1150.5);

  // deleting an entry updates the balance
  const jamaId = detail.body.transactions.find((t) => t.type === 'jama').id;
  const del = await request(app).delete(`/api/transactions/${jamaId}`).expect(200);
  assert.equal(del.body.customer.balance, 1650.75);
});

test('list, search and summary', async () => {
  const a = (await addCustomer('रमेश कुमार', '9000000001')).body.customer.id;
  const b = (await addCustomer('Amit Verma', '9000000002')).body.customer.id;
  await addCustomer('Priya Singh', '9000000003');
  await request(app).post(`/api/customers/${a}/transactions`).send({ type: 'udhar', amount: '300' });
  await request(app).post(`/api/customers/${b}/transactions`).send({ type: 'udhar', amount: '1000' });
  await request(app).post(`/api/customers/${b}/transactions`).send({ type: 'jama', amount: '1200' });

  const all = await request(app).get('/api/customers').expect(200);
  assert.equal(all.body.customers.length, 3);
  assert.equal(all.body.customers[0].name, 'रमेश कुमार'); // highest balance first
  assert.equal(all.body.customers.find((c) => c.id === b).balance, -200);

  const s1 = await request(app).get('/api/customers').query({ search: 'amit' }).expect(200);
  assert.deepEqual(s1.body.customers.map((c) => c.name), ['Amit Verma']);
  const s2 = await request(app).get('/api/customers').query({ search: 'रमेश' }).expect(200);
  assert.equal(s2.body.customers.length, 1);
  const s3 = await request(app).get('/api/customers').query({ search: '0003' }).expect(200);
  assert.deepEqual(s3.body.customers.map((c) => c.name), ['Priya Singh']);
  const s4 = await request(app).get('/api/customers').query({ search: '.*(' }).expect(200);
  assert.equal(s4.body.customers.length, 0);

  const sum = await request(app).get('/api/summary').expect(200);
  assert.deepEqual(sum.body, { customers: 3, dueCustomers: 1, toCollect: 300, advance: 200 });
});

test('reminder text and links; API send explains when not configured', async () => {
  const id = (await addCustomer('रमेश', '9876543210')).body.customer.id;
  await request(app).post(`/api/customers/${id}/transactions`).send({ type: 'udhar', amount: '1500.5' });

  const r = await request(app).get(`/api/customers/${id}/reminder`).expect(200);
  assert.match(r.body.text, /₹1,500.50 बाक़ी है/);
  assert.ok(r.body.whatsappUrl.startsWith('https://wa.me/919876543210?text='));
  assert.ok(r.body.smsUrl.startsWith('sms:+919876543210?body='));

  const send = await request(app).post(`/api/customers/${id}/reminder/send`).expect(501);
  assert.equal(send.body.reason, 'WHATSAPP_NOT_CONFIGURED');

  await request(app).post(`/api/customers/${id}/reminder/logged`).expect(200);
  const d = await request(app).get(`/api/customers/${id}`);
  assert.ok(d.body.customer.lastReminderAt);
});

test('edit, delete and invalid ids', async () => {
  const id = (await addCustomer()).body.customer.id;
  const e = await request(app).patch(`/api/customers/${id}`).send({ name: 'रमेश जी' }).expect(200);
  assert.equal(e.body.customer.name, 'रमेश जी');
  await request(app).post(`/api/customers/${id}/transactions`).send({ type: 'udhar', amount: '10' });
  await request(app).delete(`/api/customers/${id}`).expect(200);
  await request(app).get(`/api/customers/${id}`).expect(404);
  assert.equal(await mongoose.model('Transaction').countDocuments(), 0);
  await request(app).get('/api/customers/not-an-id').expect(404);
  await request(app).delete('/api/transactions/xyz').expect(400);
  await request(app).get('/api/nothing').expect(404);
});

test('rejects NoSQL operator injection', async () => {
  await request(app).post('/api/customers').send({ name: { $gt: '' }, phone: '9876543210' }).expect(400);
  await request(app).get('/api/customers').query({ 'search[$ne]': 'x' }).expect(200);
});
