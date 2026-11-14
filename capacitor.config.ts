// ==============================================================================
// capacitor.config.ts — Configuración del shell nativo (Android primero)
//
// El shell nativo corre la VARIANTE LOCAL de la app: bundle estático de out/
// (generado por npm run build:nativo) + SQLite real de archivo en el sandbox
// del dispositivo. La nube (catálogo público, MCP, posts) sigue en Vercel.
// ==============================================================================

import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
    appId: "digital.nezzura.gestor",
    appName: "Nezzura",
    webDir: "out",
    // Evita que el WebView pida confirmaciones de red mixta al hablar con el
    // backend https desde file:// (el contenido servido local es el nuestro).
    android: {
        allowMixedContent: false,
    },
    server: {
        // Solo para desarrollo en vivo con `npx cap run` contra el dev server;
        // en producción el WebView carga el bundle local.
        androidScheme: "https",
    },
}

export default config
