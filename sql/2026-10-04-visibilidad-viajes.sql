-- ============================================================
-- 2026-10-04 — Visibilidad de viajes: dos interruptores
-- ============================================================
-- Cada viaje pasa a tener dos interruptores independientes:
--
--   publicado_inicio  (NUEVO)  → aparece en "Próximos viajes" del inicio.
--   activo            (EXISTE) → selección de asientos habilitada: aparece
--                                en la lista de Reservas y se puede abrir
--                                el croquis.
--
-- Archivado = los dos apagados. Se mantiene el nombre "activo" para no
-- romper Api.getViajes(), el router ni las políticas existentes.
--
-- Correr una sola vez en el SQL Editor de Supabase. Es idempotente.
-- ============================================================

-- 1) Columna nueva -------------------------------------------------------
alter table reservas.viajes
  add column if not exists publicado_inicio boolean not null default false;

-- 2) Lectura pública -----------------------------------------------------
-- Antes: solo viajes con selección habilitada. Ahora también los
-- publicados en el inicio (con la selección todavía cerrada).
drop policy if exists "viajes: lectura publica" on reservas.viajes;
create policy "viajes: lectura publica" on reservas.viajes
  for select using (activo = true or publicado_inicio = true);

-- 3) RPC para cambiar los dos interruptores de una vez ----------------------
-- Pasar null en un parámetro lo deja como está.
create or replace function reservas.set_viaje_visibilidad(
  p_viaje_id uuid,
  p_publicado_inicio boolean default null,
  p_seleccion_habilitada boolean default null
)
returns void
language plpgsql
security definer
set search_path to 'reservas', 'public'
as $function$
begin
  if not reservas.current_role_is('admin') then
    raise exception 'No autorizado';
  end if;

  update reservas.viajes
     set publicado_inicio = coalesce(p_publicado_inicio, publicado_inicio),
         activo           = coalesce(p_seleccion_habilitada, activo)
   where id = p_viaje_id;

  if not found then
    raise exception 'Viaje no encontrado';
  end if;

  insert into reservas.movimientos(accion, detalle, performed_by)
  values ('set_viaje_visibilidad',
          jsonb_build_object('viaje_id', p_viaje_id,
                             'publicado_inicio', p_publicado_inicio,
                             'seleccion_habilitada', p_seleccion_habilitada),
          auth.uid());
end;
$function$;

revoke all on function reservas.set_viaje_visibilidad(uuid, boolean, boolean) from public, anon;
grant execute on function reservas.set_viaje_visibilidad(uuid, boolean, boolean) to authenticated;

-- 4) reservar_asientos: respetar la selección cerrada ------------------------
-- Hasta ahora el RPC no miraba si el viaje estaba activo. Con viajes
-- publicados pero con la selección cerrada, alguien podría reservar
-- llamando al RPC directo. Se agrega el chequeo; el staff sigue pudiendo.
create or replace function reservas.reservar_asientos(p_planta_id uuid, p_pares jsonb)
returns void
language plpgsql
security definer
set search_path to 'reservas', 'public'
as $function$
declare
  item jsonb;
  v_code text;
  v_estado reservas.estado_asiento;
  v_asiento_id uuid;
  v_activo boolean;
begin
  select v.activo into v_activo
    from reservas.plantas p
    join reservas.viajes v on v.id = p.viaje_id
   where p.id = p_planta_id;

  if v_activo is null then
    raise exception 'Planta no encontrada';
  end if;
  if not v_activo and not reservas.is_staff_or_admin() then
    raise exception 'La selección de asientos de este viaje todavía no está habilitada';
  end if;

  for item in select * from jsonb_array_elements(p_pares) loop
    v_code := item->>'code';
    select id, estado into v_asiento_id, v_estado
      from reservas.asientos
     where planta_id = p_planta_id and code = v_code
       for update;

    if v_estado is null then
      raise exception 'Asiento % no existe', v_code;
    end if;
    if v_estado <> 'libre' then
      raise exception 'Asiento % ya no está libre', v_code;
    end if;
  end loop;

  for item in select * from jsonb_array_elements(p_pares) loop
    update reservas.asientos
       set estado = 'ocupado', updated_at = now()
     where planta_id = p_planta_id and code = item->>'code'
     returning id into v_asiento_id;

    insert into reservas.pasajeros (asiento_id, pasajero, ci)
    values (v_asiento_id, item->>'pasajero', item->>'ci')
    on conflict (asiento_id) do update
      set pasajero = excluded.pasajero, ci = excluded.ci, updated_at = now();

    insert into reservas.movimientos(asiento_id, accion, detalle, performed_by)
    values (v_asiento_id, 'reservar', item, auth.uid());
  end loop;
end;
$function$;
