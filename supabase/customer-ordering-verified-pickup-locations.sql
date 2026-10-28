-- Production release data step. Run only after the customer-order foundation
-- migration and only after the four customer-facing addresses and map pins have
-- been reviewed for the production release. All other pickup names stay inactive.
begin;

insert into public.customer_pickup_locations
  (name, address, latitude, longitude, is_active)
values
  ('Dagupan City - Arellano St. (Novo)',
   'Arellano St., in front of Novo Department Store, Dagupan City, Pangasinan',
   16.051258, 120.341149, true),
  ('Dagupan City - Malued (Centrum Gas)',
   'Malued District, near Centrum Gas Station, Dagupan City, Pangasinan',
   16.024662, 120.336088, true),
  ('Dagupan City - Malued (St. Albert School)',
   'Malued District, Saint Albert the Great School entrance, in front of O-Save Malued, Dagupan City, Pangasinan',
   16.029718, 120.334974, true),
  ('Dagupan City - Perez Blvd. (PAMMA)',
   'Perez Boulevard, in front of PAMMA University, Dagupan City, Pangasinan',
   16.042102, 120.341878, true)
on conflict (name) do update
set address = excluded.address,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    is_active = excluded.is_active,
    updated_at = now();

do $$
begin
  if (select count(*) from public.customer_pickup_locations
      where is_active and name in (
        'Dagupan City - Arellano St. (Novo)',
        'Dagupan City - Malued (Centrum Gas)',
        'Dagupan City - Malued (St. Albert School)',
        'Dagupan City - Perez Blvd. (PAMMA)'
      )) <> 4 then
    raise exception 'Four approved customer pickup points were not activated';
  end if;
end;
$$;

commit;
