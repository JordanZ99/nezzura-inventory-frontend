import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import { TarjetaProducto } from "@/components/productos/TarjetaProducto"
import type { Producto } from "@/lib/api"
import { invertirOrden, OPCIONES_ORDEN_PRODUCTO } from "@/lib/ordenamiento"

interface Props {
    categoriasExistentes: string[]
    restockCatSelec: string
    setRestockCatSelec: Dispatch<SetStateAction<string>>
    restockBuscador: string
    setRestockBuscador: Dispatch<SetStateAction<string>>
    restockOrdenamiento: string
    setRestockOrdenamiento: Dispatch<SetStateAction<string>>
    productosRestock: Producto[]
    onSeleccionarProducto: (prod: Producto) => void
    relacionImagen: string
}

/** Grid de productos del Restock (buscador + categorías + tarjetas). */
export default function GridRestock({
    categoriasExistentes,
    restockCatSelec, setRestockCatSelec,
    restockBuscador, setRestockBuscador,
    restockOrdenamiento, setRestockOrdenamiento,
    productosRestock,
    onSeleccionarProducto,
    relacionImagen,
}: Props) {
    return (
        <>
            {/* Categorías */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
                {["Todas", ...categoriasExistentes].map(cat => (
                    <button
                        key={cat}
                        onClick={() => setRestockCatSelec(cat)}
                        style={{
                            padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                            background: restockCatSelec === cat ? "var(--gradient-1)" : "var(--bg-card2)",
                            color: restockCatSelec === cat ? "#fff" : "var(--primary-dark)",
                            boxShadow: restockCatSelec === cat ? "0 2px 6px var(--primary-glow)" : "none"
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
                        placeholder="Buscar por nombre, código o categoría..."
                        value={restockBuscador}
                        onChange={e => setRestockBuscador(e.target.value)}
                    />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid var(--border-primary)", paddingLeft: 12 }}>
                    <button
                        onClick={() => setRestockOrdenamiento(prev => invertirOrden(prev))}
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
                        value={restockOrdenamiento}
                        onChange={e => setRestockOrdenamiento(e.target.value)}
                    >
                        {OPCIONES_ORDEN_PRODUCTO.map(o => (
                            <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                {productosRestock.length === 0 ? (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                        <span style={{ fontSize: "4rem", display: "block", marginBottom: 16, opacity: 0.3 }}>—</span>
                        <h2 style={{ fontSize: "1.5rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 8px" }}>Sin resultados</h2>
                        <p style={{ fontSize: "1rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>Intenta con otra búsqueda o categoría</p>
                    </div>
                ) : (
                    productosRestock.map(prod => (
                        <TarjetaProducto
                            key={prod.producto}
                            prod={prod}
                            relacionImagen={relacionImagen}
                            onClick={() => onSeleccionarProducto(prod)}
                        />
                    ))
                )}
            </div>
        </>
    )
}
