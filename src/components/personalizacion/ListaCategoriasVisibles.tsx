// ==============================================================================
// src/components/personalizacion/ListaCategoriasVisibles.tsx
// Lista de categorías del catálogo con toggle de visibilidad (click = ocultar/
// mostrar en el catálogo público). Recibe el estado y el handler de
// useConfigCatalogo vía props.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import type { Categoria } from "@/lib/api"

interface Props {
    categoriasCatalogo: Categoria[]
    categoriaToggling: string | null
    toggleCategoria: (categoria: string) => void
}

export function ListaCategoriasVisibles({ categoriasCatalogo, categoriaToggling, toggleCategoria }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categoriasCatalogo.map(cat => {
                const visible = cat.visible_en_catalogo !== false
                return (
                    <button
                        key={cat.id}
                        onClick={() => toggleCategoria(cat.nombre)}
                        disabled={categoriaToggling === cat.nombre}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: `1.5px solid ${visible ? "var(--primary-mid)" : "var(--border-primary)"}`,
                            background: visible ? "var(--primary-soft)" : "var(--bg-card2)",
                            cursor: categoriaToggling === cat.nombre ? "wait" : "pointer",
                            textAlign: "left",
                            transition: "all 0.15s",
                            width: "100%",
                            opacity: visible ? 1 : 0.6,
                        }}
                    >
                        <div>
                            <span style={{
                                fontWeight: 700,
                                fontSize: "0.82rem",
                                color: visible ? "var(--text-main)" : "var(--text-muted)",
                            }}>
                                {cat.nombre}
                            </span>
                            <span style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                                marginLeft: 8,
                                fontWeight: 500,
                            }}>
                                ({cat.total_productos} productos)
                            </span>
                        </div>
                        <Icon
                            name={visible ? "Eye" : "EyeOff"}
                            size={18}
                            color={visible ? "var(--primary-mid)" : "var(--text-muted)"}
                        />
                    </button>
                )
            })}
        </div>
    )
}
