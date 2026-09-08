import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import { TarjetaProducto } from "@/components/productos/TarjetaProducto"
import type { Producto } from "@/lib/api"
import { invertirOrden, OPCIONES_ORDEN_PRODUCTO } from "@/lib/ordenamiento"

interface Props {
    categoriasExistentes: string[]
    catSelecEditar: string
    setCatSelecEditar: Dispatch<SetStateAction<string>>
    buscadorEditar: string
    setBuscadorEditar: Dispatch<SetStateAction<string>>
    editarOrdenamiento: string
    setEditarOrdenamiento: Dispatch<SetStateAction<string>>
    productosEditar: Producto[]
    cargarProductoEdicion: (prod: Producto) => void
    relacionImagen: string
    // Abre el modal "Crear post" (Posts Automáticos, Fase 1) con este producto
    onCrearPost: (prod: Producto) => void
}

/** Grid de productos de la pestaña Editar (buscador + categorías + tarjetas). */
export default function GridEditar({
    categoriasExistentes,
    catSelecEditar, setCatSelecEditar,
    buscadorEditar, setBuscadorEditar,
    editarOrdenamiento, setEditarOrdenamiento,
    productosEditar,
    cargarProductoEdicion,
    relacionImagen,
    onCrearPost,
}: Props) {
    return (
        <>
            {/* Categorías */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
                {["Todas", ...categoriasExistentes].map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCatSelecEditar(cat)}
                        style={{
                            padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                            background: catSelecEditar === cat ? "var(--primary-mid)" : "var(--bg-card2)",
                            color: catSelecEditar === cat ? "#fff" : "var(--primary-dark)",
                            boxShadow: catSelecEditar === cat ? "0 2px 6px var(--primary-glow)" : "none"
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 200 }}>
                    <Icon name="Search" size={20} color="var(--text-muted)" />
                    <input
                        className="input-primary"
                        style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                        placeholder="Buscar producto por nombre, código o categoría..."
                        value={buscadorEditar}
                        onChange={e => setBuscadorEditar(e.target.value)}
                    />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid var(--border-primary)", paddingLeft: 12 }}>
                    <button
                        onClick={() => setEditarOrdenamiento(prev => invertirOrden(prev))}
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
                        value={editarOrdenamiento}
                        onChange={e => setEditarOrdenamiento(e.target.value)}
                    >
                        {OPCIONES_ORDEN_PRODUCTO.map(o => (
                            <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                    {productosEditar.length === 0 ? (
                        <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                            <span style={{ fontSize: "4rem", display: "block", marginBottom: 16, opacity: 0.3 }}>—</span>
                            <h2 style={{ fontSize: "1.5rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 8px" }}>Sin resultados</h2>
                            <p style={{ fontSize: "1rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>Intenta con otra búsqueda o categoría</p>
                        </div>
                    ) : (
                        productosEditar.map(prod => (
                            <TarjetaProducto
                                key={prod.producto}
                                prod={prod}
                                relacionImagen={relacionImagen}
                                onClick={() => cargarProductoEdicion(prod)}
                            >
                                {/* Crear post (Posts Automáticos — Fase 1) */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCrearPost(prod) }}
                                    title="Genera una tarjeta lista para Instagram/WhatsApp con la foto, el nombre y el precio"
                                    style={{
                                        marginTop: 8, width: "100%",
                                        padding: "6px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                                        background: "var(--gradient-1)", color: "#fff",
                                        fontSize: "0.68rem", fontWeight: 800,
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                        transition: "all 0.15s",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.9" }}
                                    onMouseLeave={e => { e.currentTarget.style.opacity = "1" }}
                                >
                                    <Icon name="ImagePlus" size={14} color="#fff" /> Crear post
                                </button>
                            </TarjetaProducto>
                        )))}
                </div>
        </>
    )
}
