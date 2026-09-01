// ==============================================================================
// src/components/mesas/PanelMesa.tsx
// Panel de UNA mesa (Fase 2): su orden abierta (renglones con quitar), las
// acciones (Pedir cuenta / Regresar, Cancelar orden, Cobrar) y el MENÚ debajo
// (GridProductos reutilizado) para ir agregando. Los productos con variaciones
// abren ModalVariacion; el tile "Venta libre" abre ModalVentaLibre; ambos
// terminan como renglones en la mesa (no en el carrito local).
// ==============================================================================

import { useState, type Dispatch, type SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import ModalConfirmacion from "@/components/ui/ModalConfirmacion"
import { ModalVariacion } from "@/components/pos/ModalVariacion"
import { ModalVentaLibre } from "@/components/pos/ModalVentaLibre"
import { GridProductos } from "@/components/pos/GridProductos"
import { NOMBRE_VENTA_LIBRE } from "@/lib/ventaLibre"
import type { Mesa, Producto } from "@/lib/api"

interface Props {
    mesa: Mesa
    // Props del menú (GridProductos) venían de usePosUI / usePosDatos
    categorias: string[]
    categoriaSeleccionada: string
    setCategoriaSeleccionada: (cat: string) => void
    busqueda: string
    setBusqueda: (b: string) => void
    ordenamiento: string
    setOrdenamiento: Dispatch<SetStateAction<string>>
    cargandoMenu: boolean
    productosFiltrados: Producto[]
    relacionImagen: string
    // Acciones (useMesas)
    agregarItems: (mesaId: string, items: {
        producto: string
        cantidad: number
        precio_unitario: number
        descripcion?: string
        variacion?: string
        costo?: number
    }[]) => Promise<void>
    quitarItem: (mesaId: string, itemId: string) => Promise<void>
    pedirCuenta: (mesaId: string) => Promise<void>
    regresarAOcupada: (mesaId: string) => Promise<void>
    cancelarOrden: (mesaId: string) => Promise<void>
    onCobrar: () => void
    onVolver: () => void
}

function haceCuanto(abiertaEn: string | null | undefined): string {
    if (!abiertaEn) return ""
    const mins = Math.max(0, Math.floor((Date.now() - new Date(abiertaEn).getTime()) / 60000))
    if (mins < 60) return `abierta hace ${mins} min`
    return `abierta hace ${Math.floor(mins / 60)} h ${mins % 60} min`
}

export function PanelMesa({
    mesa, categorias, categoriaSeleccionada, setCategoriaSeleccionada, busqueda, setBusqueda,
    ordenamiento, setOrdenamiento, cargandoMenu, productosFiltrados, relacionImagen,
    agregarItems, quitarItem, pedirCuenta, regresarAOcupada, cancelarOrden, onCobrar, onVolver,
}: Props) {
    const [modalVariacion, setModalVariacion] = useState<{ visible: boolean; prod: Producto | null }>({ visible: false, prod: null })
    const [modalLibre, setModalLibre] = useState(false)
    const [confirmarCancelar, setConfirmarCancelar] = useState(false)

    const items = mesa.items || []
    const total = items.reduce((a, it) => a + Number(it.cantidad) * Number(it.precio_unitario), 0)

    // Agregar producto del menú como renglón de la mesa (1 unidad; desde el
    // carrito local NO se puede tocar la mesa).
    async function agregarRenglon(prod: Producto, variacion?: string, precio?: number) {
        const precioUnit = precio ?? prod.precio_sugerido ?? prod.precio_venta ?? 0
        await agregarItems(mesa.id, [{
            producto: prod.producto,
            cantidad: 1,
            precio_unitario: precioUnit,
            ...(variacion ? { variacion } : {}),
        }])
    }

    function manejarAgregar(prod: Producto) {
        // Con variaciones: primero se elige cuál (misma mecánica que el POS clásico)
        if ((prod.variaciones || []).length > 0) {
            setModalVariacion({ visible: true, prod })
            return
        }
        void agregarRenglon(prod)
    }

    return (
        <div>
            {/* ── Encabezado de la mesa ── */}
            <div className="card fade-up" style={{ padding: "14px 18px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                        onClick={onVolver}
                        title="Volver a las mesas"
                        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--primary-dark)", fontWeight: 800, fontSize: "0.85rem", gap: 4 }}
                    >
                        <Icon name="ArrowLeft" size={18} /> Mesas
                    </button>
                    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)" }}>
                        {mesa.nombre}
                    </h2>
                    <span style={{
                        fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                        color: mesa.estado === "Ocupada" ? "#b45309" : mesa.estado === "Cuenta" ? "#6d28d9" : "#2e7d32",
                        background: mesa.estado === "Ocupada" ? "#fef3c7" : mesa.estado === "Cuenta" ? "#ede9fe" : "#e8f5e9",
                        borderRadius: 6, padding: "2px 8px",
                    }}>
                        {mesa.estado}
                    </span>
                    {mesa.abierta_en && (
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                            {haceCuanto(mesa.abierta_en)}
                        </span>
                    )}

                    <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {/* Cuenta ↔ Ocupada */}
                        {mesa.estado === "Ocupada" && items.length > 0 && (
                            <button
                                onClick={() => void pedirCuenta(mesa.id)}
                                style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #c4b5fd", background: "#ede9fe", color: "#6d28d9", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
                            >
                                Pedir cuenta
                            </button>
                        )}
                        {mesa.estado === "Cuenta" && (
                            <button
                                onClick={() => void regresarAOcupada(mesa.id)}
                                style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
                            >
                                Regresar a Ocupada
                            </button>
                        )}
                        {items.length > 0 && (
                            <button
                                onClick={() => setConfirmarCancelar(true)}
                                style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #f2b8b5", background: "#fdecea", color: "#b71c1c", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
                            >
                                Cancelar orden
                            </button>
                        )}
                        <button
                            onClick={onCobrar}
                            disabled={items.length === 0}
                            title={items.length === 0 ? "Agrega artículos primero" : "Cobrar el ticket de esta mesa"}
                            style={{
                                padding: "8px 18px", borderRadius: 10, border: "none",
                                background: items.length === 0 ? "var(--bg-card2)" : "var(--primary-mid)",
                                color: items.length === 0 ? "var(--text-muted)" : "#fff",
                                fontWeight: 800, fontSize: "0.82rem",
                                cursor: items.length === 0 ? "not-allowed" : "pointer",
                            }}
                        >
                            Cobrar · ${total.toFixed(2)}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Renglones de la orden abierta ── */}
            <div className="card fade-up" style={{ padding: "14px 18px", marginBottom: 14 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: "0.95rem", fontWeight: 800 }}>
                    Orden abierta {items.length > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>· {items.length} artículo(s)</span>}
                </h3>
                {items.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        Nada pedido todavía — agrega platillos del menú de abajo.
                    </p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {items.map(it => (
                            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {it.descripcion || it.producto}
                                    </p>
                                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                        {Number(it.cantidad)} × ${Number(it.precio_unitario).toFixed(2)}
                                        {it.variacion ? ` · ${it.variacion}` : ""}
                                        {it.producto === NOMBRE_VENTA_LIBRE ? " · venta libre" : ""}
                                    </p>
                                </div>
                                <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--primary-dark)" }}>
                                    ${(Number(it.cantidad) * Number(it.precio_unitario)).toFixed(2)}
                                </span>
                                <button
                                    onClick={() => void quitarItem(mesa.id, it.id)}
                                    title="Quitar renglón"
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#b71c1c", padding: 2, display: "flex" }}
                                >
                                    <Icon name="Trash2" size={15} />
                                </button>
                            </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10 }}>
                            <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--primary-dark)" }}>
                                Total: ${total.toFixed(2)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Menú para agregar (GridProductos del POS reutilizado) ── */}
            <GridProductos
                categorias={categorias}
                categoriaSeleccionada={categoriaSeleccionada}
                setCategoriaSeleccionada={setCategoriaSeleccionada}
                busqueda={busqueda}
                setBusqueda={setBusqueda}
                ordenamiento={ordenamiento}
                setOrdenamiento={setOrdenamiento}
                cargando={cargandoMenu}
                productosFiltrados={productosFiltrados}
                relacionImagen={relacionImagen}
                agregarAlCarrito={manejarAgregar}
                onVentaLibre={() => setModalLibre(true)}
            />

            {/* ── Modal de variación (misma mecánica que el POS clásico) ── */}
            {modalVariacion.visible && modalVariacion.prod && (
                <ModalVariacion
                    prod={modalVariacion.prod}
                    onSeleccionar={(prod, nombre, precio) => {
                        setModalVariacion({ visible: false, prod: null })
                        void agregarRenglon(prod, nombre, precio)
                    }}
                    onCancelar={() => setModalVariacion({ visible: false, prod: null })}
                />
            )}

            {/* ── Modal de venta libre hacia la mesa ── */}
            {modalLibre && (
                <ModalVentaLibre
                    onAgregar={(descripcion, precio, costo) => {
                        setModalLibre(false)
                        void agregarItems(mesa.id, [{
                            producto: NOMBRE_VENTA_LIBRE,
                            cantidad: 1,
                            precio_unitario: precio,
                            ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
                            ...(costo > 0 ? { costo } : {}),
                        }])
                    }}
                    onCancelar={() => setModalLibre(false)}
                />
            )}

            {/* ── Confirmación para cancelar la orden completa ── */}
            {confirmarCancelar && (
                <ModalConfirmacion
                    icon="Trash2"
                    iconBg="#fdecea"
                    iconColor="#b71c1c"
                    titulo="Cancelar orden"
                    mensaje={`Se borrarán TODOS los renglones de ${mesa.nombre} y la mesa quedará libre. Nada se cobró, así que no afecta las finanzas.`}
                    btnConfirmar="Cancelar orden"
                    btnColor="#b71c1c"
                    onCancelar={() => setConfirmarCancelar(false)}
                    onConfirmar={() => {
                        setConfirmarCancelar(false)
                        void cancelarOrden(mesa.id)
                    }}
                />
            )}
        </div>
    )
}
