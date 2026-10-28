-- ============================================================
-- 2026-10-29 — TAHÝI: portada (hero) editable desde el panel
-- ============================================================
-- Panel › Inicio › TAHÝI. Todo vacío = se muestra el texto/ilustración
-- que ya tenía la página. Idempotente: se puede volver a correr.
-- ============================================================
alter table reservas.inicio_config
  add column if not exists tahyi_hero_imagen_url text,
  add column if not exists tahyi_hero_etiqueta text,
  add column if not exists tahyi_hero_sobretitulo text,
  add column if not exists tahyi_hero_titulo text,
  add column if not exists tahyi_hero_lema text,
  add column if not exists tahyi_hero_texto text;
