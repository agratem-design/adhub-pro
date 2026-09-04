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

  const { rows: withdrawals } = await client.query(`
    SELECT w.*, 
           cp.contract_number, cp.customer_name, cp.amount as payment_amount, cp.paid_at as payment_paid_at
    FROM expenses_withdrawals w
    LEFT JOIN (
      SELECT distributed_payment_id, 
             string_agg(DISTINCT contract_number::text, ', ') as contract_number, 
             string_agg(DISTINCT customer_name, ', ') as customer_name, 
             sum(amount) as amount,
             min(paid_at) as paid_at
      FROM customer_payments
      WHERE distributed_payment_id IS NOT NULL
      GROUP BY distributed_payment_id
    ) cp ON cp.distributed_payment_id = w.distributed_payment_id
    ORDER BY w.date ASC, w.id ASC
  `);

  console.log(`Total count: ${withdrawals.length}`);
  console.log('-------------------------------------------------------------------------------------------------------------');
  console.log('#   | Date       | Amount    | Receiver                 | Note / Customer / Contract');
  console.log('-------------------------------------------------------------------------------------------------------------');
  
  let runningTotal = 0;
  for (let i = 0; i < withdrawals.length; i++) {
    const w = withdrawals[i];
    const amt = Number(w.amount);
    runningTotal += amt;
    const dateStr = w.date ? w.date.toISOString().slice(0, 10) : 'NO_DATE';
    const rec = (w.receiver_name || 'غير محدد').padEnd(24);
    let desc = '';
    if (w.distributed_payment_id) {
      desc = `[مرتبط بدفعة] زبون: ${w.customer_name || '—'} | عقد: ${w.contract_number || '—'} | دفعة: ${w.payment_amount} د.ل`;
    } else {
      desc = `[سحب يدوي] ${w.note || 'بدون ملاحظة'} (سجل بتاريخ: ${w.created_at?.toISOString().slice(0, 10)})`;
    }
    console.log(`${String(w.id).padEnd(3)} | ${dateStr} | ${amt.toLocaleString().padStart(9)} | ${rec} | ${desc}`);
  }
  console.log('-------------------------------------------------------------------------------------------------------------');
  console.log(`Total: ${runningTotal.toLocaleString()} LYD`);

  await client.end();
}

main().catch(console.error);
