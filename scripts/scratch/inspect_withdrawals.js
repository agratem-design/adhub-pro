import pg from 'pg';

const client = new pg.Client({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.atqjaiebixuzomrfwilu',
  password: 'Zer4oBi57gZ',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

async function main() {
  await client.connect();
  console.log('Connected successfully to Postgres!');

  const { rows: withdrawals } = await client.query(`
    SELECT id, amount, date, receiver_name, sender_name, note, distributed_payment_id, created_at 
    FROM public.expenses_withdrawals 
    ORDER BY date DESC, id DESC;
  `);

  console.log(`Total withdrawal rows: ${withdrawals.length}`);
  let sumAll = 0;
  let sumLinked = 0;
  let sumManual = 0;

  for (const w of withdrawals) {
    const amt = Number(w.amount) || 0;
    sumAll += amt;
    if (w.distributed_payment_id) {
      sumLinked += amt;
    } else {
      sumManual += amt;
    }
  }

  console.log(`Total sum: ${sumAll.toLocaleString()} LYD (${sumAll})`);
  console.log(`Linked sum (${withdrawals.filter(w => w.distributed_payment_id).length} rows): ${sumLinked.toLocaleString()} LYD (${sumLinked})`);
  console.log(`Manual sum (${withdrawals.filter(w => !w.distributed_payment_id).length} rows): ${sumManual.toLocaleString()} LYD (${sumManual})`);

  console.log('\n--- ALL WITHDRAWALS ---');
  for (const w of withdrawals) {
    console.log(JSON.stringify({
      id: w.id,
      date: w.date ? w.date.toISOString().slice(0, 10) : null,
      amount: Number(w.amount),
      receiver_name: w.receiver_name,
      sender_name: w.sender_name,
      note: w.note,
      distributed_payment_id: w.distributed_payment_id,
      created_at: w.created_at
    }));
  }

  const { rows: closures } = await client.query(`SELECT * FROM public.period_closures;`);
  console.log('\n--- PERIOD CLOSURES ---', closures.length);
  if (closures.length > 0) {
    console.log(JSON.stringify(closures, null, 2));
  }

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
