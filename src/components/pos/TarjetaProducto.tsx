// ==============================================================================
// src/components/pos/TarjetaProducto.tsx
// Tarjeta del grid del Punto de Venta: imagen (objectFit contain), nombre,
// precio ("Desde $" para variaciones, rango para precios mínimo/máximo),
// badges de tipo (servicio/compuesto/stock) y categoría clickeable.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import type { Producto } from "@/lib/api"

interface Props {
    prod: Producto
    relacionImagen: string
    onAgregar: (prod: Producto) => void
    onCategoriaClick: (categoria: string) => void
}

export function TarjetaProducto({ prod, relacionImagen, onAgregar, onCategoriaClick }: Props) {
    return (
        <div key={prod.producto} className="card fade-up" style={{
            padding: 12,
            cursor: "pointer",
            transition: "transform 0.15s, box-shadow 0.15s",
        }}
            onClick={() => onAgregar(prod)}
            onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-3px)"
                e.currentTarget.style.boxShadow = "0 8px 30px var(--primary-glow)"
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = ""
                e.currentTarget.style.boxShadow = ""
            }}>
            <div style={{
                aspectRatio: relacionImagen, borderRadius: 12,
                background: "var(--gradient-bg-login)",
                marginBottom: 10, overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                {prod.imagen && prod.imagen !== "No hay foto" ? (
                    <img src={prod.imagen.startsWith("http") ? prod.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${prod.imagen}`}
                        alt={prod.producto}
                        /*
                     * Usamos objectFit: "contain" en lugar de "cover" para que
                     * las imágenes verticales (retrato) no se recorten. Con "contain"
                     * el lado más grande se ajusta al contenedor y la imagen se ve
                     * completa, mostrando el fondo gradiente en los bordes vacíos.
                     * Se agrega un padding sutil para evitar que la imagen toque
                     * los bordes del contenedor cuadrado.
                     */
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8, borderRadius: 12 }} />
                ) : (
                    <span style={{ fontSize: "2rem" }}>🛍️</span>
                )}
            </div>
            <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {prod.producto}
            </p>
            <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>
                {(prod.variaciones || []).length > 0
                    ? `Desde $${Math.min(...(prod.variaciones || []).map(v => v.precio)).toFixed(2)}`
                    : prod.precio_min !== undefined && prod.precio_max !== undefined && prod.precio_min < prod.precio_max
                        ? `$${prod.precio_min.toFixed(2)} – $${prod.precio_max.toFixed(2)}`
                        : `$${(prod.precio_sugerido ?? prod.precio_venta).toFixed(2)}`}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, alignItems: "center" }}>
                <span
                    onClick={(e) => {
                        e.stopPropagation();
                        onCategoriaClick(prod.categoria?.[0] || "General");
                    }}
                    style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}
                >
                    {(prod.categoria || ["General"]).join(", ")}
                </span>
                {prod.tipo_producto === "servicio" ? (
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#7b3fa0", background: "#f3e8ff", borderRadius: 6, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Icon name="Scissors" size={11} /> Servicio
                    </span>
                ) : prod.tipo_producto === "compuesto" ? (
                    <>
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#b45309", background: "#fef3c7", borderRadius: 6, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Icon name="Hamburger" size={11} /> Compuesto
                        </span>
                        {prod.disponibilidad_estimada !== undefined && prod.disponibilidad_estimada !== null && (
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: prod.disponibilidad_estimada <= 0 ? "#b71c1c" : "#6d4c41", background: prod.disponibilidad_estimada <= 0 ? "#ffeef0" : "#efebe9", borderRadius: 6, padding: "2px 6px" }}>
                                Quedan ~{prod.disponibilidad_estimada}
                            </span>
                        )}
                    </>
                ) : (
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: prod.stock_total <= 0 ? "#b71c1c" : "#2e7d32", background: prod.stock_total <= 0 ? "#ffeef0" : "#e8f5e9", borderRadius: 6, padding: "2px 6px" }}>
                        Stock: {prod.stock_total}
                    </span>
                )}
            </div>
        </div>
    )
}
