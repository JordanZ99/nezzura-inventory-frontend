// ==============================================================================
// src/components/personalizacion/SeccionVisibilidad.tsx
// Sección "Visibilidad": ocultar stock, ocultar productos agotados y la lista
// de categorías visibles (ListaCategoriasVisibles).
// ==============================================================================

import SeccionHeader from "@/components/ui/SeccionHeader"
import Switch from "@/components/ui/Switch"
import { ListaCategoriasVisibles } from "./ListaCategoriasVisibles"
import type { Categoria } from "@/lib/api"
import type { PropsSeccionConfig } from "./tipos"

interface Props extends PropsSeccionConfig {
    categoriasCatalogo: Categoria[]
    categoriaToggling: string | null
    toggleCategoria: (categoria: string) => void
}

export function SeccionVisibilidad({
    catalogoConfig,
    setCatalogoConfig,
    autoguardar,
    campoGuardando,
    renderGuardado,
    categoriasCatalogo,
    categoriaToggling,
    toggleCategoria,
}: Props) {
    return (
        <>
            <SeccionHeader icono="Eye" titulo="Visibilidad" />

            {/* Ocultar stock (guardado como el inverso de mostrar_stock: null/true = visible) */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
            }}>
                <div>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Ocultar stock</span>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                        Los clientes no verán cuántas unidades quedan de cada producto.
                    </p>
                    {renderGuardado("mostrar_stock")}
                </div>
                <Switch
                    checked={(catalogoConfig?.mostrar_stock ?? true) === false}
                    onChange={() => {
                        const ocultando = (catalogoConfig?.mostrar_stock ?? true) === false
                        setCatalogoConfig(prev => prev ? { ...prev, mostrar_stock: ocultando } : prev)
                        autoguardar("mostrar_stock", { mostrar_stock: ocultando })
                    }}
                    disabled={campoGuardando === "mostrar_stock"}
                />
            </div>

            {/* Ocultar productos agotados */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
            }}>
                <div>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Ocultar productos agotados</span>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                        Los productos sin stock desaparecerán del catálogo.
                    </p>
                    {renderGuardado("ocultar_agotados")}
                </div>
                <Switch
                    checked={!!catalogoConfig?.ocultar_agotados}
                    onChange={() => {
                        const nuevo = !catalogoConfig?.ocultar_agotados
                        setCatalogoConfig(prev => prev ? { ...prev, ocultar_agotados: nuevo } : prev)
                        autoguardar("ocultar_agotados", { ocultar_agotados: nuevo })
                    }}
                    disabled={campoGuardando === "ocultar_agotados"}
                />
            </div>

            {/* ── Visibilidad de categorías ── */}
            {categoriasCatalogo.length > 0 && (
                <div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                        Categorías visibles
                    </span>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 12px", fontWeight: 500 }}>
                        Las categorías que ocultes no se mostrarán en el catálogo público.
                    </p>
                    <ListaCategoriasVisibles
                        categoriasCatalogo={categoriasCatalogo}
                        categoriaToggling={categoriaToggling}
                        toggleCategoria={toggleCategoria}
                    />
                </div>
            )}
        </>
    )
}
