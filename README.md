# Reservas — versión limpia con Supabase (Fase 1: flujo público)

Reescritura del prototipo original (`guaranitour/reservas`, backend AppScript/Sheets)
usando Supabase como backend. Vive en el **mismo proyecto Supabase de Guarani Tour**,
en el schema `reservas` (separado de `public`/`guarani_tour`).

## Alcance de esta fase

✅ Incluido:
- Elegir viaje (con cuenta regresiva)
- Elegir planta (buses de doble piso)
- Croquis de asientos, selección múltiple
- Reserva pública (formulario + confirmación + confeti)
- "Mirá tu asiento" (búsqueda por CI, todas las plantas)
- Sincronización en tiempo real (Supabase Realtime) — si alguien reserva
  un asiento mientras otra persona lo está mirando, se refleja al instante

❌ No incluido (próxima fase):
- Login staff / admin (Google OAuth)
- Panel de control interno (mover, liberar, ver ocupación)
- Editor de estructura de asientos (agregar/quitar filas, habilitar/inhabilitar)
- Crear viaje desde la UI (por ahora se carga por SQL, ver abajo)
- Exportar PDF

## Setup

### 1. Base de datos

Corré `schema-reservas-update.sql` (o el `schema-reservas.sql` original si es la
primera vez) en el SQL Editor de tu proyecto Supabase. Ambos scripts están en la
raíz del proyecto de Guarani Tour — usá el que ya te compartí antes.

Confirmá que:
- El schema `reservas` existe con las tablas `viajes`, `plantas`, `asientos`
- Realtime está habilitado en `reservas.asientos`
- La política `"asientos: lectura publica"` permite SELECT anónimo

### 2. Credenciales

En `js/supabase-client.js`, reemplazá:

```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-KEY';
```

Usá el mismo proyecto/URL que ya tenés configurado en Guarani Tour app. La
`anon key` es pública y segura de exponer en el frontend — el control de acceso
real lo hacen las políticas RLS del schema `reservas`.

### 3. Cargar un viaje de prueba

Como el módulo de creación de viajes (staff) todavía no existe, por ahora se
carga por SQL. Ejemplo — viaje convencional con 10 filas:

```sql
-- Viaje
insert into reservas.viajes (nombre, tipo, start_at)
values ('Encarnación 24/02', 'convencional', '2026-02-24 22:00:00-03')
returning id;
-- copiá el id que devuelve, lo usás abajo

-- Planta única
insert into reservas.plantas (viaje_id, etiqueta, orden)
values ('<ID_DEL_VIAJE>', 'Asientos', 0)
returning id;
-- copiá el id de la planta

-- Asientos (10 filas x 4 columnas = 40 asientos, todos libres)
insert into reservas.asientos (planta_id, code, fila, letra)
select '<ID_DE_LA_PLANTA>', row_num || letra, row_num, letra
from generate_series(1, 10) as row_num
cross join unnest(array['A','B','C','D']) as letra;
```

Para un viaje de **doble piso**, repetí el bloque de plantas dos veces con
etiquetas `'Planta baja'` y `'Planta alta'`, cada una con su propio set de
asientos.

### 4. Logo

En `js/main.js`, función `_loadHeroLogo()`, reemplazá `logo.png` por la URL
real (podés subirlo a Supabase Storage o dejarlo como archivo estático en el
repo, igual que en Guarani Tour).

### 5. Favicon / manifest

Copiá `favicon.ico`, `icon-192.png` y `manifest.json` del repo original — no
cambian con la migración de backend.

## Estructura del proyecto

```
index.html
css/
  base.css       — variables, reset, header, botones, formularios
  home.css       — elegir viaje, elegir planta, menú principal
  croquis.css    — grilla de asientos, leyenda
  reserve.css    — formulario de reserva y confirmación (con confeti)
  find.css       — "Mirá tu asiento"
js/
  supabase-client.js  — init del cliente (credenciales acá)
  state.js            — estado global (AppState)
  api.js              — todas las queries/RPCs a Supabase
  ui-helpers.js        — toast, loading, showView, helpers varios
  router.js            — router por hash (#/Inicio, #/Viaje/...)
  view-choose.js        — elegir viaje / elegir planta
  seats-grid.js          — render del croquis + realtime
  view-select.js          — pantalla de selección de asientos
  view-reserve.js          — formulario + confirmación + confeti
  view-find.js              — búsqueda por CI
  main.js                    — bootstrap, listeners globales
```

Cada archivo tiene una responsabilidad clara — no hay "parches" tipo
`*-redesign.js` que interceptan funciones de otro archivo, como en el
prototipo original. Todo está fusionado directamente donde corresponde.

## Notas de diseño

- **Atomicidad de reservas**: la función `reservar_asientos` en Postgres usa
  `for update` para bloquear los asientos antes de confirmarlos, evitando que
  dos personas reserven el mismo asiento al mismo tiempo (condición de carrera
  que el prototipo original con Sheets no prevenía bien).
- **Realtime por planta**: cada suscripción está filtrada por `planta_id`, así
  que un usuario mirando el bus 1 no recibe ruido de cambios en el bus 2.
- **Sin caché en localStorage**: el prototipo viejo cacheaba viajes/asientos en
  localStorage con TTL manual. Con Realtime ya no hace falta — los datos están
  siempre al día sin necesidad de refrescar la página.
