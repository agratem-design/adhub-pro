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

  const { rows } = await client.query(`
    SELECT id, contract_number, customer_name, amount, paid_at, entry_type, distributed_payment_id, notes, created_at
    FROM customer_payments
    WHERE contract_number = '1275' OR customer_name ILIKE '%البحباح%'
    ORDER BY paid_at DESC, created_at DESC
  `);
  console.log(`Payments for El-Bahbah or contract 1275 (total: ${rows.length}):`);
  for (const r of rows) {
    console.log(`${r.paid_at?.toISOString().slice(0,10)} | Contract: ${r.contract_number} | Amt: ${r.amount} | Type: ${r.entry_type} | DistID: ${r.distributed_payment_id} | Created: ${r.created_at?.toISOString()}`);
  }

  // Contract 1275
  const { rows: c1275 } = await client.query(`
    SELECT "Contract_Number", "Customer Name", "Total", "Total Paid", operating_fee_rate, "Contract Date"
    FROM "Contract" WHERE "Contract_Number"::text = '1275'
  `);
  console.log('\nContract 1275:', c1275[0]);

  await client.end();
}

main().catch(console.error);
