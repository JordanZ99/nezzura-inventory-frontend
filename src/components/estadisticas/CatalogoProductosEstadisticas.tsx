// ==============================================================================
// src/components/estadisticas/CatalogoProductosEstadisticas.tsx
// Sección "Estadísticas por Producto": heading + pills de categorías +
// buscador/orden + grid de TarjetaProductoEstadistica + estado vacío.
// ==============================================================================

import type { Dispatch, SetStateAction } from "react"
import type { Producto } from "@/lib/api"
import Icon from "@/components/ui/Icon"
import TarjetaProductoEstadistica from "./TarjetaProductoEstadistica"

interface Props {
    categoriasCatalogo: string[]
    catSelecProd: string
    setCatSelecProd: Dispatch<SetStateAction<string>>
    busquedaProd: string
    setBusquedaProd: Dispatch<SetStateAction<string>>
    ordenProd: string
    setOrdenProd: Dispatch<SetStateAction<string>>
    productosFiltrados: Producto[]
    cargando: boolean
    relacionImagen: string
    onSeleccionar: (prod: Producto) => void
}

export default function CatalogoProductosEstadisticas({
    categoriasCatalogo,
    catSelecProd,
    setCatSelecProd,
    busquedaProd,
    setBusquedaProd,
    ordenProd,
    setOrdenProd,
    productosFiltrados,
    cargando,
    relacionImagen,
    onSeleccionar,
}: Props) {
    return (
        <div style={{ marginTop: 32 }}>
            {/* Heading */}
            <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="ChartBar" size={20} color="var(--primary-mid)" />
                    Estadísticas por Producto
                </h2>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{productosFiltrados.length} producto(s)</span>
            </div>

            {/* Pills de categorías */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
                {categoriasCatalogo.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCatSelecProd(cat)}
                        style={{
                            padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.78rem",
                            whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                            background: catSelecProd === cat ? "var(--primary-mid)" : "var(--bg-card2)",
                            color: catSelecProd === cat ? "#fff" : "var(--primary-dark)",
                            boxShadow: catSelecProd === cat ? "0 2px 6px var(--primary-glow)" : "none"
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Buscador + Orden — réplica del diseño de Restock */}
            <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 200 }}>
                    <Icon name="Search" size={20} color="var(--text-muted)" />
                    <input
                        className="input-primary"
                        style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                        placeholder="Buscar por nombre, código o categoría..."
                        value={busquedaProd}
                        onChange={e => setBusquedaProd(e.target.value)}
                    />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid var(--border-primary)", paddingLeft: 12 }}>
                    <button
                        onClick={() => {
                            setOrdenProd(prev => {
                                if (prev === "alfabetico") return "alfabetico-desc"
                                if (prev === "alfabetico-desc") return "alfabetico"
                                if (prev.endsWith("-asc")) return prev.replace("-asc", "-desc")
                                if (prev.endsWith("-desc")) return prev.replace("-desc", "-asc")
                                return prev
                            })
                        }}
                        title="Invertir orden"
                        style={{
                            background: "none", border: "none",
                            cursor: "pointer", padding: 4,
                            borderRadius: 6, display: "flex", alignItems: "center",
                            transition: "all 0.15s"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card2)" }}
                        onMouseLeave={e => { e.currentTarget.style.background = "none" }}
                    >
                        <Icon name="ArrowUpDown" size={20} color="var(--text-muted)" />
                    </button>
                    <select
                        className="input-primary"
                        style={{ border: "none", padding: "4px 8px", fontSize: "0.85rem", background: "transparent", cursor: "pointer", fontWeight: 700, color: "var(--primary-dark)" }}
                        value={ordenProd}
                        onChange={e => setOrdenProd(e.target.value)}
                    >
                        <option value="stock-desc">Mayor stock</option>
                        <option value="stock-asc">Menor stock</option>
                        <option value="precio-desc">Mayor precio</option>
                        <option value="precio-asc">Menor precio</option>
                        <option value="ventas-desc">Más ventas</option>
                        <option value="ventas-asc">Menos ventas</option>
                        <option value="ganancia-desc">Más ganancia</option>
                        <option value="ganancia-asc">Menos ganancia</option>
                        <option value="alfabetico">Alfabético A-Z</option>
                        <option value="alfabetico-desc">Alfabético Z-A</option>
                    </select>
                </div>
            </div>

            {/* Grid de productos */}
            {productosFiltrados.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)" }}>
                    <span style={{ fontSize: "4rem", display: "block", marginBottom: 16, opacity: 0.3 }}>—</span>
                    <h2 style={{ fontSize: "1.5rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 8px" }}>Sin resultados</h2>
                    <p style={{ fontSize: "1rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>
                        {cargando ? "Cargando productos..." : "Intenta con otra búsqueda o categoría"}
                    </p>
                </div>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    gap: 12,
                }}>
                    {productosFiltrados.map(prod => (
                        <TarjetaProductoEstadistica
                            key={prod.producto}
                            prod={prod}
                            relacionImagen={relacionImagen}
                            onClick={() => onSeleccionar(prod)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
