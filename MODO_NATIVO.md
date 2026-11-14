# Modo Nativo (Capacitor + SQLite) — Estado de la migración

Guía de la arquitectura dual que permite que **el mismo frontend Next.js**
corra en dos mundos:

| Mundo | Motor de datos local | Build | Dónde |
|---|---|---|---|
| **Web / PWA** (Vercel) | Dexie → IndexedDB (como siempre) | `next build` | Comportamiento 100% intacto |
| **App nativa** (Android primero) | **SQLite de archivo** en el sandbox del dispositivo | `npm run build:nativo` + `npx cap sync android` | Sobrevive a "borrar datos del navegador", transacciones atómicas, listo para SQLCipher |

## Cómo funciona

1. **Build nativo** (`scripts/build-mobile.mjs`): aparta temporalmente las
   rutas web-only (`middleware.ts`, `app/posts/`, `app/catalogo/[slug]/`),
   lanza `next build` con `CAPACITOR_BUILD=1` (activa `output: "export"` en
   `next.config.mjs`) y las restaura al final. Resultado: `out/`.
2. **Sincronización**: `npx cap sync android` copia `out/` dentro del
   proyecto Android (`android/app/src/main/assets/public`).
3. **Motor dual** (`lib/local/db.ts` → `abrirDB()`): en nativo devuelve un
   `DBSQLite` (shim compatible con Dexie); en web, la clase `DBLocal` de
   siempre. **Los 11 repos no cambiaron su lógica** — solo el motor detrás.
4. **Shim SQLite** (`lib/local/sqlite/`):
   - `esquema.ts` — espejo de las stores de Dexie v1–v3 (22 tablas, mismos
     índices consultados, whitelisted: un campo no indexado lanza error como
     Dexie haría, nunca falla en silencio).
   - `driver.ts` — conexión al plugin `@capacitor-community/sqlite`
     (inicialización perezosa, migraciones con `PRAGMA user_version`,
     transacciones con begin/commit nativos).
   - `tablas.ts` — shim con la semántica exacta de Dexie usada por los
     repos: `where().equals()`, `orderBy()`, `get/put/add/update/delete`,
     `bulk*`, `++id` autoincremental, llave compuesta, `transaction("rw", …)`.
5. **Pre-warm**: `initDB()` (que corre al arranque y en cada alta de
   producto) valida el esquema SQLite temprano en nativo.

## Ganancias concretas vs. la PWA anterior

- El archivo `.sqlite` vive en el sandbox de la app: **"borrar datos de
  navegación" ya no existe** como riesgo (solo desinstalar/borrar datos de
  la app — por eso el backup automático sigue siendo requisito).
- **Transacciones reales**: el bug de `cobrarCarrito` (lotes y ledger fuera
  de la transacción Dexie) es imposible en nativo: todo el cobro es
  BEGIN/COMMIT atómico.
- Desactivado el service worker `sw.js` dentro del WebView (serviría assets
  viejos tras actualizar la app).
- Base para Fase 2: SQLCipher (cifrado AES-256) y backup cifrado único a
  Supabase Storage (el dump JSON por tablas ya no hará falta: la BD entera
  es UN archivo).

## Gancho de suscripción: Publicar catálogo online

Los tenants del plan local ($99/mes) publican su catálogo desde
Personalización → Catálogo → **"Publicar catálogo online"**
(`components/personalizacion/CardPublicarCatalogo.tsx`).

**Arquitectura (delta de datos + fotos a Cloudinary, NO HTML estático):**

1. **Motor delta** (`lib/local/repos/catalogo.ts`): construye el estado
   deseado (config pública `__config__` + un producto por fila, variaciones
   anidadas), lo compara por HASH determinista (djb2) contra el espejo
   guardado en la tabla local `catalogo_publicado` y solo sube filas
   nuevas/cambiadas; los productos eliminados/ocultos viajan como
   `data:null` (borrado en la nube). Si una foto no cambió (`foto_hash`
   intacto) se reutiliza la URL de Cloudinary ya publicada — la foto no se
   vuelve a subir.
2. **Transporte**: `POST /catalogo-publicado/foto` (dataURL→Blob, respuesta
   con la URL de Cloudinary en `catalogo_publicado/{tenant_id}`) y
   `POST /catalogo-publicado/delta`. Autenticación por **licencia de
   dispositivo** (Bearer del JWT HS256), NO sesión Supabase — fetch manual
   en `lib/api/catalogo.ts`.
3. **Backend**: tabla `catalogo_publicado` (migración 069, filas
   `clave/hash/data JSONB/orden` + RLS) en
   `database/catalogo_publicado.py`; el guard de licencia vive en
   `database/licencias.py::tenant_de_licencia`. El catálogo público se
   SIRVE por el endpoint de siempre (`GET /p/{slug}`):
   `database/catalogo.py::obtener_catalogo_publico` detecta el snapshot y
   ensambla la respuesta desde él (`_catalogo_desde_snapshot`) — Vercel
   dibuja desde datos, igual que los tenants de nube. El primer publish
   crea `catalogo_config` y deja `activo = TRUE`.
4. **Nunca público**: costo_promedio, costo_unitario, costo de lotes y
   costo_servicio se excluyen del payload (`filaProductoPublica`).

## Comandos

```bash
npm run build:nativo   # export estático (aparta/restaura rutas web-only)
npm run cap:sync       # build:nativo + npx cap sync android
npm run android:open   # abre Android Studio (requiere SDK instalado)
```

## Pendiente (Fase 2 en adelante)

- [x] **Publicar catálogo online** (delta + fotos a Cloudinary) — hecho,
  falta probarlo en vivo contra el backend desplegado.
- [ ] **Migración 069** por correr en la BD de producción (Supabase).
- [ ] **SQLCipher**: cifrar la BD (change-point: `createConnection` en
  `sqlite/driver.ts`, clave guardada con Secure Preferences).
- [ ] **Backup automático**: exportar el archivo `.sqlite` → Supabase
  Storage cifrado al conectar (equivalente al ⬜ de MODO_LOCAL.md).
- [ ] **Ruta de restauración probada**: borrar la BD y arrancar en frío en
  cada release (restaurar desde el backup de la nube).
- [ ] Probar en dispositivo real: APK debug (`android:open` → Run) —
  requiere Android Studio/SDK en la máquina del desarrollador.
- [ ] Ícono y splash screen de la app (`npx @capacitor/assets generate`).
- [ ] Consolidar las DOS implementaciones PEPS (`ventas.ts` ↔ `conteos.ts`)
  y el resto de contratos faltantes (clientes, mesas, conteos, stats).
- [ ] iOS: mismo shell cuando haya demanda (Xcode + App Store).
- [ ] Fotos como archivos en sandbox en vez de dataURL dentro del JSON
  (optimización: la BD crece menos).

## Notas de decisión

- El cast `DBSQLite as unknown as DBLocal` en `db.ts` es el ÚNICO punto de
  cruce entre motores: es el contrato de la frontera, revisado contra la
  auditoría de uso real de la API de Dexie (~130 llamadas catalogadas).
- Claves de tablas: autoinc → entero crudo en `clave` (afinidad INTEGER para
  que MAX() ordene numéricamente); texto/compuesta → JSON. Campos numéricos
  consultados (`n_ticket`, `orden`) usan afinidad REAL para que `ORDER BY`
  ordene por magnitud, no lexicográficamente.
- En nativo el respaldo manual JSON (`copia.ts`) sigue funcionando (lee
  `d.tables[].toArray()`, que el shim implementa).
