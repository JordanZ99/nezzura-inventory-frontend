// ==============================================================================
// scripts/build-mobile.mjs — Build nativo (Capacitor) del frontend Next.js
//
// Capacitor consume un bundle ESTÁTICO (`output: "export"`). Tres piezas del
// proyecto NO son exportables y solo existen para la web:
//
//   1. src/middleware.ts          — Next no permite middleware con export.
//       La protección real ya vive en cliente (TenantContext/LicenciaGuard)
//       y en el backend (JWT en cada endpoint).
//   2. src/app/posts/             — Route Handler edge con `next/og`
//       (generación de imágenes para redes); no corre en estático.
//   3. src/app/catalogo/[slug]/   — Server Component con generateMetadata
//       (fetch no-store) + opengraph-image; el catálogo público sigue
//       servido por Vercel, y en el móvil "ver catálogo" abre la URL web.
//       (catalogo/impresion SÍ es estática y se queda.)
//
// Este script APARTA esas rutas a un stash temporal, lanza `next build` con
// CAPACITOR_BUILD=1 (activa output:export en next.config.mjs) y las RESTAURA
// en finally, pase lo que pase. El resultado queda en out/ (webDir de
// capacitor.config.ts) listo para `npx cap sync android`.
//
// Uso:  npm run build:nativo        (o npx cap sync después)
// ==============================================================================

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const stash = path.join(raiz, ".native-stash")

const A_APARTAR = [
    ["src/middleware.ts", "middleware.ts"],
    ["src/app/posts", "posts"],
    ["src/app/catalogo/[slug]", "catalogo-slug"],
]

function mover(srcRel, destinoNombre) {
    const origen = path.join(raiz, srcRel)
    const destino = path.join(stash, destinoNombre)
    if (!fs.existsSync(origen)) {
        console.log(`· build-mobile: no existe ${srcRel} (ya apartada, continúo)`)
        return
    }
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    fs.renameSync(origen, destino)
    console.log(`· build-mobile: apartada ${srcRel}`)
}

function restaurar(srcRel, destinoNombre) {
    const destino = path.join(stash, destinoNombre)
    const origen = path.join(raiz, srcRel)
    if (fs.existsSync(destino)) {
        fs.mkdirSync(path.dirname(origen), { recursive: true })
        fs.renameSync(destino, origen)
        console.log(`· build-mobile: restaurada ${srcRel}`)
    }
}

console.log("─".repeat(70))
console.log("Build nativo (Capacitor): apartando rutas de web-only…")
fs.rmSync(stash, { recursive: true, force: true })
fs.mkdirSync(stash, { recursive: true })

const apartadas = []
for (const [src, nombre] of A_APARTAR) {
    if (fs.existsSync(path.join(raiz, src))) {
        mover(src, nombre)
        apartadas.push([src, nombre])
    }
}

let ok = false
try {
    const r = spawnSync("npx", ["next", "build"], {
        cwd: raiz,
        stdio: "inherit",
        shell: true,
        env: { ...process.env, CAPACITOR_BUILD: "1" },
    })
    ok = r.status === 0
} finally {
    console.log("· build-mobile: restaurando rutas web…")
    for (const [src, nombre] of apartadas) restaurar(src, nombre)
    try { fs.rmSync(stash, { recursive: true, force: true }) } catch {}
}

if (!ok) {
    console.error("\n✗ El build nativo FALLÓ — revisa el log de arriba.")
    process.exit(1)
}

if (!fs.existsSync(path.join(raiz, "out", "index.html"))) {
    console.error("\n✗ No se generó out/index.html — el export estático salió vacío.")
    process.exit(1)
}

console.log("─".repeat(70))
console.log("✓ Export estático listo en out/ — siguiente paso: npx cap sync android")
