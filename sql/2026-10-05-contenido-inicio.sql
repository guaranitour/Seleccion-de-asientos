-- ============================================================
-- 2026-10-05 — Contenido del inicio editable desde el panel
-- ============================================================
-- Tablas que reemplazan a js/inicio-contenido.js:
--   inicio_config    → una sola fila: portada, contacto, horarios, nosotros
--   inicio_bloques   → avisos (con vigencia) y preguntas frecuentes
--   inicio_equipo    → integrantes del equipo
--   inicio_destinos  → destinos con foto
--   viajes.destino_id → cada viaje puede tomar la foto de su destino
-- Fotos: bucket público "inicio" en Supabase Storage.
--
-- Lectura: pública (solo lo activo / vigente). Escritura: solo admin.
-- Idempotente: se puede volver a correr.
-- ============================================================

-- 1) Tablas ----------------------------------------------------------------
create table if not exists reservas.inicio_config (
  id smallint primary key default 1 check (id = 1),
  portada_titulo text,
  portada_texto text,
  portada_imagen_url text,
  whatsapp text,
  instagram text,
  facebook text,
  email text,
  direccion text,
  maps_url text,
  horarios jsonb not null default '[]'::jsonb,   -- [{ "dia": "...", "hora": "..." }]
  nosotros text,
  updated_at timestamptz not null default now()
);

create table if not exists reservas.inicio_bloques (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('aviso', 'faq')),
  titulo text not null,
  cuerpo text,
  estilo text not null default 'info' check (estilo in ('info', 'importante')),
  orden integer not null default 0,
  activo boolean not null default true,
  visible_desde timestamptz,
  visible_hasta timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists reservas.inicio_equipo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cargo text,
  descripcion text,
  foto_url text,
  whatsapp text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists reservas.inicio_destinos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  pais text,
  descripcion text,
  imagen_url text,
  etiquetas text[] not null default '{}',
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table reservas.viajes
  add column if not exists destino_id uuid references reservas.inicio_destinos(id) on delete set null;

-- 2) Permisos y RLS ----------------------------------------------------------
grant select on reservas.inicio_config, reservas.inicio_bloques,
                reservas.inicio_equipo, reservas.inicio_destinos to anon, authenticated;
grant insert, update, delete on reservas.inicio_config, reservas.inicio_bloques,
                reservas.inicio_equipo, reservas.inicio_destinos to authenticated;

alter table reservas.inicio_config   enable row level security;
alter table reservas.inicio_bloques  enable row level security;
alter table reservas.inicio_equipo   enable row level security;
alter table reservas.inicio_destinos enable row level security;

do $$
begin
  -- Lectura
  if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = 'inicio_config' and policyname = 'inicio_config: lectura publica') then
    create policy "inicio_config: lectura publica" on reservas.inicio_config for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = 'inicio_bloques' and policyname = 'inicio_bloques: lectura publica') then
    create policy "inicio_bloques: lectura publica" on reservas.inicio_bloques for select using (
      reservas.is_staff_or_admin()
      or (activo
          and (visible_desde is null or visible_desde <= now())
          and (visible_hasta is null or visible_hasta > now()))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = 'inicio_equipo' and policyname = 'inicio_equipo: lectura publica') then
    create policy "inicio_equipo: lectura publica" on reservas.inicio_equipo for select using (activo or reservas.is_staff_or_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = 'inicio_destinos' and policyname = 'inicio_destinos: lectura publica') then
    create policy "inicio_destinos: lectura publica" on reservas.inicio_destinos for select using (activo or reservas.is_staff_or_admin());
  end if;

  -- Escritura (solo admin)
  if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = 'inicio_config' and policyname = 'inicio_config: admin escribe') then
    create policy "inicio_config: admin escribe" on reservas.inicio_config for all
      using (reservas.current_role_is('admin')) with check (reservas.current_role_is('admin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = 'inicio_bloques' and policyname = 'inicio_bloques: admin escribe') then
    create policy "inicio_bloques: admin escribe" on reservas.inicio_bloques for all
      using (reservas.current_role_is('admin')) with check (reservas.current_role_is('admin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = 'inicio_equipo' and policyname = 'inicio_equipo: admin escribe') then
    create policy "inicio_equipo: admin escribe" on reservas.inicio_equipo for all
      using (reservas.current_role_is('admin')) with check (reservas.current_role_is('admin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = 'inicio_destinos' and policyname = 'inicio_destinos: admin escribe') then
    create policy "inicio_destinos: admin escribe" on reservas.inicio_destinos for all
      using (reservas.current_role_is('admin')) with check (reservas.current_role_is('admin'));
  end if;
end $$;

-- 3) Fotos: bucket público "inicio" -----------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inicio', 'inicio', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'inicio: admin lee') then
    create policy "inicio: admin lee" on storage.objects for select to authenticated
      using (bucket_id = 'inicio' and reservas.current_role_is('admin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'inicio: admin sube') then
    create policy "inicio: admin sube" on storage.objects for insert to authenticated
      with check (bucket_id = 'inicio' and reservas.current_role_is('admin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'inicio: admin actualiza') then
    create policy "inicio: admin actualiza" on storage.objects for update to authenticated
      using (bucket_id = 'inicio' and reservas.current_role_is('admin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'inicio: admin borra') then
    create policy "inicio: admin borra" on storage.objects for delete to authenticated
      using (bucket_id = 'inicio' and reservas.current_role_is('admin'));
  end if;
end $$;

-- 4) Contenido inicial (el mismo que tenía js/inicio-contenido.js) -------------
insert into reservas.inicio_config (id, portada_titulo, portada_texto)
values (1,
        'Viajá tranquilo, nosotros nos encargamos del resto',
        'Conocé nuestras salidas confirmadas y reservá tu lugar por WhatsApp.')
on conflict (id) do nothing;

insert into reservas.inicio_bloques (tipo, titulo, cuerpo, orden)
select v.tipo, v.titulo, v.cuerpo, v.orden
from (values
  ('faq', '¿Cómo reservo mi lugar?',
   'Escribinos por WhatsApp y te acompañamos a asegurar tu lugar con el pago de la seña.', 1),
  ('faq', '¿Cuándo elijo mi asiento?',
   'Una vez abonada la seña y aceptadas las Bases y Condiciones. Cuando habilitemos la selección te avisaremos para que elijas el lugar que prefieras.', 2),
  ('faq', '¿Dónde acepto las Bases y Condiciones?',
   'Desde el menú, en "Bases y condiciones". Ahí también cargás tu contacto de emergencia.', 3)
) as v(tipo, titulo, cuerpo, orden)
where not exists (select 1 from reservas.inicio_bloques where tipo = 'faq');

-- 5) 2026-10-05 (agregado): correo de cada integrante del equipo ----------------
alter table reservas.inicio_equipo add column if not exists email text;

-- 6) 2026-10-05 (agregado): TikTok en los datos de contacto ----------------------
alter table reservas.inicio_config add column if not exists tiktok text;

-- 7) 2026-10-05 (agregado): fecha y precio base de cada destino -----------------
alter table reservas.inicio_destinos
  add column if not exists fecha_texto text,
  add column if not exists precio_desde numeric(12,2),
  add column if not exists precio_moneda text not null default 'PYG',
  add column if not exists precio_nota text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'reservas.inicio_destinos'::regclass and conname = 'inicio_destinos_precio_check') then
    alter table reservas.inicio_destinos add constraint inicio_destinos_precio_check
      check ((precio_desde is null or precio_desde >= 0) and precio_moneda in ('PYG', 'USD', 'BRL', 'ARS'));
  end if;
end $$;
