"use client"
// ==============================================================================
// src/app/inventario/page.tsx  —  Rediseño Argon primary -Prueba botón de guardado
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Producto, Lote, NuevoProducto, Restock, Categoria } from "@/lib/api"
import { comprimirImagen } from "@/lib/image-utils"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"
import ImagePicker from "@/components/ui/ImagePicker"
import ScrollableTable from "@/components/ui/ScrollableTable"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

type Tab = "catalogo" | "nuevo" | "restock" | "editar"

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>
            <input {...props} className="input-primary" />
        </div>
    )
}

function Pill({ children, color = "primary" }: { children: React.ReactNode; color?: "primary" | "green" | "red" | "gray" }) {
    const map = { primary: "stat-pill-primary", green: "stat-pill-green", red: "stat-pill-red", gray: "stat-pill-gray" }
    return (
        <span className={map[color]} style={{ fontSize: "0.7rem", fontWeight: 700, borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>
            {children}
        </span>
    )
}

export default function Inventario() {
    const [lotes, setLotes] = useState<Lote[]>([])
    const [inv, setInv] = useState<Producto[]>([])
    const [cargando, setCargando] = useState(true)
    const [tab, setTab] = useState<Tab>("catalogo")
    const [loteEditar, setLoteEditar] = useState<Lote | null>(null)
    const [editLote, setEditLote] = useState({ costo: "" as number | string, precio_venta: "" as number | string, stock: "" as number | string })
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const [form, setForm] = useState({ producto: "", descripcion: "", categoria: ["General"] as string[], costo: "" as number | string, precio_venta: "" as number | string, stock: 1 as number | string, codigo_interno: "", codigo_barras: "", ubicacion: "" })
    const [restock, setRestock] = useState({ producto: "", costo: "" as number | string, precio_venta: "" as number | string, stock: 1 as number | string })
    const [nuevaFoto, setNuevaFoto] = useState<File | null>(null)
    const [editFoto, setEditFoto] = useState<File | null>(null)

    const [prodEditar, setProdEditar] = useState<string>("")
    const [editProdNombre, setEditProdNombre] = useState("")
    const [editProdVal, setEditProdVal] = useState({ descripcion: "", estado: "Activo", imagen: "No hay foto", categoria: ["General"] as string[], codigo_interno: "", codigo_barras: "", ubicacion: "" })
    // Estado para editar lotes individuales dentro del formulario Editar Prod.
    const [loteEditandoId, setLoteEditandoId] = useState<string | null>(null)
    const [editLoteVal, setEditLoteVal] = useState({ costo: "" as number | string, precio_venta: "" as number | string, stock: "" as number | string })
    const [guardando, setGuardando] = useState(false)
    const [nuevaCategoria, setNuevaCategoria] = useState("")
    const [buscadorEditar, setBuscadorEditar] = useState("")
    const [catSelecEditar, setCatSelecEditar] = useState("Todas")

    // Estado para la gestión de categorías
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [nuevaCatNombre, setNuevaCatNombre] = useState("")
    const [catEditandoId, setCatEditandoId] = useState<string | null>(null)
    const [catEditandoNombre, setCatEditandoNombre] = useState("")
    const [cargandoCats, setCargandoCats] = useState(false)

    function agregarCategoria() {
        const cat = nuevaCategoria.trim()
        if (!cat) return
        if (form.categoria.includes(cat)) return
        setForm(f => ({ ...f, categoria: [...f.categoria, cat] }))
        setNuevaCategoria("")
    }


    async function recargar() {
        try {
            const [l, i] = await Promise.all([api.getLotes(), api.getInventario()])
            setLotes(l); setInv(i)
        } catch {
            // Tables might not exist — force creation and retry
            try {
                await api.initDB()
                const [l, i] = await Promise.all([api.getLotes(), api.getInventario()])
                setLotes(l); setInv(i)
            } catch {
                // DB is empty, keep empty state
            }
        }
    }
    /**
     * Carga la lista de categorías desde la API
     * (tabla 'categorias' con conteo de productos asociados)
     */
    async function cargarCategorias() {
        setCargandoCats(true)
        try {
            const cats = await api.getCategorias()
            setCategorias(cats)
        } catch {
            // Si falla, ignoramos silenciosamente
        } finally {
            setCargandoCats(false)
        }
    }

    /**
     * Crea una categoría nueva en la base de datos (tabla 'categorias')
     * y actualiza la lista visual inmediatamente
     */
    async function guardarNuevaCategoria() {
        const nombre = nuevaCatNombre.trim()
        if (!nombre || guardando) return
        setGuardando(true)
        try {
            await api.crearCategoria(nombre)
            setNuevaCatNombre("")
            await Promise.all([cargarCategorias(), recargar()])
            mostrarMsg(true, `✅ Categoría "${nombre}" creada`)
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        } finally {
            setGuardando(false)
        }
    }

    /**
     * Inicia el modo de edición inline para una categoría
     */
    function iniciarEditarCategoria(cat: Categoria) {
        setCatEditandoId(cat.id)
        setCatEditandoNombre(cat.nombre)
    }

    /**
     * Guarda el cambio de nombre de una categoría
     */
    async function guardarEditarCategoria(viejoNombre: string) {
        const nuevo = catEditandoNombre.trim()
        if (!nuevo || nuevo === viejoNombre || guardando) {
            setCatEditandoId(null)
            return
        }
        setGuardando(true)
        try {
            await api.editarCategoria(viejoNombre, nuevo)
            setCatEditandoId(null)
            await Promise.all([cargarCategorias(), recargar()])
            mostrarMsg(true, `✅ Categoría renombrada a "${nuevo}"`)
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        } finally {
            setGuardando(false)
        }
    }

    /**
     * Cancela la edición inline de una categoría
     */
    function cancelarEditarCategoria() {
        setCatEditandoId(null)
        setCatEditandoNombre("")
    }

    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    // Al cambiar al tab "nuevo", cargamos las categorías si no están
    useEffect(() => {
        if (tab === "nuevo") {
            cargarCategorias()
        }
    }, [tab])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    const tablaLotes = lotes.reduce<Record<string, { costo: number; precio: number; stock: number; lote: Lote }[]>>((acc, lote) => {
        if (!acc[lote.producto]) acc[lote.producto] = []
        const key = `${lote.costo}-${lote.precio_venta}`
        const ex = acc[lote.producto].find(g => `${g.costo}-${g.precio}` === key)
        if (ex) { ex.stock += lote.stock_lote }
        else { acc[lote.producto].push({ costo: lote.costo, precio: lote.precio_venta, stock: lote.stock_lote, lote }) }
        return acc
    }, {})

    const productos = Array.from(new Set(lotes.map(l => l.producto))).sort()

    async function guardarNuevo() {
        if (guardando) return
        setGuardando(true)
        try {
            // Ensure tables exist before creating a product
            await api.initDB()
            let imagen = "No hay foto"
            if (nuevaFoto) {
                // Comprimir antes de subir
                const compressedFile = await comprimirImagen(nuevaFoto)
                const r = await api.subirFoto(form.producto, compressedFile)
                imagen = r.ruta
            }
            await api.crearProducto({ ...form, costo: Number(form.costo), precio_venta: Number(form.precio_venta), stock: Number(form.stock), imagen, codigo_interno: form.codigo_interno || undefined, codigo_barras: form.codigo_barras || undefined, ubicacion: form.ubicacion || undefined })
            mostrarMsg(true, `✅ ${form.producto} registrado`)
            setForm({ producto: "", descripcion: "", categoria: ["General"], costo: "", precio_venta: "", stock: 1, codigo_interno: "", codigo_barras: "", ubicacion: "" })
            setNuevaFoto(null)
            setTab("catalogo"); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function guardarRestock() {
        if (guardando) return
        setGuardando(true)
        try {
            const prodActual = inv.find(p => p.producto === restock.producto)
            const precio = restock.precio_venta === "" ? (prodActual?.precio_venta || 0) : Number(restock.precio_venta)
            await api.restockear({ ...restock, costo: Number(restock.costo), stock: Number(restock.stock), precio_venta: precio })
            mostrarMsg(true, `✅ +${Number(restock.stock)} a ${restock.producto}`)
            setTab("catalogo"); recargar()
            setRestock({ producto: "", costo: "", precio_venta: "", stock: 1 })
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function guardarLote() {
        if (!loteEditar || guardando) return
        setGuardando(true)
        try {
            await api.editarLote(loteEditar.id_lote, { costo: Number(editLote.costo), precio_venta: Number(editLote.precio_venta), stock: Number(editLote.stock) })
            mostrarMsg(true, "✅ Lote actualizado")
            setLoteEditar(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function guardarProducto() {
        if (!prodEditar || guardando) return
        setGuardando(true)
        try {
            let nuevaImagen: string | undefined = undefined
            if (editFoto) {
                const compressedFile = await comprimirImagen(editFoto)
                const r = await api.subirFoto(prodEditar, compressedFile)
                nuevaImagen = r.ruta
            }

            const payload: Parameters<typeof api.editarProducto>[1] = {
                descripcion: editProdVal.descripcion,
                imagen: nuevaImagen || editProdVal.imagen,
                estado: editProdVal.estado,
                categoria: editProdVal.categoria,
                producto: editProdNombre,
                codigo_interno: editProdVal.codigo_interno || undefined,
                codigo_barras: editProdVal.codigo_barras || undefined,
                ubicacion: editProdVal.ubicacion || undefined,
            }
            await api.editarProducto(prodEditar, payload)

            mostrarMsg(true, "✅ Producto actualizado")
            setProdEditar(""); setEditProdNombre(""); setEditFoto(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    /** Guarda los cambios de un lote individual desde el formulario Editar Prod. */
    async function guardarLoteIndividual() {
        if (loteEditandoId === null || guardando) return
        setGuardando(true)
        try {
            await api.editarLote(loteEditandoId, { costo: Number(editLoteVal.costo), precio_venta: Number(editLoteVal.precio_venta), stock: Number(editLoteVal.stock) })
            mostrarMsg(true, "✅ Lote actualizado")
            setLoteEditandoId(null)
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function eliminarCategoria(cat: string) {
        if (!confirm(`¿Estás seguro de eliminar la categoría "${cat}"? Se eliminará de todos los productos.`)) return
        try {
            const res = await api.eliminarCategoria(cat) as { productos_actualizados: number }
            mostrarMsg(true, `✅ Categoría "${cat}" eliminada de ${res.productos_actualizados} producto(s)`)
            await Promise.all([recargar(), cargarCategorias()])
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function darDeBaja(producto: string) {
        if (!confirm(`¿Dar de baja ${producto}?`) || guardando) return
        setGuardando(true)
        try {
            const p = inv.find(x => x.producto === producto)
            await api.editarProducto(producto, { descripcion: p?.descripcion ?? "", imagen: p?.imagen ?? "No hay foto", estado: "Inactivo", categoria: p?.categoria ?? ["General"] })
            mostrarMsg(true, `✅ ${producto} dado de baja`); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: "catalogo", label: "Inventario", icon: "ClipboardList" },
        { id: "nuevo", label: "Nuevo", icon: "ClipboardPlus" },
        { id: "restock", label: "Restock", icon: "PackagePlus" },
        { id: "editar", label: "Editar Prod.", icon: "Pencil" },
    ]

    const totalActivos = inv.filter(p => p.stock_total > 0).length
    const valorInv = inv.reduce((a, p) => a + p.stock_total * p.precio_venta, 0)
    const ganPotencial = inv.reduce((a, p) => a + p.stock_total * (p.precio_venta - p.costo_promedio), 0)
    const stockDesc = inv.filter(p => p.stock_total <= 0).length
    // Categorías disponibles: combina las que están en uso por productos + las de la tabla 'categorias'
    // Al unir ambas fuentes, las categorías recién creadas aparecen como chips cliqueables inmediatamente
    const categoriasExistentes = Array.from(new Set([
        ...inv.flatMap(p => (p.categoria || ["General"]).map(c => c.trim())),
        ...categorias.map(c => c.nombre)
    ])).sort()
    const productosEditar = inv.filter(p => {
        const b = buscadorEditar.toLowerCase()
        const porBusqueda = !b || p.producto.toLowerCase().includes(b) ||
            p.descripcion?.toLowerCase().includes(b) ||
            (p.categoria || ["General"]).join(" ").toLowerCase().includes(b)
        const porCategoria = catSelecEditar === "Todas" || (p.categoria || ["General"]).includes(catSelecEditar)
        return porBusqueda && porCategoria
    })

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero con Antigravity ── */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--gradient-2)", padding: "32px 24px 90px" }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                    <Antigravity
                        count={400}
                        magnetRadius={12}
                        ringRadius={8}
                        waveSpeed={0.5}
                        waveAmplitude={1.2}
                        particleSize={1.5}
                        lerpSpeed={0.08}
                        color="var(--ag-color-2)"
                        autoAnimate={true}
                        particleVariance={0.8}
                        rotationSpeed={0.3}
                        depthFactor={0.5}
                        pulseSpeed={2}
                        particleShape="capsule"
                        fieldStrength={8}
                    />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    <p style={{ color: "var(--primary-darkGray)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>GESTIÓN</p>
                    <h1 style={{ color: "var(--primary-dark)", fontSize: "1.7rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "12px" }}>
                        <Icon name="Package" size={32} color="var(--primary-dark)" />
                        <span>Inventario</span>
                    </h1>
                </div>
            </div>

            <div style={{ padding: "0 24px", marginTop: -60, overflowX: "hidden" }}>
                {/* Stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }} className="md:grid-cols-4">
                    {[
                        { label: "Productos activos", valor: totalActivos, icon: "PackagePlus" },
                        { label: "Valor del inventario", valor: `$${valorInv.toFixed(0)}`, icon: "PiggyBank" },
                        { label: "Ganancia potencial", valor: `$${ganPotencial.toFixed(0)}`, icon: "Banknote" },
                        { label: "Stock descuadrado", valor: stockDesc, icon: "TriangleAlert" },
                    ].map(m => (
                        <div key={m.label} className="card fade-up" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ background: "var(--gradient-1)", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.1rem" }}>
                                <Icon name={m.icon as any} size={24} color="var(--primary-soft)" />
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{m.label}</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>{m.valor}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Mensaje */}
                {msg && (
                    <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 12, borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#f44336"}`, color: msg.ok ? "#2e7d32" : "#b71c1c", fontSize: "0.875rem", fontWeight: 600 }}>
                        {msg.texto}
                    </div>
                )}

                {/* Tabs */}
                <div className="card" style={{ display: "flex", padding: 6, gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flex: 1, minWidth: 80, padding: "8px 12px", gap: 8, borderRadius: 10, border: "none",
                            background: tab === t.id ? "var(--gradient-1)" : "transparent",
                            color: tab === t.id ? "#fff" : "var(--text-muted)",
                            fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", transition: "all 0.2s",
                        }}>
                            <Icon name={t.icon as any} size={22} color={tab === t.id ? "#fff" : "var(--text-muted)"} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Catálogo */}
                {tab === "catalogo" && !cargando && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {productos.map(producto => {
                            const grupos = tablaLotes[producto] ?? []
                            const stockTotal = grupos.reduce((a, g) => a + g.stock, 0)
                            return (
                                <div key={producto} className="card fade-up" style={{ overflow: "hidden" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-app)", borderBottom: "1px solid var(--border-light)", gap: 10 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{producto}</span>
                                            <Pill color="gray">{(inv.find(p => p.producto === producto)?.categoria || ["General"]).join(", ")}</Pill>
                                            <Pill color={stockTotal <= 3 ? "red" : "green"}>{stockTotal} en stock</Pill>
                                        </div>
                                        <button onClick={() => darDeBaja(producto)} disabled={guardando} style={{ background: guardando ? "#eee" : "#ad4955ff", color: guardando ? "#999" : "#ffffffff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: "0.75rem", fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer" }}>
                                            {guardando ? "⏳" : "Dar de baja"}
                                        </button>
                                    </div>
                                    <ScrollableTable>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                                            <thead>
                                                <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>
                                                    {["Costo unit.", "Precio venta", "Stock", "Margen", ""].map(h => (
                                                        <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {grupos.map((g, i) => (
                                                    <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card2)")}
                                                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            {loteEditar?.id_lote === g.lote.id_lote ? (
                                                                <input type="number" min={0} step="0.01" value={editLote.costo} placeholder="0.00" onChange={e => setEditLote(l => ({ ...l, costo: e.target.value === "" ? "" : Number(e.target.value) }))} className="input-primary" style={{ width: 80, padding: 4 }} />
                                                            ) : `$${g.costo.toFixed(2)}`}
                                                        </td>
                                                        <td style={{ padding: "10px 16px", fontWeight: 700, color: "var(--text-main)" }}>
                                                            {loteEditar?.id_lote === g.lote.id_lote ? (
                                                                <input type="number" min={0} step="0.01" value={editLote.precio_venta} placeholder="0.00" onChange={e => setEditLote(l => ({ ...l, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))} className="input-primary" style={{ width: 80, padding: 4 }} />
                                                            ) : `$${g.precio.toFixed(2)}`}
                                                        </td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            {loteEditar?.id_lote === g.lote.id_lote ? (
                                                                <input type="number" min={0} value={editLote.stock} placeholder="0" onChange={e => setEditLote(l => ({ ...l, stock: e.target.value === "" ? "" : Number(e.target.value) }))} className="input-primary" style={{ width: 80, padding: 4 }} />
                                                            ) : g.stock}
                                                        </td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            <Pill color={g.precio > g.costo ? "green" : "red"}>
                                                                {g.precio > 0 ? `${(((g.precio - g.costo) / g.precio) * 100).toFixed(0)}%` : "—"}
                                                            </Pill>
                                                        </td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            {loteEditar?.id_lote === g.lote.id_lote ? (
                                                                <div style={{ display: "flex", gap: 8 }}>
                                                                    <button onClick={guardarLote} disabled={guardando} style={{ color: guardando ? "#999" : "#2e7d32", background: "none", border: "none", fontWeight: 800, cursor: guardando ? "not-allowed" : "pointer" }}>
                                                                        {guardando ?
                                                                            (<Icon name="Hourglass" size={16} color="var(--primary-dark)" />) :
                                                                            (<Icon name="Save" size={16} color="var(--primary-dark)" />)
                                                                        }
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => { setLoteEditar(g.lote); setEditLote({ costo: g.costo, precio_venta: g.precio, stock: g.stock }) }}
                                                                    style={{ background: "none", border: "none", color: "var(--primary-mid)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>
                                                                    Editar lote
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </ScrollableTable>
                                </div>
                            )
                        })}
                        {productos.length === 0 && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>No hay productos registrados.</p>}
                    </div>
                )}
                {tab === "catalogo" && cargando && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Cargando inventario...</p>}

                {/* Nuevo producto + Gestión de categorías */}
                {tab === "nuevo" && (
                    <div style={{ display: "flex", gap: 16, width: "100%" }} className="flex-col md:flex-row md:items-stretch">
                        {/* ── Card: Dar de alta producto ── */}
                        <div className="card fade-up md:flex-1" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                            <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>Dar de alta producto</h2>
                            <Input label="Nombre del producto" value={form.producto} onChange={e => setForm(p => ({ ...p, producto: e.target.value }))} />
                            <Input label="Descripción" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                <Input label="Código interno" value={form.codigo_interno} onChange={e => setForm(p => ({ ...p, codigo_interno: e.target.value }))} />
                                <Input label="Código de barras" value={form.codigo_barras} onChange={e => setForm(p => ({ ...p, codigo_barras: e.target.value }))} />
                                <Input label="Ubicación" value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8 }}>Categorías</label>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {/* Chips de categorías existentes */}
                                    {categoriasExistentes.map(cat => {
                                        const activa = form.categoria.includes(cat)
                                        return (
                                            <button
                                                key={cat}
                                                onClick={() => setForm(f => ({
                                                    ...f,
                                                    categoria: activa
                                                        ? f.categoria.filter(c => c !== cat)
                                                        : [...f.categoria, cat]
                                                }))}
                                                style={{
                                                    background: activa ? "var(--primary-mid)" : "var(--bg-card2)",
                                                    color: activa ? "#fff" : "var(--primary-text)",
                                                    border: "none", borderRadius: 12,
                                                    padding: "4px 10px", fontSize: "0.65rem", fontWeight: 700,
                                                    cursor: "pointer", transition: "all 0.15s"
                                                }}
                                            >
                                                {cat} {activa ? "✓" : "+"}
                                            </button>
                                        )
                                    })}
                                </div>
                                {/* Input rápido para crear una categoría nueva */}
                                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                                    <input
                                        type="text"
                                        placeholder="Nueva categoría..."
                                        value={nuevaCategoria}
                                        onChange={e => setNuevaCategoria(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") agregarCategoria() }}
                                        style={{
                                            flex: 1,
                                            padding: "6px 10px",
                                            borderRadius: 10,
                                            border: "1px solid var(--border-primary)",
                                            fontSize: "0.78rem",
                                            outline: "none",
                                            background: "var(--bg-card2)",
                                            color: "var(--text-main)"
                                        }}
                                    />
                                    <button
                                        onClick={agregarCategoria}
                                        disabled={!nuevaCategoria.trim()}
                                        style={{
                                            background: nuevaCategoria.trim() ? "var(--primary-mid)" : "var(--bg-card2)",
                                            color: nuevaCategoria.trim() ? "#fff" : "var(--text-muted)",
                                            border: "none", borderRadius: 10,
                                            padding: "6px 14px", fontWeight: 700, fontSize: "0.8rem",
                                            cursor: nuevaCategoria.trim() ? "pointer" : "not-allowed",
                                            transition: "all 0.15s",
                                            whiteSpace: "nowrap"
                                        }}
                                    >
                                        + Crear
                                    </button>
                                </div>
                            </div>
                            <ImagePicker onImageSelected={setNuevaFoto} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                <Input label="Cantidad" type="number" min={1} placeholder="1" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value === "" ? "" : Number(e.target.value) }))} />
                                <Input label="Costo" type="number" min={0} step="0.01" placeholder="0.00" value={form.costo} onChange={e => setForm(p => ({ ...p, costo: e.target.value === "" ? "" : Number(e.target.value) }))} />
                                <Input label="Precio" type="number" min={0} step="0.01" placeholder="0.00" value={form.precio_venta} onChange={e => setForm(p => ({ ...p, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))} />
                            </div>
                            <button className="btn-primary" onClick={guardarNuevo} disabled={guardando || !form.producto || form.precio_venta === "" || form.precio_venta === 0}>
                                {guardando ? "⏳ Procesando..." : " Dar de Alta"}
                            </button>
                        </div>

                        {/* ── Card: Gestionar Categorías ── */}
                        <div className="card fade-up md:flex-1" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                            <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                                <Icon name="Tags" size={20} color="var(--primary-mid)" />
                                Gestionar Categorías
                            </h2>
                            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, fontWeight: 600, flexShrink: 0 }}>
                                Crea, renombra o elimina las categorías de tu inventario.
                            </p>

                            {/* Input para crear nueva categoría — fijo arriba */}
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                                <input
                                    type="text"
                                    placeholder="Nombre de la nueva categoría..."
                                    value={nuevaCatNombre}
                                    onChange={e => setNuevaCatNombre(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") guardarNuevaCategoria() }}
                                    style={{
                                        flex: 1,
                                        padding: "8px 12px",
                                        borderRadius: 10,
                                        border: "1px solid var(--border-primary)",
                                        fontSize: "0.8rem",
                                        outline: "none",
                                        background: "var(--bg-card2)",
                                        color: "var(--text-main)"
                                    }}
                                />
                                <button
                                    onClick={guardarNuevaCategoria}
                                    disabled={!nuevaCatNombre.trim() || guardando}
                                    style={{
                                        background: nuevaCatNombre.trim() && !guardando ? "var(--primary-mid)" : "var(--bg-card2)",
                                        color: nuevaCatNombre.trim() && !guardando ? "#fff" : "var(--text-muted)",
                                        border: "none", borderRadius: 10,
                                        padding: "8px 16px", fontWeight: 700, fontSize: "0.78rem",
                                        cursor: nuevaCatNombre.trim() && !guardando ? "pointer" : "not-allowed",
                                        transition: "all 0.15s",
                                        whiteSpace: "nowrap",
                                        display: "flex", alignItems: "center", gap: 6
                                    }}
                                >
                                    <Icon name="Plus" size={16} color={nuevaCatNombre.trim() && !guardando ? "#fff" : "var(--text-muted)"} /> Crear
                                </button>
                            </div>

                            {/* Separador */}
                            <div style={{ height: 1, background: "var(--border-light)", margin: "4px 0", flexShrink: 0 }} />

                            {/* Lista de categorías existentes — scrollable si sobran */}
                            {cargandoCats ? (
                                <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20, fontSize: "0.8rem" }}>
                                    Cargando categorías...
                                </p>
                            ) : categorias.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "24px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>
                                        Aún no hay categorías. ¡Crea la primera!
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1, minHeight: 0, scrollbarWidth: "thin" }}>
                                    {categorias.map(cat => {
                                        const editando = catEditandoId === cat.id
                                        return (
                                            <div
                                                key={cat.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    padding: "8px 12px",
                                                    borderRadius: 10,
                                                    background: "var(--bg-card2)",
                                                    transition: "all 0.15s"
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = "var(--border-light)" }}
                                                onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card2)" }}
                                            >
                                                {editando ? (
                                                    /* Modo edición: input inline */
                                                    <>
                                                        <input
                                                            type="text"
                                                            value={catEditandoNombre}
                                                            onChange={e => setCatEditandoNombre(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") guardarEditarCategoria(cat.nombre)
                                                                if (e.key === "Escape") cancelarEditarCategoria()
                                                            }}
                                                            autoFocus
                                                            style={{
                                                                flex: 1,
                                                                padding: "4px 8px",
                                                                borderRadius: 6,
                                                                border: "2px solid var(--primary-mid)",
                                                                fontSize: "0.78rem",
                                                                outline: "none",
                                                                background: "var(--bg-app)",
                                                                color: "var(--text-main)"
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => guardarEditarCategoria(cat.nombre)}
                                                            disabled={guardando || !catEditandoNombre.trim()}
                                                            style={{
                                                                background: "var(--primary-mid)", color: "#fff",
                                                                border: "none", borderRadius: 8,
                                                                padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700,
                                                                cursor: guardando || !catEditandoNombre.trim() ? "not-allowed" : "pointer",
                                                                display: "flex", alignItems: "center", gap: 4
                                                            }}
                                                        >
                                                            <Icon name="Check" size={14} color="#fff" />
                                                        </button>
                                                        <button
                                                            onClick={cancelarEditarCategoria}
                                                            style={{
                                                                background: "var(--bg-card2)", color: "var(--text-muted)",
                                                                border: "none", borderRadius: 8,
                                                                padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700,
                                                                cursor: "pointer"
                                                            }}
                                                        >
                                                            <Icon name="X" size={14} color="var(--text-muted)" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    /* Modo vista: nombre + contador + acciones */
                                                    <>
                                                        <Icon name="Tag" size={16} color="var(--primary-mid)" />
                                                        <span style={{ flex: 1, fontWeight: 600, fontSize: "0.8rem", color: "var(--text-main)" }}>
                                                            {cat.nombre}
                                                        </span>
                                                        <span style={{
                                                            fontSize: "0.62rem",
                                                            fontWeight: 700,
                                                            color: "var(--text-secondary)",
                                                            background: "var(--bg-app)",
                                                            borderRadius: 8,
                                                            padding: "2px 8px",
                                                            whiteSpace: "nowrap"
                                                        }}>
                                                            {cat.total_productos} prod.
                                                        </span>
                                                        <button
                                                            onClick={() => iniciarEditarCategoria(cat)}
                                                            title={`Renombrar "${cat.nombre}"`}
                                                            style={{
                                                                background: "none", border: "none",
                                                                cursor: "pointer", padding: 4,
                                                                borderRadius: 6,
                                                                display: "flex", alignItems: "center",
                                                                opacity: 0.5, transition: "opacity 0.15s"
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.opacity = "1" }}
                                                            onMouseLeave={e => { e.currentTarget.style.opacity = "0.5" }}
                                                        >
                                                            <Icon name="Pencil" size={14} color="var(--primary-mid)" />
                                                        </button>
                                                        <button
                                                            onClick={() => eliminarCategoria(cat.nombre)}
                                                            title={`Eliminar "${cat.nombre}"`}
                                                            style={{
                                                                background: "none", border: "none",
                                                                cursor: "pointer", padding: 4,
                                                                borderRadius: 6,
                                                                display: "flex", alignItems: "center",
                                                                opacity: 0.4, transition: "opacity 0.15s"
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#e74c3c" }}
                                                            onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = "" }}
                                                        >
                                                            <Icon name="Trash2" size={14} color="#e74c3c" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Restock */}
                {tab === "restock" && (
                    <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}> Añadir stock</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Producto</label>
                            <select className="input-primary" value={restock.producto}
                                onChange={e => {
                                    const p = inv.find(x => x.producto === e.target.value)
                                    setRestock(r => ({ ...r, producto: e.target.value, costo: p?.costo_promedio ?? 0, precio_venta: p?.precio_venta ?? 0 }))
                                }}>
                                <option value="">— Selecciona —</option>
                                {productos.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>Costo y precio prellenados del último lote. Cámbialos si el nuevo lote es diferente.</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <Input label="Cantidad" type="number" min={1} placeholder="1" value={restock.stock} onChange={e => setRestock(r => ({ ...r, stock: e.target.value === "" ? "" : Number(e.target.value) }))} />
                            <Input label="Costo" type="number" min={0} step="0.01" placeholder="0.00" value={restock.costo} onChange={e => setRestock(r => ({ ...r, costo: e.target.value === "" ? "" : Number(e.target.value) }))} />
                            <Input label="Precio" type="number" min={0} step="0.01" placeholder="0.00" value={restock.precio_venta} onChange={e => setRestock(r => ({ ...r, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))} />
                        </div>
                        <button className="btn-primary" onClick={guardarRestock} disabled={guardando || !restock.producto || !restock.stock || Number(restock.stock) <= 0}>
                            {guardando ? "⏳ Procesando..." : "Añadir Stock"}
                        </button>
                    </div>
                )}

                {/* Editar producto — buscador */}
                {tab === "editar" && !prodEditar && (
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
                                        boxShadow: catSelecEditar === cat ? "0 4px 10px var(--primary-glow)" : "none"
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
                            <Icon name="Search" size={20} color="var(--text-muted)" />
                            <input
                                className="input-primary"
                                style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                                placeholder="Buscar producto por nombre, código o categoría..."
                                value={buscadorEditar}
                                onChange={e => setBuscadorEditar(e.target.value)}
                            />
                        </div>

                        {cargando ? (
                            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Cargando productos...</p>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                                {productosEditar.length === 0 ? (
                                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                                        <span style={{ fontSize: "4rem", display: "block", marginBottom: 16 }}>😿</span>
                                        <h2 style={{ fontSize: "1.5rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 8px" }}>Sin resultados</h2>
                                        <p style={{ fontSize: "1rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>Intenta con otra búsqueda o categoría</p>
                                    </div>
                                ) : (
                                    productosEditar.map(prod => (
                                        <div
                                            key={prod.producto}
                                            className="card fade-up"
                                            style={{ padding: 12, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                                            onClick={() => {
                                                setProdEditar(prod.producto)
                                                setEditProdNombre(prod.producto)
                                                setLoteEditandoId(null)
                                                setEditProdVal({
                                                    descripcion: prod.descripcion ?? "",
                                                    estado: prod.estado ?? "Activo",
                                                    imagen: prod.imagen ?? "No hay foto",
                                                    categoria: prod.categoria ?? ["General"],
                                                    codigo_interno: prod.codigo_interno ?? "",
                                                    codigo_barras: prod.codigo_barras ?? "",
                                                    ubicacion: prod.ubicacion ?? "",
                                                })
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.transform = "translateY(-3px)"
                                                e.currentTarget.style.boxShadow = "0 8px 30px var(--primary-glow)"
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = ""
                                                e.currentTarget.style.boxShadow = ""
                                            }}
                                        >
                                            <div style={{ aspectRatio: "1", borderRadius: 12, background: "var(--gradient-bg-login)", marginBottom: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {prod.imagen && prod.imagen !== "No hay foto" ? (
                                                    <img src={prod.imagen.startsWith("http") ? prod.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${prod.imagen}`}
                                                        alt={prod.producto}
                                                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                                                ) : (
                                                    <span style={{ fontSize: "2rem" }}>🛍️</span>
                                                )}
                                            </div>
                                            <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.producto}</p>
                                            <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>${prod.precio_venta.toFixed(2)}</p>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px" }}>{(prod.categoria || ["General"]).join(", ")}</span>
                                                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: prod.stock_total < 0 ? "#b71c1c" : "#2e7d32", background: prod.stock_total < 0 ? "#ffeef0" : "#e8f5e9", borderRadius: 6, padding: "2px 6px" }}>Stock: {prod.stock_total}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Editar producto — formulario + lotes */}
                {tab === "editar" && prodEditar && (
                    <>
                        {/* ── Card 1: Información del producto ── */}
                        <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <button
                                    onClick={() => { setProdEditar(""); setBuscadorEditar(""); setCatSelecEditar("Todas"); setLoteEditandoId(null) }}
                                    style={{ background: "var(--bg-card2)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}
                                >
                                    <Icon name="ArrowLeft" size={18} color="var(--text-main)" /> Volver
                                </button>
                                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-muted)" }}>Editando: <strong style={{ color: "var(--text-main)" }}>{prodEditar}</strong></span>
                            </div>
                            <Input label="Nombre del producto" value={editProdNombre} onChange={e => setEditProdNombre(e.target.value)} />

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                <Input label="Código interno" value={editProdVal.codigo_interno} onChange={e => setEditProdVal(p => ({ ...p, codigo_interno: e.target.value }))} />
                                <Input label="Código de barras" value={editProdVal.codigo_barras} onChange={e => setEditProdVal(p => ({ ...p, codigo_barras: e.target.value }))} />
                                <Input label="Ubicación" value={editProdVal.ubicacion} onChange={e => setEditProdVal(p => ({ ...p, ubicacion: e.target.value }))} />
                            </div>

                            <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8 }}>Categorías</label>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {categoriasExistentes.map(cat => {
                                        const activa = editProdVal.categoria.includes(cat)
                                        return (
                                            <button
                                                key={cat}
                                                onClick={() => setEditProdVal(p => ({ ...p, categoria: activa ? p.categoria.filter(c => c !== cat) : [...p.categoria, cat] }))}
                                                style={{ background: activa ? "var(--primary-mid)" : "var(--bg-card2)", color: activa ? "#fff" : "var(--text-main)", border: "none", borderRadius: 12, padding: "6px 14px", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                                            >{cat} {activa ? "✓" : "+"}</button>
                                        )
                                    })}
                                </div>
                                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>Selecciona las categorías que aplican a este producto</p>
                            </div>
                            <Input label="Descripción o código" value={editProdVal.descripcion} onChange={e => setEditProdVal(p => ({ ...p, descripcion: e.target.value }))} />

                            <ImagePicker
                                onImageSelected={setEditFoto}
                                currentImageUrl={editProdVal.imagen !== "No hay foto" ? editProdVal.imagen : undefined}
                                label="Actualizar Foto (Opcional)"
                            />

                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Estado</label>
                                <select className="input-primary" value={editProdVal.estado} onChange={e => setEditProdVal(p => ({ ...p, estado: e.target.value }))}>
                                    <option value="Activo">Activo</option>
                                    <option value="Inactivo">Inactivo</option>
                                </select>
                            </div>

                            <button className="btn-primary" onClick={guardarProducto} disabled={guardando}>
                                {guardando ? "⏳ Procesando..." : "Guardar Cambios"}
                            </button>
                        </div>

                        {/* ── Card 2: Editar lotes individuales ── */}
                        <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
                            <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                                <Icon name="Package" size={20} color="var(--primary-mid)" />
                                Lotes de {prodEditar}
                                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "auto" }}>
                                    {lotes.filter(l => l.producto === prodEditar).length} lote(s)
                                </span>
                            </h2>
                            <ScrollableTable>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                                    <thead>
                                        <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>
                                            {["ID", "Costo unit.", "Precio venta", "Stock", "Margen", ""].map(h => (
                                                <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lotes.filter(l => l.producto === prodEditar).map(lote => {
                                            const editando = loteEditandoId === lote.id_lote
                                            const margen = lote.precio_venta > 0 ? ((lote.precio_venta - lote.costo) / lote.precio_venta) * 100 : 0
                                            return (
                                                <tr key={lote.id_lote} style={{ borderBottom: "1px solid var(--border-light)" }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card2)")}
                                                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                                                    <td style={{ padding: "8px 12px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                        #{lote.id_lote}
                                                    </td>
                                                    <td style={{ padding: "8px 12px" }}>
                                                        {editando ? (
                                                            <input type="number" min={0} step="0.01" value={editLoteVal.costo} placeholder="0.00"
                                                                onChange={e => setEditLoteVal(l => ({ ...l, costo: e.target.value === "" ? "" : Number(e.target.value) }))}
                                                                className="input-primary" style={{ width: 80, padding: 4 }} />
                                                        ) : `$${lote.costo.toFixed(2)}`}
                                                    </td>
                                                    <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text-main)" }}>
                                                        {editando ? (
                                                            <input type="number" min={0} step="0.01" value={editLoteVal.precio_venta} placeholder="0.00"
                                                                onChange={e => setEditLoteVal(l => ({ ...l, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))}
                                                                className="input-primary" style={{ width: 80, padding: 4 }} />
                                                        ) : `$${lote.precio_venta.toFixed(2)}`}
                                                    </td>
                                                    <td style={{ padding: "8px 12px" }}>
                                                        {editando ? (
                                                            <input type="number" min={0} value={editLoteVal.stock} placeholder="0"
                                                                onChange={e => setEditLoteVal(l => ({ ...l, stock: e.target.value === "" ? "" : Number(e.target.value) }))}
                                                                className="input-primary" style={{ width: 80, padding: 4 }} />
                                                        ) : lote.stock_lote}
                                                    </td>
                                                    <td style={{ padding: "8px 12px" }}>
                                                        <Pill color={margen > 0 ? "green" : "red"}>
                                                            {lote.precio_venta > 0 ? `${margen.toFixed(0)}%` : "—"}
                                                        </Pill>
                                                    </td>
                                                    <td style={{ padding: "8px 12px" }}>
                                                        {editando ? (
                                                            <div style={{ display: "flex", gap: 6 }}>
                                                                <button onClick={guardarLoteIndividual} disabled={guardando}
                                                                    style={{ background: "none", border: "none", fontWeight: 800, cursor: guardando ? "not-allowed" : "pointer", padding: 4 }}>
                                                                    {guardando ?
                                                                        (<Icon name="Hourglass" size={16} color="var(--primary-dark)" />) :
                                                                        (<Icon name="Save" size={16} color="var(--primary-dark)" />)
                                                                    }
                                                                </button>
                                                                <button onClick={() => setLoteEditandoId(null)}
                                                                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)" }}>
                                                                    <Icon name="X" size={16} color="var(--text-muted)" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => {
                                                                setLoteEditandoId(lote.id_lote)
                                                                setEditLoteVal({ costo: lote.costo, precio_venta: lote.precio_venta, stock: lote.stock_lote })
                                                            }}
                                                                style={{ background: "none", border: "none", color: "var(--primary-mid)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", padding: 4 }}>
                                                                Editar
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {lotes.filter(l => l.producto === prodEditar).length === 0 && (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: "center", padding: "24px 12px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                                    No hay lotes registrados para este producto.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </ScrollableTable>
                        </div>
                    </>
                )}

                <div style={{ height: 20 }} />
            </div>
        </div>
    )
}
