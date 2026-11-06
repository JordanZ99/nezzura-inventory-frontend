// ==============================================================================
// src/components/estadisticas/TabHistorialCambios.tsx
// Tab "Historial" del panel estadístico. Dos fuentes (ambas append-only):
//
//   ACTIVIDAD (migración 062) — todo lo que NO es stock: ediciones de producto
//   (foto, precio, nombre...), CRM (clientes, etiquetas, interacciones,
//   puntos) y cobros del giro 'servicios'. Fila expandible con el diff.
//
//   INVENTARIO (migración 040) — cada entrada/salida/ajuste de stock, con su
//   origen y el stock resultante del lote. El detalle fiscal vive aquí:
//   la fila expandida muestra producto_id, id_lote y referencia_id.
//
// Ventana por defecto: los últimos 90 días (el selector mira más atrás cuando
// haga falta). Lectura pura: nada admite edición ni borrado (append-only).
// ==============================================================================

import { Fragment, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import { api } from "@/lib/api"
import type {
    MovimientoInventario, OrigenMovimiento, TipoMovimiento,
    EventoActividad, AccionActividad, DominioActividad,
} from "@/types"
import { useActividad, fechaHace90Dias } from "@/hooks/useActividad"
import { useTenant } from "@/contexts/TenantContext"

const ELEMENTOS_POR_PAGINA = 50

type Vista = "actividad" | "inventario" | "clientes" | "cobros"

// ── Etiquetas / colores compartidos ─────────────────────────────────────────

const ETIQUETAS_DOMINIO: Record<DominioActividad, string> = {
    producto: "Producto",
    cliente: "Cliente",
    cobro: "Cobro",
}

const COLOR_DOMINIO: Record<DominioActividad, string> = {
    producto: "#7c3aed",
    cliente: "#0369a1",
    cobro: "#047857",
}

const ETIQUETAS_ACCION: Record<AccionActividad, string> = {
    crear: "Creó",
    editar: "Editó",
    eliminar: "Eliminó",
    abonar: "Abonó",
    quitar_abono: "Quitó abono",
    generar: "Generó",
    ajustar_puntos: "Ajuste de puntos",
}

const COLOR_ACCION: Record<AccionActividad, string> = {
    crear: "#047857",
    editar: "#7c3aed",
    eliminar: "#b71c1c",
    abonar: "#047857",
    quitar_abono: "#b45309",
    generar: "#0369a1",
    ajustar_puntos: "#b45309",
}

const ETIQUETAS_ORIGEN: Record<OrigenMovimiento, string> = {
    venta: "Venta",
    restock: "Restock / alta",
    ajuste_manual: "Ajuste manual",
    edicion_venta: "Edición de venta",
    anulacion: "Anulación",
    baja_lote: "Baja de lote",
    conteo: "Conteo de auditoría",
}

const COLOR_TIPO: Record<TipoMovimiento, string> = {
    entrada: "var(--success-text)",
    salida: "#b71c1c",
    ajuste: "#b45309",
}

// Etiquetas legibles para las llaves del JSONB `detalle` (062).
const ETIQUETAS_CAMPO: Record<string, string> = {
    nombre: "Nombre", descripcion: "Descripción", imagen: "Foto",
    estado: "Estado", precio: "Precio", foto: "Foto",
    codigo_interno: "Código interno", codigo_barras: "Código de barras",
    ubicacion: "Ubicación", visible_en_catalogo: "Visible en catálogo",
    sufijo_precio: "Sufijo de precio", fraccionable: "Fraccionable",
    tamano_cm: "Tamaño (cm)", tipo_producto: "Tipo", tipo: "Tipo",
    costo_servicio: "Costo servicio", precio_servicio: "Precio servicio",
    costo: "Costo", costo_lote: "Costo (lotes)", precio_venta: "Precio de venta",
    stock: "Stock inicial", categoria: "Categorías", categorias: "Categorías",
    color: "Color", email: "Email", telefono: "Teléfono", notas: "Notas",
    cumpleanos: "Cumpleaños", origen: "Origen", activo: "Activo", pin: "PIN",
    concepto: "Concepto", monto: "Monto", vencimiento: "Vencimiento",
    programa: "Plan de pagos", dia_cobro: "Día de cobro", cliente: "Cliente",
    frecuencia: "Frecuencia", dia_semana: "Día de la semana",
    puntos: "Puntos", stock_inicial: "Stock inicial",
    asignadas: "Etiquetas asignadas", desasignadas: "Etiquetas quitadas",
    saldo_despues: "Saldo después", estado_despues: "Estado después",
    quitar: "Abono quitado", omitidos: "Ya existían", metodo: "Método",
    fecha: "Fecha", cuotas: "Cuotas activas", variaciones: "Variaciones",
}

const fmtCantidad = (n: number) => {
    const limpio = Math.round(Number(n) * 1000) / 1000
    return `${limpio > 0 ? "+" : ""}${new Intl.NumberFormat("us").format(limpio)}`
}

const fmtStock = (n: number | null) =>
    n === null || n === undefined
        ? "—"
        : new Intl.NumberFormat("us").format(Math.round(Number(n) * 1000) / 1000)

const fmtFechaHora = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", {
        day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
    })

