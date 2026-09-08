// ==============================================================================
// src/components/productos/TarjetaProducto.tsx
// Card de producto compartida por los grids del gestor (POS, Estadísticas e
// Inventario editar/restock). Centraliza lo que antes vivía copiado en 4
// lugares: contenedor con hover, imagen con resolver de src + onError + lazy,
// nombre con ellipsis, precio y badges de categoría/stock (con variables del
// tema). Lo variable entra por props: modo de precio, fallback sin foto,
// categoría clickeable, badges de tipo (servicio/compuesto) y children para
// contenido extra al pie (p. ej. el botón Crear post de Inventario).
// ==============================================================================

import type { ReactNode } from "react"
import Icon from "@/components/ui/Icon"
import type { Producto } from "@/lib/api"

interface Props {
    prod: Producto
    relacionImagen: string
    onClick: () => void
    /** "catalogo": Desde $/rango para variaciones (POS). "simple": precio_venta (default). */
    modoPrecio?: "catalogo" | "simple"
    /** Contenido en lugar de la imagen si no hay foto (default: ícono Package) */
    fallback?: ReactNode
    /** Si se pasa, la categoría queda clickeable y filtra por ella (POS) */
    onCategoriaClick?: (categoria: string) => void
    /** Muestra badges de servicio/compuesto + disponibilidad estimada (POS) */
    mostrarTipo?: boolean
    /** Contenido extra al pie de la card (bajo los badges) */
    children?: ReactNode
}

export function TarjetaProducto({
    prod,
    relacionImagen,
    onClick,
    modoPrecio = "simple",
    fallback,
    onCategoriaClick,
    mostrarTipo = false,
    children,
}: Props) {
    const esServicio = mostrarTipo && prod.tipo_producto === "servicio"
    const esCompuesto = mostrarTipo && prod.tipo_producto === "compuesto"
    // Igual que el POS: servicio/compuesto no muestran badge de stock
    const mostrarStock = !mostrarTipo || (!esServicio && !esCompuesto)

    return (
        <div className="card fade-up" style={{
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
                        /*
                         * objectFit "contain": las imágenes verticales no se
                         * recortan; el gradiente rellena los bordes vacíos.
                         */
                        style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 12 }}
                        onError={e => { e.currentTarget.style.display = "none" }}
                        loading="lazy"
                    />
                ) : (
                    fallback ?? <Icon name="Package" size={32} color="var(--text-muted)" />
                )}
            </div>
            <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {prod.producto}
            </p>
            <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>
                {modoPrecio === "catalogo"
                    ? (prod.variaciones || []).length > 0
                        ? `Desde $${Math.min(...(prod.variaciones || []).map(v => v.precio)).toFixed(2)}`
                        : prod.precio_min !== undefined && prod.precio_max !== undefined && prod.precio_min < prod.precio_max
                            ? `$${prod.precio_min.toFixed(2)} – $${prod.precio_max.toFixed(2)}`
                            : `$${(prod.precio_sugerido ?? prod.precio_venta).toFixed(2)}`
                    : `$${(prod.precio_venta ?? 0).toFixed(2)}`}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, alignItems: "center" }}>
                <span
                    onClick={onCategoriaClick ? (e) => {
                        e.stopPropagation();
                        onCategoriaClick(prod.categoria?.[0] || "General");
                    } : undefined}
                    style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px", cursor: onCategoriaClick ? "pointer" : "default" }}
                >
                    {(prod.categoria || ["General"]).join(", ")}
                </span>
                {esServicio && (
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#7b3fa0", background: "#f3e8ff", borderRadius: 6, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Icon name="Scissors" size={11} /> Servicio
                    </span>
                )}
                {esCompuesto && (
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
                )}
                {mostrarStock && (
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: prod.stock_total <= 0 ? "var(--error-text)" : "var(--success-text)", background: prod.stock_total <= 0 ? "var(--error-bg)" : "var(--success-bg)", borderRadius: 6, padding: "2px 6px" }}>
                        Stock: {prod.stock_total}
                    </span>
                )}
            </div>
            {children}
        </div>
    )
}
