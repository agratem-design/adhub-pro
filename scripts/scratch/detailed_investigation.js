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

  // 1. Inspect dist-1788342159789-kg2bn66un details
  console.log('=== 1. DETAIL OF 13,155 WITHDRAWAL (id: 68) ===');
  const { rows: w68 } = await client.query(`SELECT * FROM expenses_withdrawals WHERE id = 68`);
  console.log('Withdrawal 68:', w68[0]);

  const { rows: p68 } = await client.query(`
    SELECT * FROM customer_payments WHERE distributed_payment_id = 'dist-1788342159789-kg2bn66un'
  `);
  console.log('Payment rows with this dist id:', p68);

  const { rows: exp68 } = await client.query(`
    SELECT * FROM expense_payments WHERE distributed_payment_id = 'dist-1788342159789-kg2bn66un'
  `);
  console.log('Expense payments paid from this dist id:', exp68);

  const { rows: adv68 } = await client.query(`
    SELECT * FROM employee_advances WHERE distributed_payment_id = 'dist-1788342159789-kg2bn66un'
  `);
  console.log('Employee advances from this dist id:', adv68);

  const { rows: team68 } = await client.query(`
    SELECT * FROM installation_team_accounts WHERE distributed_payment_id = 'dist-1788342159789-kg2bn66un'
  `);
  console.log('Team accounts from this dist id:', team68);

  // 2. Breakdown of all 25 withdrawals by contract category
  console.log('\n=== 2. BREAKDOWN OF ALL 25 WITHDRAWALS ===');
  const { rows: allW } = await client.query(`
    SELECT w.id, w.amount, w.date, w.receiver_name, w.sender_name, w.note, w.distributed_payment_id,
           cp.contract_number, cp.customer_name, cp.amount as payment_amount
    FROM expenses_withdrawals w
    LEFT JOIN (
      SELECT distributed_payment_id, string_agg(DISTINCT contract_number::text, ', ') as contract_number, string_agg(DISTINCT customer_name, ', ') as customer_name, sum(amount) as amount
      FROM customer_payments
      WHERE distributed_payment_id IS NOT NULL
      GROUP BY distributed_payment_id
    ) cp ON cp.distributed_payment_id = w.distributed_payment_id
    ORDER BY w.id DESC
  `);
  
  let totalAll = 0;
  let totalUnder1086 = 0;
  let total1086AndAbove = 0;
  let totalNullContract = 0;
  let totalManual = 0;

  for (const r of allW) {
    const amt = Number(r.amount);
    totalAll += amt;
    const cNum = r.contract_number ? parseInt(r.contract_number, 10) : null;
    if (!r.distributed_payment_id) {
      totalManual += amt;
      console.log(`[MANUAL] ID: ${r.id} | ${amt} LYD | Date: ${r.date?.toISOString().slice(0,10)} | Receiver: ${r.receiver_name}`);
    } else if (cNum === null || isNaN(cNum)) {
      totalNullContract += amt;
      console.log(`[NULL CONTRACT] ID: ${r.id} | ${amt} LYD | Cust: ${r.customer_name} | DistID: ${r.distributed_payment_id}`);
    } else if (cNum < 1086) {
      totalUnder1086 += amt;
      console.log(`[< 1086] ID: ${r.id} | ${amt} LYD | Contract: ${r.contract_number} | Cust: ${r.customer_name}`);
    } else {
      total1086AndAbove += amt;
      console.log(`[>= 1086] ID: ${r.id} | ${amt} LYD | Contract: ${r.contract_number} | Cust: ${r.customer_name}`);
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Total all withdrawals: ${totalAll}`);
  console.log(`Contracts >= 1086: ${total1086AndAbove}`);
  console.log(`Contracts < 1086: ${totalUnder1086}`);
  console.log(`Null contract (distributed): ${totalNullContract}`);
  console.log(`Manual (no payment link): ${totalManual}`);

  // 3. Inspect Closure 5 and its contracts
  console.log('\n=== 3. CLOSURE 5 DETAILS ===');
  const { rows: closureRows } = await client.query(`
    SELECT * FROM period_closures WHERE id = 5
  `);
  console.log('Closure 5:', closureRows[0]);

  await client.end();
}

main().catch(console.error);
