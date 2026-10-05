-- ============================================================
-- 2026-10-05 — Seguridad: datos de pasajeros solo para el staff
-- ============================================================
-- Aplicado en Supabase el 2026-10-05.
-- get_asientos_con_pasajero y buscar_por_ci son SECURITY DEFINER (saltean
-- la RLS de reservas.pasajeros) y no verificaban quién las llamaba: con la
-- anon key cualquiera podía obtener nombre y CI de todos los pasajeros.
-- Ahora exigen reservas.is_staff_or_admin(). Mismo resultado para el staff.
-- ============================================================

create or replace function reservas.get_asientos_con_pasajero(p_planta_id uuid)
returns table(id uuid, code text, fila smallint, letra text, estado reservas.estado_asiento, pasajero text, ci text)
language plpgsql
stable
security definer
set search_path to 'reservas', 'public'
as $function$
begin
  -- Devuelve nombre y CI: solo para el staff.
  if not reservas.is_staff_or_admin() then
    raise exception 'No autorizado';
  end if;

  return query
    select a.id, a.code, a.fila, a.letra, a.estado, p.pasajero, p.ci
    from reservas.asientos a
    left join reservas.pasajeros p on p.asiento_id = a.id
    where a.planta_id = p_planta_id
    order by a.fila;
end;
$function$;

create or replace function reservas.buscar_por_ci(p_viaje_id uuid, p_ci text)
returns table(code text, estado reservas.estado_asiento, pasajero text, ci text, planta_id uuid, planta_etiqueta text)
language plpgsql
stable
security definer
set search_path to 'reservas', 'public'
as $function$
begin
  -- Devuelve nombre y CI: solo para el staff.
  if not reservas.is_staff_or_admin() then
    raise exception 'No autorizado';
  end if;

  return query
    select a.code, a.estado, p.pasajero, p.ci, a.planta_id, pl.etiqueta
    from reservas.asientos a
    join reservas.plantas pl on pl.id = a.planta_id
    join reservas.pasajeros p on p.asiento_id = a.id
    where pl.viaje_id = p_viaje_id and p.ci = trim(p_ci);
end;
$function$;
