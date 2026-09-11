# Nezzura Frontend

Frontend del sistema de gestion de inventarios y punto de venta Nezzura. Es una aplicacion Next.js (App Router) orientada a negocios que necesitan administrar inventario, ventas, mesas, gastos, clientes y un catalogo publico personalizable.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- TanStack Query para peticiones y cache del lado cliente
- Supabase (@supabase/ssr) para autenticacion y datos del tenant
- Tailwind CSS para estilos globales y CSS custom properties para temas
- @react-three/fiber para el efecto de particulas del hero
- PWA basica (manifest + service worker) e imagenes Open Graph dinamicas

## Requisitos

- Node.js 18 o superior
- Un backend de Nezzura corriendo (repositorio nezzura-backend)
- Credenciales de un proyecto de Supabase

## Configuracion

Crea un archivo `.env.local` en la raiz con estas variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave anon de supabase>
NEXT_PUBLIC_API_URL=<url del backend, por defecto http://127.0.0.1:8000>
```

Opcional:

```env
NEXT_PUBLIC_SITE_URL=https://<tu-dominio>   # para URLs absolutas en metadata y OG image
```

`NEXT_PUBLIC_API_URL` es la unica URL de uso general con default local; `NEXT_PUBLIC_SITE_URL` solo mejoran la generacion de metadatos.

## Ejecucion

```bash
npm install
npm run dev
```

La aplicacion queda disponible en `http://localhost:3000`.

Para build de produccion:

```bash
npm run build
npm start
```

## Estructura

```
src/
  app/           Rutas de App Router (login, inventario, POS, gastos, estadisticas, personalizacion, catalogo publico [slug])
  components/    Componentes por modulo (pos, inventario, mesas, gastos, estadisticas, personalizacion) y ui/ compartido
  hooks/         Hooks por dominio: datos (fetch), UI (estado local) y formularios
  lib/api/       Cliente HTTP centralizado y funciones por recurso
  lib/           Utilidades (temas, imagenes, ordenamiento, supabase client)
  contexts/      Contextos globales (TenantContext: negocio, logo, plan, giro)
  types/         Tipos TypeScript compartidos con el backend
  middleware.ts  Manejo de cookies de sesion de Supabase
```

## Deploy

El proyecto esta pensado para Vercel. Configura las variables `NEXT_PUBLIC_*` en el panel del proyecto y el deploy se ejecuta automaticamente en cada push a `main`.
