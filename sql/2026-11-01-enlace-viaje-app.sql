-- ============================================================
-- 2026-11-01 — Enlace de un viaje de la web con un viaje de la app
-- ============================================================
-- reservas.viajes.app_viaje_id → public.viajes.id (Guarani Tour App).
-- Con ese enlace, la lista de pasajeros puede completar "Abonado" y
-- "Por abonar" cruzando por CI con los pagos de la app.
--
-- Las funciones son SECURITY DEFINER porque los permisos de lectura de
-- la app (has_permission) son otros que los de esta web; acá se exige
-- reservas.is_staff_or_admin() y solo devuelven lo necesario.
--   Abonado = Pago − Devolución − Transferencia (transferencia = plata
--   que salió hacia otro pasajero; su contraparte entra como "Pago").
-- Idempotente: se puede volver a correr.
-- ============================================================

alter table reservas.viajes
  add column if not exists app_viaje_id bigint;

-- Viajes activos de la app, para el selector del Panel.
create or replace function reservas.viajes_app_activos()
returns table (id bigint, nombre text, fecha_salida date)
language plpgsql stable security definer
set search_path = public, reservas
as $$
begin
  if not reservas.is_staff_or_admin() then
    raise exception 'No autorizado';
  end if;
  return query
    select v.id, v.nombre, v.fecha_salida
    from public.viajes v
    where v.estado = 'activo'
    order by v.fecha_salida nulls last, v.nombre;
end;
$$;

-- Total a pagar y abonado por CI (solo dígitos) del viaje de la app enlazado.
create or replace function reservas.pagos_viaje_app(p_viaje uuid)
returns table (ci text, total numeric, abonado numeric)
language plpgsql stable security definer
set search_path = public, reservas
as $$
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
    select
      regexp_replace(pa."Documento de Identidad", '\D', '', 'g') as ci,
      sum(coalesce(vp.total_a_pagar, 0))::numeric as total,
      sum(coalesce((
        select sum(case pg.tipo
                     when 'Pago' then pg.monto
                     when 'Devolución' then -pg.monto
                     when 'Transferencia' then -pg.monto
                     else 0
                   end)
        from public.pagos pg
        where pg.viaje_pasajero_id = vp.id
      ), 0))::numeric as abonado
    from public.viaje_pasajeros vp
    join public.pasajeros pa on pa.id = vp.pasajero_id
    where vp.viaje_id = v_app
      and regexp_replace(coalesce(pa."Documento de Identidad", ''), '\D', '', 'g') <> ''
    group by 1;
end;
$$;

revoke all on function reservas.viajes_app_activos() from public, anon;
revoke all on function reservas.pagos_viaje_app(uuid) from public, anon;
grant execute on function reservas.viajes_app_activos() to authenticated;
grant execute on function reservas.pagos_viaje_app(uuid) to authenticated;
