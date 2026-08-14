// ==============================================================================
// src/components/pos/GridProductos.tsx
// Catálogo del Punto de Venta: pills de categoría, barra de búsqueda +
// ordenamiento, grid de TarjetaProducto y estado vacío. Recibe los filtros y
// derivados de usePosUI y el handler de agregar de usePosCarrito vía props.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import { TarjetaProducto } from "./TarjetaProducto"
import type { Dispatch, SetStateAction } from "react"
import type { Producto } from "@/lib/api"

interface Props {
    categorias: string[]
    categoriaSeleccionada: string
    setCategoriaSeleccionada: (cat: string) => void
    busqueda: string
    setBusqueda: (b: string) => void
    ordenamiento: string
    setOrdenamiento: Dispatch<SetStateAction<string>>
    cargando: boolean
    productosFiltrados: Producto[]
    relacionImagen: string
    agregarAlCarrito: (prod: Producto) => void
}

export function GridProductos({
    categorias,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
    busqueda,
    setBusqueda,
    ordenamiento,
    setOrdenamiento,
    cargando,
    productosFiltrados,
    relacionImagen,
    agregarAlCarrito,
}: Props) {
    return (
        <>
            {/* ── Filtro de categorías como pills (inspirado en Editar Prod.) ── */}
            <div style={{ marginBottom: 12 }}>
                <p style={{
                    fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px"
                }}>
                    Filtrar por categoría
                </p>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 8px 8px", scrollbarWidth: "none" }}>
                    {categorias.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoriaSeleccionada(cat)}
                            style={{
                                padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.78rem",
                                whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                                background: categoriaSeleccionada === cat ? "var(--primary-mid)" : "var(--bg-card2)",
                                color: categoriaSeleccionada === cat ? "#fff" : "var(--primary-dark)",
                                boxShadow: categoriaSeleccionada === cat ? "0 2px 6px var(--primary-glow)" : "none"
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 200 }}>
                    <Icon name="Search" size={20} color="var(--text-muted)" />
                    <input
                        className="input-primary"
                        style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                        placeholder="Buscar producto, código o categoría..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid var(--border-primary)", paddingLeft: 12 }}>
                    <button
                        onClick={() => {
                            setOrdenamiento(prev => {
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
                        value={ordenamiento}
                        onChange={e => setOrdenamiento(e.target.value)}
                    >
                        <option value="stock-desc">Mayor stock</option>
                        <option value="stock-asc">Menor stock</option>
                        <option value="precio-desc">Mayor precio</option>
                        <option value="precio-asc">Menor precio</option>
                        <option value="alfabetico">Alfabético A-Z</option>
                        <option value="alfabetico-desc">Alfabético Z-A</option>
                    </select>
                </div>
            </div>

            {cargando ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                    Cargando productos...
                </div>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    gap: 12,
                }}>
                    {productosFiltrados.map(prod => (
                        <TarjetaProducto
                            key={prod.producto}
                            prod={prod}
                            relacionImagen={relacionImagen}
                            onAgregar={agregarAlCarrito}
                            onCategoriaClick={cat => setCategoriaSeleccionada(cat)}
                        />
                    ))}
                    {productosFiltrados.length === 0 && !cargando && (
                        <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                            <span style={{ fontSize: "4rem", display: "block", marginBottom: 16 }}>😿</span>
                            <h2 style={{ fontSize: "1.8rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 12px", lineHeight: 1.2, textTransform: "uppercase" }}>
                                No hay productos
                            </h2>
                            <p style={{ fontSize: "1.2rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>
                                Agrega nuevos en <span style={{ color: "var(--primary-mid)", fontWeight: 800 }}>INVENTARIO</span>
                            </p>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}