/** Corta textos largos (URLs de foto, notas) para la UI. */
const cortar = (t: string) => (t.length > 60 ? `${t.slice(0, 57)}…` : t)

/** Representa un valor del JSONB detalle en texto compacto. */
const fmtValor = (v: unknown): string => {
    if (v === null || v === undefined) return "—"
    if (typeof v === "boolean") return v ? "Sí" : "No"
    if (typeof v === "number") return new Intl.NumberFormat("us").format(v)
    if (typeof v === "string") return cortar(v)
    if (Array.isArray(v)) return v.map(x => fmtValor(x)).join(", ")
    if (typeof v === "object") {
        const partes = Object.entries(v as Record<string, unknown>).map(
            ([k, val]) => `${ETIQUETAS_CAMPO[k] ?? k}: ${fmtValor(val)}`
        )
        return cortar(partes.join("; "))
    }
    return String(v)
}

// ── Paginación (compartida por ambas vistas) ────────────────────────────────

function Paginacion(props: {
    total: number
    totalPaginas: number
    pagina: number
    visibles: number
    onPrev: () => void
    onNext: () => void
}) {
    const { total, totalPaginas, pagina, visibles, onPrev, onNext } = props
    if (total <= ELEMENTOS_POR_PAGINA) return null
    return (
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Mostrando {Math.min((pagina - 1) * ELEMENTOS_POR_PAGINA + visibles, total)} de {total} registros
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                    onClick={onPrev}
                    disabled={pagina <= 1}
                    style={{
                        padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-primary)",
                        background: pagina <= 1 ? "var(--bg-card2)" : "var(--bg-card)",
                        color: pagina <= 1 ? "var(--text-muted)" : "var(--text-main)",
                        cursor: pagina <= 1 ? "not-allowed" : "pointer",
                        fontWeight: 600, fontSize: "0.8rem", opacity: pagina <= 1 ? 0.5 : 1,
                    }}
                >
                    Anterior
                </button>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700 }}>Página {pagina} de {totalPaginas}</span>
                <button
                    onClick={onNext}
                    disabled={pagina >= totalPaginas}
                    style={{
                        padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-primary)",
                        background: pagina >= totalPaginas ? "var(--bg-card2)" : "var(--bg-card)",
                        color: pagina >= totalPaginas ? "var(--text-muted)" : "var(--text-main)",
                        cursor: pagina >= totalPaginas ? "not-allowed" : "pointer",
                        fontWeight: 600, fontSize: "0.8rem", opacity: pagina >= totalPaginas ? 0.5 : 1,
                    }}
                >
                    Siguiente
                </button>
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════════════════

