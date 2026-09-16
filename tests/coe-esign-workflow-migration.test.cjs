'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260916_coe_esign_workflow.sql'), 'utf8')
const rollback = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'rollback', '20260916_coe_esign_workflow_safe_disable.sql'), 'utf8')

test('migration is additive and creates isolated COE e-signature data structures', () => {
  assert.match(sql, /create table if not exists public\.coe_authorized_signatories/i)
  assert.match(sql, /create table if not exists public\.coe_signature_requests/i)
  assert.match(sql, /create table if not exists public\.coe_signature_audit_log/i)
  assert.match(sql, /document_record_id uuid primary key references public\.company_document_records\(id\)/i)
  assert.match(sql, /references public\.company_document_records\(id\) on delete cascade/i)
  assert.doesNotMatch(sql, /drop table\s+public\.company_document_records/i)
  assert.doesNotMatch(sql, /truncate\s+/i)
})

test('workflow tables use RLS and authenticated SECURITY DEFINER RPCs', () => {
  assert.match(sql, /alter table public\.coe_authorized_signatories enable row level security/i)
  assert.match(sql, /alter table public\.coe_signature_requests enable row level security/i)
  assert.match(sql, /alter table public\.coe_signature_audit_log enable row level security/i)
  for (const fn of [
    'get_my_coe_signatory_profile',
    'list_active_coe_signatories',
    'list_coe_signatory_candidates',
    'set_coe_authorized_signatory',
    'set_my_coe_signature_profile',
    'request_coe_signature',
    'get_coe_signature_state',
    'list_my_coe_signature_inbox',
    'return_coe_signature_request',
    'approve_coe_signature_request',
    'invalidate_coe_signature_if_changed',
    'log_coe_signature_output',
    'coe_signature_storage_can_read',
    'coe_signature_storage_can_write'
  ]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`, 'i'))
  }
  assert.match(sql, /security definer/gi)
  assert.match(sql, /grant execute on function public\.request_coe_signature/i)
})

test('signature assets are private and immutable after approval', () => {
  assert.match(sql, /'coe-signatures'/)
  assert.match(sql, /false,\s*2097152,/s)
  assert.match(sql, /array\['image\/png','image\/jpeg','image\/webp'\]/i)
  assert.match(sql, /r\.state = 'pending'/)
  assert.match(sql, /r\.signed_signature_path = p_name/)
  assert.match(sql, /signed_signature_path text/)
  assert.match(sql, /documents\//)
})

test('content integrity and audit controls are present', () => {
  assert.match(sql, /document_hash text/)
  assert.match(sql, /document_hash ~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.match(sql, /COE SIGNATURE INVALIDATED AFTER CONTENT CHANGE/)
  assert.match(sql, /COE E-SIGNED AND APPROVED/)
  assert.match(sql, /SIGNED COE ' \|\| v_output \|\| ' OUTPUT/)
})

test('migration matches the verified Roma database schema names', () => {
  assert.match(sql, /au\.full_name/)
  assert.match(sql, /d\.document_no/)
  assert.match(sql, /d\.document_type/)
  assert.match(sql, /d\.document_date/)
  assert.doesNotMatch(sql, /au\.name/)
  assert.doesNotMatch(sql, /au\.username/)
  assert.doesNotMatch(sql, /d\.reference_no/)
  assert.doesNotMatch(sql, /d\.title/)
  assert.doesNotMatch(sql, /d\.record_date/)
})

test('audit trail is isolated from the legacy POS audit schema', () => {
  assert.match(sql, /insert into public\.coe_signature_audit_log/)
  assert.doesNotMatch(sql, /insert into public\.pos_admin_audit_log/)
})

test('rollback safely disables access without deleting signature evidence', () => {
  assert.match(rollback, /drop policy if exists coe_signatures_select/i)
  assert.match(rollback, /revoke execute on function public\.request_coe_signature/i)
  assert.doesNotMatch(rollback, /drop table/i)
  assert.doesNotMatch(rollback, /delete from storage\.objects/i)
})
