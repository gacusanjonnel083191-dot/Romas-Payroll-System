const assert=require('node:assert/strict');
const fs=require('node:fs');
// Use the existing isolated-database test pattern; no application dependency is added.
// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.cjs node tests/document-draft-rls.cjs
const {PGlite}=require(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 const repo=require('node:path').resolve(__dirname,'..');
 const old=fs.readFileSync(repo+'/supabase/migrations/20260923140640_secure_payslip_access.sql','utf8');
 const helper=fs.readFileSync(repo+'/supabase/migrations/20260901090000_secure_cash_advance_rpc_foundation.sql','utf8');
 const helperSql=helper.slice(helper.indexOf('create or replace function private.cash_advance_admin_has_role'),helper.indexOf('create or replace function public.admin_set_employee_pin'));
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;
 create table public.admin_users(auth_user_id uuid,full_name text,role text,extra_roles text,is_active boolean);
 create table public.company_document_records(id integer generated always as identity primary key,document_no text unique,form_key text,status text default 'draft',created_by text,details text,owner_approved_by text,owner_approved_at timestamptz);
 alter table public.admin_users enable row level security;
 create policy own_profile on public.admin_users for select to authenticated using(auth_user_id=auth.uid() and is_active);
 grant select on public.admin_users to authenticated;
 grant select,insert,update,delete on public.company_document_records to authenticated;
 grant usage on sequence public.company_document_records_id_seq to authenticated;
 insert into admin_users values
 ('00000000-0000-0000-0000-000000000001','Supervisor A','supervisor','',true),
 ('00000000-0000-0000-0000-000000000002','Owner A','owner','',true),
 ('00000000-0000-0000-0000-000000000003','Disabled A','supervisor','',false),
 ('00000000-0000-0000-0000-000000000004','Payroll A','payroll','',true),
 ('00000000-0000-0000-0000-000000000005','Employee A','employee','',true);`);
 await db.exec(helperSql);
 await db.exec(old.slice(old.indexOf('alter table public.company_document_records enable'),old.indexOf("notify pgrst")));
 async function as(id,sql){return db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-${String(id).padStart(12,'0')}',true); ${sql}; commit;`)}
 async function denied(id,sql){try{await as(id,sql); assert.fail('Expected permission failure')}catch(e){await db.exec('rollback');assert.match(e.message,/row-level security|permission denied/i)}}
 const ins=(no,key,who='Supervisor A',extras='')=>`insert into company_document_records(document_no,form_key,created_by${extras?',owner_approved_by':''}) values('${no}','${key}','${who}'${extras?",'Owner A'":''}) returning *`;
 await denied(1,ins('BEFORE-CHARGE','FIN-CHARGE-SLIP'));
 await as(1,ins('BEFORE-NTE','DISC-NTE'));
 console.log('PASS: reproduced Charge Slip RLS failure; NTE saved before fix');
 const migration=fs.readFileSync(repo+'/supabase/migrations/20261001095008_supervisor_charge_drafts.sql','utf8');
 await db.exec(migration); await db.exec(migration);
 console.log('PASS: migration is idempotent');
 const saved=await as(1,ins('AFTER-CHARGE','FIN-CHARGE-SLIP'));
 assert.equal(saved.at(-2).rows[0].status,'draft');
 const changed=await as(1,"update company_document_records set details='Updated draft' where document_no='AFTER-CHARGE' returning details");
 assert.equal(changed.at(-2).rows[0].details,'Updated draft');
 const refreshed=await as(1,"select details from company_document_records where document_no='AFTER-CHARGE'");
 assert.equal(refreshed.at(-2).rows[0].details,'Updated draft');
 console.log('PASS: save/return row, update, reload own Charge Slip draft');
 await as(1,ins('AFTER-NTE','DISC-NTE'));
 for(const key of ['HR-COE','PAY-DEDUCTION-AUTH']) await denied(1,ins('DENIED-'+key,key));
 await denied(1,ins('DENIED-SPOOF','FIN-CHARGE-SLIP','Owner A'));
 await denied(1,ins('DENIED-APPROVAL','FIN-CHARGE-SLIP','Supervisor A','approval'));
 await denied(1,"update company_document_records set status='served' where document_no='AFTER-CHARGE'");
 await denied(1,"update company_document_records set owner_approved_by='Owner A' where document_no='AFTER-CHARGE'");
 await denied(1,"update company_document_records set created_by='Owner A' where document_no='AFTER-CHARGE'");
 await denied(3,ins('DENIED-DISABLED','FIN-CHARGE-SLIP','Disabled A'));
 await denied(5,ins('DENIED-EMPLOYEE','FIN-CHARGE-SLIP','Employee A'));
 await as(2,ins('OWNER-CHARGE','FIN-CHARGE-SLIP','Owner A'));
 const hidden=await as(1,"select * from company_document_records where document_no='OWNER-CHARGE'");
 assert.equal(hidden.at(-2).rows.length,0);
 const otherUpdate=await as(1,"update company_document_records set details='not allowed' where document_no='OWNER-CHARGE' returning *");
 assert.equal(otherUpdate.at(-2).rows.length,0);
 for(const key of ['HR-COE','PAY-DEDUCTION-AUTH','FIN-CHARGE-SLIP']) await as(4,ins('PAYROLL-'+key,key,'Payroll A'));
 await db.exec("begin; set local role anon;");
 try{await db.exec("select * from company_document_records");assert.fail('anon read should fail')}catch(e){assert.match(e.message,/permission denied/)}finally{await db.exec('rollback')}
 console.log('PASS: payroll/COE, spoofing, approvals, served records, inactive/nonstaff/anon and other drafts stay protected; Owner/Payroll retained');
 await db.exec(`drop policy company_documents_supervisor_charge_draft_read on company_document_records;
 drop policy company_documents_supervisor_charge_draft_insert on company_document_records;
 drop policy company_documents_supervisor_charge_draft_update on company_document_records;`);
 await denied(1,ins('ROLLBACK-CHARGE','FIN-CHARGE-SLIP'));
 await as(1,ins('ROLLBACK-NTE','DISC-NTE'));
 console.log('PASS: rollback restores original restrictions without affecting NTE or saved rows');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