export default function TabHistorialCambios() {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id

    // ── Vista (chips) ──
    const [vista, setVista] = useState<Vista>("actividad")

    // ── Ventana de fechas compartida (default: 90 días atrás; vacío = hoy) ──
    const [desde, setDesde] = useState(fechaHace90Dias)
    const [hasta, setHasta] = useState("")

    // ── Paginación y fila expandida ──
    const [pagina, setPagina] = useState(1)
    const [expandido, setExpandido] = useState<string | null>(null)

    // ── Inventario (ledger 040) ──
    const [tipoFiltro, setTipoFiltro] = useState<"" | TipoMovimiento>("")
    const [origenFiltro, setOrigenFiltro] = useState<"" | OrigenMovimiento>("")

    // Al cambiar cualquier filtro, volver a la primera página (colapsada).
    useEffect(() => { setPagina(1); setExpandido(null) }, [vista, desde, hasta, tipoFiltro, origenFiltro])

    // ── ACTIVIDAD (062: todo lo que NO es stock) ──
    const dominioActivo =
        vista === "clientes" ? "cliente" :
        vista === "cobros" ? "cobro" : undefined
    const { eventos, total: totalActividad, cargando } = useActividad({
        pagina,
        limit: ELEMENTOS_POR_PAGINA,
        dominio: dominioActivo,
        desde: desde || undefined,
        hasta: hasta || undefined,
    })

    const movimientosQuery = useQuery({
        queryKey: ["movimientos-inventario", tenantId, pagina, tipoFiltro, origenFiltro, desde, hasta],
        queryFn: () =>
            api.getMovimientos({
                limit: ELEMENTOS_POR_PAGINA,
                offset: (pagina - 1) * ELEMENTOS_POR_PAGINA,
                tipo: tipoFiltro || undefined,
                origen: origenFiltro || undefined,
                desde: desde || undefined,
                hasta: hasta || undefined,
            }),
        enabled: Boolean(tenantId) && vista === "inventario",
    })
    const movimientos: MovimientoInventario[] = movimientosQuery.data?.movimientos ?? []
    const totalInventario = movimientosQuery.data?.total ?? 0

    const esInventario = vista === "inventario"
    const total = esInventario ? totalInventario : totalActividad
    const totalPaginas = Math.max(1, Math.ceil(total / ELEMENTOS_POR_PAGINA))

    const estilosInput = {
        padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border-primary)",
        background: "var(--bg-card2)", color: "var(--text-main)", fontSize: "0.8rem",
        fontWeight: 600, outline: "none",
    } as const

    const estiloChip = (activa: boolean) => ({
        padding: "7px 14px",
        borderRadius: 999,
        border: `1px solid ${activa ? "var(--primary-alter)" : "var(--border-primary)"}`,
        background: activa ? "var(--primary-alter)" : "transparent",
        color: activa ? "#fff" : "var(--text-muted)",
        cursor: "pointer",
        fontWeight: 800,
        fontSize: "0.78rem",
        display: "flex",
        alignItems: "center",
        gap: 6,
    })

    return (
        <div>
            {/* ── Encabezado + chips + ventana ── */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="History" size={16} color="var(--primary-alter)" />
                        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>Historial completo</h3>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => setVista("actividad")} style={estiloChip(vista === "actividad")}>
                            <Icon name="Activity" size={14} /> Actividad
                        </button>
                        <button onClick={() => setVista("inventario")} style={estiloChip(vista === "inventario")}>
                            <Icon name="Package" size={14} /> Inventario
                        </button>
                        <button onClick={() => setVista("clientes")} style={estiloChip(vista === "clientes")}>
                            <Icon name="Users" size={14} /> Clientes
                        </button>
                        <button onClick={() => setVista("cobros")} style={estiloChip(vista === "cobros")}>
                            <Icon name="Wallet" size={14} /> Cobros
                        </button>
                    </div>
                </div>

                {/* Ventana de fechas + filtros de la vista */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)" }}>Ventana</span>
                    <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={estilosInput} />
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>a</span>
                    <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={estilosInput} />
                    {esInventario && (
                        <>
                            <select
                                value={tipoFiltro}
                                onChange={e => setTipoFiltro(e.target.value as "" | TipoMovimiento)}
                                style={{ ...estilosInput, cursor: "pointer" }}
                            >
                                <option value="">Todos los tipos</option>
                                <option value="entrada">Entradas</option>
                                <option value="salida">Salidas</option>
                                <option value="ajuste">Ajustes</option>
                            </select>
                            <select
                                value={origenFiltro}
                                onChange={e => setOrigenFiltro(e.target.value as "" | OrigenMovimiento)}
                                style={{ ...estilosInput, cursor: "pointer" }}
                            >
                                <option value="">Todos los orígenes</option>
                                {(Object.keys(ETIQUETAS_ORIGEN) as OrigenMovimiento[]).map(o => (
                                    <option key={o} value={o}>{ETIQUETAS_ORIGEN[o]}</option>
                                ))}
                            </select>
                        </>
                    )}
                </div>

                <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {esInventario
                        ? "Registro inmutable de cada cambio de stock: qué entró, qué salió y por qué. Expande una fila para ver los IDs (producto_id, id_lote, referencia_id)."
                        : "Registro inmutable de ediciones (foto, precios, clientes, etiquetas, abonos y cuotas). Expande una fila para ver qué cambió. Ventana por defecto: los últimos 90 días."}
                </p>
            </div>

            {esInventario ? (
                /* ── INVENTARIO (040): detalle fiscal ── */
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 720 }}>
                            <thead>
                                <tr style={{ background: "var(--bg-card2)" }}>
                                    {["Fecha", "Producto", "Movimiento", "Cantidad", "Stock en lote", "Concepto", ""].map(h => (
                                        <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {movimientosQuery.isPending && (
                                    <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>Cargando historial…</td></tr>
                                )}
                                {!movimientosQuery.isPending && movimientos.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
                                            {tipoFiltro || origenFiltro
                                                ? "Sin movimientos que coincidan con el filtro."
                                                : "Aún no hay movimientos en la ventana elegida."}
                                        </td>
                                    </tr>
                                )}
                                {movimientos.map(m => {
                                    const abierto = expandido === m.id
                                    return (
                                        <Fragment key={m.id}>
                                            <tr style={{ borderTop: "1px solid var(--border-primary)", cursor: "pointer" }}
                                                onClick={() => setExpandido(abierto ? null : m.id)}>
                                                <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtFechaHora(m.fecha)}</td>
                                                <td style={{ padding: "10px 14px", fontWeight: 800 }}>
                                                    {m.producto}
                                                    {m.variacion && <span style={{ color: "var(--text-muted)", fontWeight: 600 }}> · {m.variacion}</span>}
                                                </td>
                                                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                                    <span style={{ fontWeight: 800, color: COLOR_TIPO[m.tipo] }}>
                                                        {m.tipo === "entrada" ? "Entrada" : m.tipo === "salida" ? "Salida" : "Ajuste"}
                                                    </span>
                                                    <span style={{ color: "var(--text-muted)", fontWeight: 600, marginLeft: 8 }}>
                                                        · {ETIQUETAS_ORIGEN[m.origen] ?? m.origen}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "10px 14px", fontWeight: 800, color: COLOR_TIPO[m.tipo], whiteSpace: "nowrap" }}>
                                                    {fmtCantidad(Number(m.cantidad))}
                                                </td>
                                                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{fmtStock(m.stock_resultante === null ? null : Number(m.stock_resultante))}</td>
                                                <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600 }}>
                                                    {m.concepto || "—"}
                                                </td>
                                                <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                                                    <Icon name={abierto ? "ChevronUp" : "ChevronDown"} size={15} />
                                                </td>
                                            </tr>
                                            {abierto && (
                                                <tr style={{ background: "var(--bg-card2)" }}>
                                                    <td colSpan={7} style={{ padding: "8px 18px", fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                                                        producto_id: {String(m.producto_id ?? "—")}
                                                        {m.id_lote ? ` · id_lote: ${m.id_lote}` : ""}
                                                        {m.referencia_id ? ` · referencia_id: ${m.referencia_id}` : ""}
                                                        {m.variacion ? ` · variación: ${m.variacion}` : ""}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Paginacion
                        total={total} totalPaginas={totalPaginas} pagina={pagina}
                        visibles={movimientos.length}
                        onPrev={() => setPagina(p => Math.max(1, p - 1))}
                        onNext={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    />
                </div>
            ) : (
                /* ── ACTIVIDAD (062) ── */
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 640 }}>
                            <thead>
                                <tr style={{ background: "var(--bg-card2)" }}>
                                    {["Fecha", "Dominio", "Acción", "Detalle"].map(h => (
                                        <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && (
                                    <tr><td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>Cargando actividad…</td></tr>
                                )}
                                {!cargando && eventos.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
                                            Sin actividad en la ventana elegida: aparecerá al editar productos, clientes y cobros.
                                        </td>
                                    </tr>
                                )}
                                {eventos.map(ev => {
                                    const abierto = expandido === ev.id
                                    const campos = ev.detalle ? Object.entries(ev.detalle as Record<string, unknown>) : []
                                    return (
                                        <Fragment key={ev.id}>
                                            <tr style={{ borderTop: "1px solid var(--border-primary)", cursor: "pointer" }}
                                                onClick={() => setExpandido(abierto ? null : ev.id)}>
                                                <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                                    {fmtFechaHora(ev.fecha)}
                                                </td>
                                                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                                    <span style={{
                                                        padding: "3px 10px", borderRadius: 999, fontWeight: 800, fontSize: "0.7rem",
                                                        background: `${COLOR_DOMINIO[ev.dominio]}1a`, color: COLOR_DOMINIO[ev.dominio],
                                                    }}>
                                                        {ETIQUETAS_DOMINIO[ev.dominio]}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                                    <span style={{ fontWeight: 800, color: COLOR_ACCION[ev.accion] }}>
                                                        {ETIQUETAS_ACCION[ev.accion] ?? ev.accion}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "10px 14px" }}>
                                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                                        <span style={{ fontWeight: 700, flex: 1, minWidth: 0 }}>
                                                            {ev.resumen}
                                                            {campos.length > 0 && !abierto && (
                                                                <span style={{ color: "var(--text-muted)", fontWeight: 700, marginLeft: 6 }}>
                                                                    · {campos.length} campo{campos.length > 1 ? "s" : ""}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <Icon name={abierto ? "ChevronUp" : "ChevronDown"} size={15} />
                                                    </div>
                                                </td>
                                            </tr>
                                            {abierto && (
                                                <tr style={{ background: "var(--bg-card2)" }}>
                                                    <td colSpan={4} style={{ padding: "10px 18px" }}>
                                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 6, fontFamily: "monospace" }}>
                                                            {ev.entidad && ev.entidad.length > 4 ? `${ev.dominio}/${ev.entidad}` : ev.dominio}
                                                            {ev.entidad_id ? ` · id: ${ev.entidad_id}` : ""}
                                                        </div>
                                                        {campos.length > 0 ? (
                                                            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                                                                {campos.map(([campo, valor]) => (
                                                                    <li key={campo} style={{ padding: "3px 0", fontSize: "0.78rem" }}>
                                                                        <span style={{ color: "var(--text-muted)", fontWeight: 800 }}>{ETIQUETAS_CAMPO[campo] ?? campo}:</span>{" "}
                                                                        {Array.isArray(valor) && valor.length === 2 ? (
                                                                            <>
                                                                                <span style={{ color: "#b71c1c", textDecoration: "line-through" }}>{fmtValor(valor[0])}</span>
                                                                                <Icon name="ArrowRight" size={12} color="var(--text-muted)" />
                                                                                <span style={{ color: "#047857", fontWeight: 700 }}>{fmtValor(valor[1])}</span>
                                                                            </>
                                                                        ) : (
                                                                            <span style={{ fontWeight: 700 }}>{fmtValor(valor)}</span>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Sin detalle adicional.</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Paginacion
                        total={total} totalPaginas={totalPaginas} pagina={pagina}
                        visibles={eventos.length}
                        onPrev={() => setPagina(p => Math.max(1, p - 1))}
                        onNext={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    />
                </div>
            )}
        </div>
    )
}
