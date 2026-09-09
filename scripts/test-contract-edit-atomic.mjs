// Isolated PostgreSQL tests. No network connection or production credentials are used.
// Install the test runtime with:
// npm install --prefix .tmp-contract-db --no-save --package-lock=false @electric-sql/pglite
import { PGlite } from '../.tmp-contract-db/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

const source = ts.createSourceFile('types.ts', fs.readFileSync('src/integrations/supabase/types.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const database = source.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === 'Database').type;
const property = (node, name) => node.members.find(m => m.name?.getText(source).replaceAll('"', '') === name)?.type;
const tables = property(property(database, 'public'), 'Tables');
const db = new PGlite();
try {
  await db.exec("CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '11111111-1111-1111-1111-111111111111'::uuid$$;");
  const names = ['Contract','billboards','paused_billboards','paused_billboard_replacements','shared_billboards','friend_billboard_rentals','activity_log',
    'installation_tasks','installation_task_items','print_tasks','print_task_items','cutout_tasks','cutout_task_items','removal_tasks','removal_task_items'];
  for (const name of names) {
    const row = property(property(tables, name), 'Row');
    assert(row, `Missing generated schema for ${name}`);
    // Start from the schema before this migration, even after types are regenerated.
    const addedColumns = name === 'Contract' ? ['edit_revision']
      : name === 'paused_billboards' ? ['price_snapshot', 'lifecycle_state', 'resumed_at'] : [];
    const definitions = row.members.filter(m => !addedColumns.includes(m.name.getText(source).replaceAll('"', ''))).map(m => {
      const field = m.name.getText(source).replaceAll('"', '');
      const type = m.type.getText(source);
      let sqlType = /\bnumber\b/.test(type) ? 'numeric' : /\bboolean\b/.test(type) ? 'boolean' : /Json|\[\]/.test(type) ? 'jsonb' : 'text';
      if (['id','task_id','user_id','paused_billboard_id','friend_company_id'].includes(field) && sqlType === 'text') sqlType = 'uuid';
      if (['pause_date','original_start_date','original_end_date'].includes(field)) sqlType = 'date';
      const defaultValue = field === 'id' && sqlType === 'uuid' ? ' DEFAULT gen_random_uuid() PRIMARY KEY' : '';
      return `"${field}" ${sqlType}${defaultValue}`;
    });
    await db.exec(`CREATE TABLE public."${name}" (${definitions.join(',')});`);
  }
  await db.exec('CREATE UNIQUE INDEX ON public.friend_billboard_rentals(contract_number,billboard_id);');
  await db.exec(fs.readFileSync('supabase/migrations/20260908010000_contract_edit_atomic.sql', 'utf8'));
  const price = { billboardId: '1', basePriceBeforeDiscount: 3000, finalPrice: 3000, printCost: 0, installationCost: 0, startDate: '2026-01-01', endDate: '2026-01-30' };
  await db.query(`INSERT INTO public."Contract"("Contract_Number","Customer Name","Contract Date","End Date",billboard_ids,billboard_prices,"Total","Total Rent","Total Paid") VALUES(1,'Test','2026-01-01','2026-01-30','1',$1,3000,3000,'0')`, [JSON.stringify([price])]);
  await db.exec(`INSERT INTO public.billboards("ID","Billboard_Name","Contract_Number","Status",is_partnership,capital,capital_remaining) VALUES(1,'Test',1,'مؤجرة',true,10000,9100);`);
  const updates = { 'Customer Name':'Test', 'Contract Date':'2026-01-01','End Date':'2026-01-30', Total:3000,'Total Rent':3000,
    billboard_ids:['1'], billboard_prices:JSON.stringify([price]), installments_data:[{amount:3000,dueDate:'2026-01-01'}], friend_rental_data:null };
  const save = revision => db.query('SELECT public.save_contract_edit_atomic(1,$1::jsonb,$2::bigint)', [JSON.stringify(updates),revision]);
  await save(0);
  await save(1);
  assert.equal((await db.query('SELECT capital_remaining::text value FROM public.billboards WHERE "ID"=1')).rows[0].value, '9100.00');
  await assert.rejects(() => save(0), /CONTRACT_VERSION_CONFLICT/);
  assert.equal(Number((await db.query('SELECT edit_revision FROM public."Contract" WHERE "Contract_Number"=1')).rows[0].edit_revision),2);
  const paused = (await db.query("SELECT public.pause_contract_billboard_atomic(1,1,'2026-01-16','test',NULL,2) result")).rows[0].result;
  assert.equal(paused.pauseRefund,1500);
  assert.equal(Number((await db.query('SELECT "Total" value FROM public."Contract" WHERE "Contract_Number"=1')).rows[0].value),1500);
  await assert.rejects(() => db.query("SELECT public.pause_contract_billboard_atomic(1,1,'2026-01-16','test')"), /BILLBOARD_NOT_IN_CONTRACT/);
  await db.exec(`INSERT INTO public.billboards("ID","Billboard_Name","Status") VALUES(2,'Replacement','متاح');`);
  await db.query("SELECT public.replace_paused_billboard_atomic($1::uuid,2,'2026-01-16','2026-01-30',1500)",[paused.pauseId]);
  assert.equal(Number((await db.query('SELECT "Total" value FROM public."Contract" WHERE "Contract_Number"=1')).rows[0].value),3000);
  await db.query("SELECT public.replace_paused_billboard_atomic($1::uuid,2,'2026-01-16','2026-01-30',1500)",[paused.pauseId]);
  assert.equal(Number((await db.query('SELECT "Total" value FROM public."Contract" WHERE "Contract_Number"=1')).rows[0].value),3000);
  await db.query('SELECT public.replace_paused_billboard_atomic($1::uuid,NULL,NULL,NULL,NULL)',[paused.pauseId]);
  assert.equal(Number((await db.query('SELECT "Total" value FROM public."Contract" WHERE "Contract_Number"=1')).rows[0].value),1500);
  await db.query('SELECT public.edit_paused_billboard_atomic($1::uuid,$2::jsonb)',[paused.pauseId,JSON.stringify({pause_date:'2026-01-11',manual_refund:null})]);
  assert.equal(Number((await db.query('SELECT "Total" value FROM public."Contract" WHERE "Contract_Number"=1')).rows[0].value),1000);
  await db.query('SELECT public.edit_paused_billboard_atomic($1::uuid,$2::jsonb)',[paused.pauseId,JSON.stringify({pause_date:'2026-01-16',manual_refund:null})]);
  await db.exec('UPDATE public.billboards SET "Contract_Number"=99 WHERE "ID"=1');
  await assert.rejects(() => db.query("SELECT public.resume_contract_billboard_atomic($1::uuid,'2026-01-20')",[paused.pauseId]), /BILLBOARD_ALREADY_BOOKED/);
  await db.exec('UPDATE public.billboards SET "Contract_Number"=NULL WHERE "ID"=1');
  const resumed=(await db.query("SELECT public.resume_contract_billboard_atomic($1::uuid,'2026-01-20') result",[paused.pauseId])).rows[0].result;
  assert.equal(resumed.amount,1100);
  assert.equal(Number((await db.query('SELECT "Total" value FROM public."Contract" WHERE "Contract_Number"=1')).rows[0].value),2600);
  assert.equal((await db.query('SELECT lifecycle_state FROM public.paused_billboards WHERE id=$1',[paused.pauseId])).rows[0].lifecycle_state,'resumed');
  // Fail late in the transaction: neither prices, revision nor board links may leak.
  await db.exec(`INSERT INTO public."Contract"("Contract_Number",billboard_ids,billboard_prices,"Total","Total Paid") VALUES(3,'','[]',0,'0');
    INSERT INTO public.print_tasks(id,contract_id,status) VALUES('22222222-2222-2222-2222-222222222222',3,'pending');
    CREATE FUNCTION reject_test_log() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.contract_number=3 THEN RAISE EXCEPTION 'TEST_ROLLBACK'; END IF; RETURN NEW; END$$;
    CREATE TRIGGER reject_test_log BEFORE INSERT ON public.activity_log FOR EACH ROW EXECUTE FUNCTION reject_test_log();`);
  const addition={...updates,billboard_ids:['2'],billboard_prices:JSON.stringify([{...price,billboardId:'2',startDate:'2026-01-03',endDate:'2026-01-25'}])};
  const add=()=>db.query('SELECT public.save_contract_edit_atomic(3,$1::jsonb,0)',[JSON.stringify(addition)]);
  await assert.rejects(add,/TEST_ROLLBACK/);
  assert.equal(Number((await db.query('SELECT edit_revision FROM public."Contract" WHERE "Contract_Number"=3')).rows[0].edit_revision),0);
  assert.equal((await db.query('SELECT "Contract_Number" FROM public.billboards WHERE "ID"=2')).rows[0].Contract_Number,null);
  assert.equal((await db.query("SELECT * FROM public.print_task_items WHERE task_id='22222222-2222-2222-2222-222222222222'")).rows.length,0);
  await db.exec('DROP TRIGGER reject_test_log ON public.activity_log');
  await add();
  assert.equal((await db.query('SELECT "Rent_Start_Date" FROM public.billboards WHERE "ID"=2')).rows[0].Rent_Start_Date,'2026-01-03');
  assert.equal((await db.query("SELECT * FROM public.print_task_items WHERE task_id='22222222-2222-2222-2222-222222222222'")).rows.length,1);
  console.log('PostgreSQL checks passed: repeated save, capital delta, stale revision, pause, duplicate pause, replacement create/repeat/remove, pause edit, occupied resume, historical resume.');
} catch (error) { console.error(error.message, error.where || "", error.internalQuery || ""); process.exitCode=1; } finally { await db.close(); }
