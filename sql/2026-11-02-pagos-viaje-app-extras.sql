-- ============================================================
-- 2026-11-02 — Pagos del viaje de la app: incluir servicios extra
-- ============================================================
-- Corrige reservas.pagos_viaje_app (ver 2026-11-01-enlace-viaje-app.sql):
--   total   = viaje_pasajeros.total_a_pagar + Σ servicio_extra_pasajeros.precio_venta_real
--   abonado = Σ public._saldo_neto_pagos(...) (misma cuenta que usa la app:
--             Pago − Devolución − Transferencia, neto por método de pago)
-- Por abonar = total − abonado (se calcula en la web).
-- Idempotente: se puede volver a correr.
-- ============================================================

create or replace function reservas.pagos_viaje_app(p_viaje uuid)
returns table (ci text, total numeric, abonado numeric)
language plpgsql stable security definer
set search_path = public, reservas
as $$
#variable_conflict use_column
declare
  v_app bigint;
begin
  if not reservas.is_staff_or_admin() then
    raise exception 'No autorizado';
  end if;

  select vw.app_viaje_id into v_app from reservas.viajes vw where vw.id = p_viaje;
  if v_app is null then
    return;
  end if;

  return query
    with vps as (
      select vp.id as vp_id,
             regexp_replace(coalesce(pa."Documento de Identidad", ''), '\D', '', 'g') as doc,
             coalesce(vp.total_a_pagar, 0) as base
      from public.viaje_pasajeros vp
      join public.pasajeros pa on pa.id = vp.pasajero_id
      where vp.viaje_id = v_app
    ),
    extras as (
      select s.viaje_pasajero_id as vp_id, sum(coalesce(s.precio_venta_real, 0)) as monto
      from public.servicio_extra_pasajeros s
      where s.viaje_pasajero_id in (select vps.vp_id from vps)
      group by 1
    ),
    pagado as (
      select n.viaje_pasajero_id as vp_id, sum(n.monto) as monto
      from public._saldo_neto_pagos((select array_agg(vps.vp_id) from vps)) n
      group by 1
    )
    select vps.doc,
           sum(vps.base + coalesce(e.monto, 0))::numeric,
           sum(coalesce(g.monto, 0))::numeric
    from vps
    left join extras e on e.vp_id = vps.vp_id
    left join pagado g on g.vp_id = vps.vp_id
    where vps.doc <> ''
    group by vps.doc;
end;
$$;

revoke all on function reservas.pagos_viaje_app(uuid) from public, anon;
grant execute on function reservas.pagos_viaje_app(uuid) to authenticated;
