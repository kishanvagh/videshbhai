require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection;
  console.log('CONNECTED');

  const users = await db.collection('users').find({}, { projection: { email: 1 } }).toArray();
  console.log('USERS:', JSON.stringify(users));

  for (const u of users) {
    const oid = u._id;
    const parties = await db.collection('parties').countDocuments({ user: oid });
    const sales = await db.collection('sales').countDocuments({ user: oid });
    const salesNotCancelled = await db.collection('sales').countDocuments({ user: oid, status: { $ne: 'cancelled' } });
    const payments = await db.collection('payments').countDocuments({ user: oid });
    const paymentsNotReversed = await db.collection('payments').countDocuments({ user: oid, isReversed: false });
    const exchanges = await db.collection('currencyexchanges').countDocuments({ user: oid });
    const exchangesNotReversed = await db.collection('currencyexchanges').countDocuments({ user: oid, isReversed: false });
    console.log(`USER ${u.email}: parties=${parties} | sales=${sales} (non-cancelled=${salesNotCancelled}) | payments=${payments} (non-rev=${paymentsNotReversed}) | exchanges=${exchanges} (non-rev=${exchangesNotReversed})`);

    const sampleSales = await db.collection('sales').find({ user: oid }, { projection: { invoiceNumber: 1, status: 1, foreignCurrency: 1, saleAmountINR: 1, saleAmountForeign: 1, saleDate: 1 } }).sort({ saleDate: -1 }).limit(3).toArray();
    console.log('  sample sales:', JSON.stringify(sampleSales));
  }

  await mongoose.disconnect();
  console.log('DONE');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });