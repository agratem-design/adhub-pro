import pg from 'pg';

const client = new pg.Client({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.atqjaiebixuzomrfwilu',
  password: 'Zer4oBi57gZ',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  // 1. Inspect dist-1788342159789-kg2bn66un
  const { rows: pmts } = await client.query(`
    SELECT id, contract_number, amount, paid_at, customer_name, distributed_payment_id, entry_type, notes
    FROM customer_payments 
    WHERE distributed_payment_id = 'dist-1788342159789-kg2bn66un'
       OR notes ILIKE '%13155%'
  `);
  console.log('Payments for dist-1788342159789-kg2bn66un:', JSON.stringify(pmts, null, 2));

  // 2. Check all expenses_withdrawals and their matching customer_payments
  const { rows: withdrawals } = await client.query(`
    SELECT * FROM expenses_withdrawals ORDER BY id DESC
  `);
  console.log('\n--- Checking Withdrawals against Payments ---');
  for (const w of withdrawals) {
    if (w.distributed_payment_id) {
      const { rows: p } = await client.query(`
        SELECT id, customer_name, amount, contract_number, paid_at, entry_type 
        FROM customer_payments 
        WHERE distributed_payment_id = $1
      `, [w.distributed_payment_id]);
      console.log(`W_ID: ${w.id} | Amt: ${w.amount} | Date: ${w.date?.toISOString().slice(0,10)} | Created: ${w.created_at?.toISOString()} | Note: ${w.note}`);
      console.log(`   -> Linked to ${p.length} payment(s):`);
      for (const pay of p) {
        console.log(`      Payment ID: ${pay.id}, Customer: ${pay.customer_name}, Contract: ${pay.contract_number}, Amount: ${pay.amount}`);
      }
    } else {
      console.log(`W_ID: ${w.id} (MANUAL) | Amt: ${w.amount} | Date: ${w.date?.toISOString().slice(0,10)} | Created: ${w.created_at?.toISOString()} | Note: ${w.note} | Receiver: ${w.receiver_name} | Sender: ${w.sender_name}`);
    }
  }

  // 3. Check contract date range for contracts < 1086 vs >= 1086
  const { rows: contractStats } = await client.query(`
    SELECT 
      CASE WHEN CAST(NULLIF(regexp_replace("Contract_Number"::text, '[^0-9]', '', 'g'), '') AS INTEGER) < 1086 THEN 'before_1086' ELSE '1086_and_after' END as grp,
      count(*),
      min("Contract Date") as min_date,
      max("Contract Date") as max_date
    FROM "Contract"
    WHERE regexp_replace("Contract_Number"::text, '[^0-9]', '', 'g') <> ''
    GROUP BY 1
  `);
  console.log('\nContract groups:', JSON.stringify(contractStats, null, 2));

  await client.end();
}

main().catch(console.error);
