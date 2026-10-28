-- ============================================================
-- 2026-10-28 — TAHÝI: iniciativa social y comunitaria
-- ============================================================
-- Contenido de la página /tahyi, editable en Panel › Inicio:
--   tahyi_acciones → "Próximas acciones" (voluntariados y colectas)
--   tahyi_galeria  → "Galería de acciones" (fotos)
--   tahyi_aliados  → "Aliados" (logos)
--   inicio_config.tahyi_proposito_* → textos de "Nuestro propósito"
-- Cada sección se oculta sola si no tiene nada cargado.
-- Fotos y logos: mismo bucket público "inicio" (carpetas tahyi-*).
--
-- Lectura: pública (solo lo activo). Escritura: solo admin.
-- Idempotente: se puede volver a correr.
-- ============================================================

-- 1) Tablas ----------------------------------------------------------------
create table if not exists reservas.tahyi_acciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'voluntariado' check (tipo in ('voluntariado', 'colecta')),
  fecha date,                -- vacía = sin fecha fija; pasada la fecha, deja de mostrarse
  hora text,
  lugar text,
  detalle text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists reservas.tahyi_galeria (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  detalle text,              -- ej.: "San Bernardino · marzo 2026"
  imagen_url text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists reservas.tahyi_aliados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  link text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table reservas.inicio_config
  add column if not exists tahyi_proposito_titulo text,
  add column if not exists tahyi_proposito_texto text;

-- 2) Permisos y RLS ----------------------------------------------------------
grant select on reservas.tahyi_acciones, reservas.tahyi_galeria, reservas.tahyi_aliados to anon, authenticated;
grant insert, update, delete on reservas.tahyi_acciones, reservas.tahyi_galeria, reservas.tahyi_aliados to authenticated;

alter table reservas.tahyi_acciones enable row level security;
alter table reservas.tahyi_galeria  enable row level security;
alter table reservas.tahyi_aliados  enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['tahyi_acciones', 'tahyi_galeria', 'tahyi_aliados'] loop
    if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = t and policyname = t || ': lectura publica') then
      execute format('create policy %I on reservas.%I for select using (activo or reservas.is_staff_or_admin())',
                     t || ': lectura publica', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'reservas' and tablename = t and policyname = t || ': admin escribe') then
      execute format('create policy %I on reservas.%I for all using (reservas.current_role_is(''admin'')) with check (reservas.current_role_is(''admin''))',
                     t || ': admin escribe', t);
    end if;
  end loop;
end $$;
