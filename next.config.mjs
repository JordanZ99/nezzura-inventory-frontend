// ==============================================================================
// next.config.mjs — Config dual: web (Vercel, SSR completo) vs nativo (Capacitor)
//
// El build para Capacitor exige `output: "export"` (assets estáticos dentro del
// binario: SSR/Server Actions/Route Handlers dinámicos no existen ahí). Para no
// perder nada en la web, la exportación estática SOLO se activa cuando el build
// se lanza con CAPACITOR_BUILD=1 (ver scripts/build-mobile.mjs, que además
// aparta temporalmente las rutas no exportables: middleware, posts/ y
// catalogo/[slug]).
//
// * trailingSlash: true — el WebView de Capacitor sirve archivos por ruta de
//   directorio; con slash final cada página es <ruta>/index.html y las
//   navegaciones client-side resuelven igual que en el navegador.
// * images.unoptimized — no hay runtime de Node en el teléfono que optimice.
// ==============================================================================

/** @type {import('next').NextConfig} */
const buildNativo = process.env.CAPACITOR_BUILD === "1"

const nextConfig = buildNativo
    ? {
          output: "export",
          trailingSlash: true,
          images: { unoptimized: true },
          env: {
              NEXT_PUBLIC_CAPACITOR: "1",
          },
      }
    : {}

export default nextConfig
