-- ============================================================
-- 2026-10-05 — Tipo de viaje "evento" (fiesta o evento sin bus)
-- ============================================================
-- Aplicado en Supabase el 2026-10-05.
--   - viajes.tipo admite 'convencional', 'doble_piso' o 'evento'.
--   - crear_viaje: un evento se crea sin plantas ni asientos y con la
--     selección cerrada (activo = false).
--   - set_viaje_visibilidad: no permite habilitar la selección de un evento.
-- El frontend excluye los eventos de la lista de Selección de asientos y
-- los muestra en el inicio con la etiqueta "Evento".
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'reservas.viajes'::regclass and conname = 'viajes_tipo_check') then
    alter table reservas.viajes add constraint viajes_tipo_check check (tipo in ('convencional', 'doble_piso', 'evento'));
  end if;
end $$;

-- crear_viaje (versión con p_filas integer): rama nueva al principio.
--   if p_tipo = 'evento' then
--     insert into reservas.viajes (nombre, tipo, start_at, created_by, activo)
--     values (p_nombre, p_tipo, p_start_at, auth.uid(), false) returning id into v_viaje_id;
--     insert into reservas.movimientos(...) values ('crear_viaje', ...);
--     return v_viaje_id;
--   end if;
--   (el resto de la función no cambia)

-- set_viaje_visibilidad: chequeo nuevo antes del update.
--   if p_seleccion_habilitada and exists (select 1 from reservas.viajes
--      where id = p_viaje_id and tipo = 'evento') then
--     raise exception 'Los eventos no tienen selección de asientos';
--   end if;
