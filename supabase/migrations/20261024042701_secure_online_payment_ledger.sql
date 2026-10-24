-- The earlier app-wide policy allowed anonymous reads and writes to payment
-- records. Keep the existing owner, manager, and HR sales workflow available
-- through signed-in accounts while the ordering service uses service_role.
drop policy if exists "Allow app access to daily sales online payments"
  on public.daily_sales_online_payments;

revoke all on public.daily_sales_online_payments from public, anon, authenticated;
grant select, insert on public.daily_sales_online_payments to authenticated;

create policy "Authorized sales staff read online payments"
  on public.daily_sales_online_payments
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select public.business_control_has_role(array['owner','manager','hr']))
  );

create policy "Authorized sales staff record online payments"
  on public.daily_sales_online_payments
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and (select public.business_control_has_role(array['owner','manager','hr']))
  );
