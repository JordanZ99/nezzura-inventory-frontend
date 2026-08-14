// ==============================================================================
// src/components/estadisticas/TarjetaProductoEstadistica.tsx
// Card del grid de productos: imagen (aspectRatio según la config del
// catálogo), nombre, precio y badges de categoría + stock.
// ==============================================================================

import type { Producto } from "@/lib/api"
import Icon from "@/components/ui/Icon"

interface Props {
    prod: Producto
    relacionImagen: string
    onClick: () => void
}

export default function TarjetaProductoEstadistica({ prod, relacionImagen, onClick }: Props) {
    return (
        <div
            key={prod.producto}
            className="card fade-up"
            style={{
                padding: 12,
                cursor: "pointer",
                transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onClick={onClick}
            onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-3px)"
                e.currentTarget.style.boxShadow = "0 8px 30px var(--primary-glow)"
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = ""
                e.currentTarget.style.boxShadow = ""
            }}
        >
            <div style={{
                aspectRatio: relacionImagen, borderRadius: 12,
                background: "var(--gradient-bg-login)",
                marginBottom: 10, overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                {prod.imagen && prod.imagen !== "No hay foto" ? (
                    <img
                        src={prod.imagen.startsWith("http") ? prod.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${prod.imagen}`}
                        alt={prod.producto}
                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8, borderRadius: 12 }}
                    />
                ) : (
                    <Icon name="Package" size={32} color="var(--text-muted)" />
                )}
            </div>
            <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {prod.producto}
            </p>
            <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>
                ${(prod.precio_venta ?? 0).toFixed(2)}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px" }}>
                    {(prod.categoria || ["General"]).join(", ")}
                </span>
                <span style={{
                    fontSize: "0.62rem", fontWeight: 700,
                    color: prod.stock_total <= 0 ? "#b71c1c" : "#2e7d32",
                    background: prod.stock_total <= 0 ? "#ffeef0" : "#e8f5e9",
                    borderRadius: 6, padding: "2px 6px"
                }}>
                    Stock: {prod.stock_total}
                </span>
            </div>
        </div>
    )
}
