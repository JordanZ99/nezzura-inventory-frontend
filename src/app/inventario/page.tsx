"use client"
// ==============================================================================
// src/app/inventario/page.tsx  —  Rediseño Argon primary -Prueba botón de guardado
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Producto, Lote, NuevoProducto, Restock, Categoria } from "@/lib/api"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"
import GaleriaProducto, { type FotoGaleria } from "@/components/ui/GaleriaProducto"
// comprimirImagen se usa para comprimir las imágenes antes de subirlas
import { comprimirImagen } from "@/lib/image-utils"
import ScrollableTable from "@/components/ui/ScrollableTable"
import { useTenant } from "@/contexts/TenantContext"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

type Tab = "nuevo" | "restock" | "editar"

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
    const { tenant } = useTenant()

    const [lotes, setLotes] = useState<Lote[]>([])
    const [inv, setInv] = useState<Producto[]>([])
    const [tab, setTab] = useState<Tab>("nuevo")

    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const [form, setForm] = useState({ producto: "", descripcion: "", categoria: ["General"] as string[], costo: "" as number | string, precio_venta: "" as number | string, stock: 1 as number | string, codigo_interno: "", codigo_barras: "", ubicacion: "" })
    const [restock, setRestock] = useState({ producto: "", costo: "" as number | string, precio_venta: "" as number | string, stock: 1 as number | string })
    const [nuevasFotos, setNuevasFotos] = useState<FotoGaleria[]>([])
    const [editFotos, setEditFotos] = useState<FotoGaleria[]>([])

    const [prodEditar, setProdEditar] = useState<string>("")
    const [editProdNombre, setEditProdNombre] = useState("")
    const [editProdVal, setEditProdVal] = useState({ descripcion: "", estado: "Activo", imagen: "No hay foto", categoria: ["General"] as string[], codigo_interno: "", codigo_barras: "", ubicacion: "" })

    // ── Galería unificada de fotos (principal + extras) ──
    // Ahora la foto principal es simplemente la primera del array (índice 0).
    // El componente GaleriaProducto maneja el carrusel, subida, reemplazo y eliminación.

    // Estado para editar lotes individuales dentro del formulario Editar Prod.
    const [loteEditandoId, setLoteEditandoId] = useState<string | null>(null)
    const [editLoteVal, setEditLoteVal] = useState({ costo: "" as number | string, precio_venta: "" as number | string, stock: "" as number | string })
    // Estado para el diálogo de confirmación persistente al dar de baja un lote
    // Contiene el id del lote pendiente de confirmación; no se cierra hasta eliminar o recargar
    const [loteEliminarConfirm, setLoteEliminarConfirm] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [nuevaCategoria, setNuevaCategoria] = useState("")
    const [buscadorEditar, setBuscadorEditar] = useState("")
    const [catSelecEditar, setCatSelecEditar] = useState("Todas")

    // ── Estados para el Restock con buscador (como Editar Prod.) ──
    const [restockBuscador, setRestockBuscador] = useState("")
    const [restockCatSelec, setRestockCatSelec] = useState("Todas")
    const [restockProdSeleccionado, setRestockProdSeleccionado] = useState<Producto | null>(null)
    // ── Ordenamiento del grid de Restock (default: menor stock primero) ──
    const [restockOrdenamiento, setRestockOrdenamiento] = useState("stock-desc")

    // Estado para la gestión de categorías
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [nuevaCatNombre, setNuevaCatNombre] = useState("")
    const [catEditandoId, setCatEditandoId] = useState<string | null>(null)
    const [catEditandoNombre, setCatEditandoNombre] = useState("")
    const [cargandoCats, setCargandoCats] = useState(false)
    const [confirmEliminarCat, setConfirmEliminarCat] = useState<string | null>(null)
    // ── Estado para la explicación de cada KPI (popup informativo) ──
    const [kpiExplicacion, setKpiExplicacion] = useState<string | null>(null)

    // ── Explicaciones de cada KPI en lenguaje entendible ──
    const explicacionesKPI: Record<string, { descripcion: string; formula: string }> = {
        "Productos activos": {
            descripcion: "Son los productos que actualmente tienen existencia en tu inventario, es decir, su stock es mayor a 0. No importa si tienen poco o mucho, mientras tengan al menos 1 unidad cuentan como activos.",
            formula: "Productos con stock > 0"
        },
        "Valor del inventario": {
            descripcion: "Es el valor total de todo tu inventario si vendieras cada producto a su precio actual. Se calcula sumando el precio de venta de cada unidad que tienes en existencia.",
            formula: "Suma de (stock actual × precio de venta) de cada producto"
        },
        "Ganancia potencial": {
            descripcion: "Es la ganancia que obtendrías si lograras vender todo tu inventario actual al precio de venta. No considera gastos operativos, solo la diferencia entre lo que pagaste por los productos (costo promedio) y lo que los vendes.",
            formula: "Suma de [stock × (precio de venta − costo promedio)]"
        },
        "Stock descuadrado": {
            descripcion: "Son los productos que tienen stock en 0 o incluso negativo. Stock negativo significa que se vendieron más unidades de las que había registradas. Revisa estos productos para corregir su inventario.",
            formula: "Productos con stock ≤ 0"
        }
    }

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
            mostrarMsg(true, `Categoría "${nombre}" creada`)
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`)
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
            mostrarMsg(true, `Categoría renombrada a "${nuevo}"`)
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`)
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

    useEffect(() => { recargar() }, [])

    // Al cambiar al tab "nuevo", cargamos las categorías si no están
    useEffect(() => {
        if (tab === "nuevo") {
            cargarCategorias()
        }
    }, [tab])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    const productos = Array.from(new Set(lotes.map(l => l.producto))).sort()

    async function guardarNuevo() {
        if (guardando) return
        setGuardando(true)
        try {
            // Ensure tables exist before creating a product
            await api.initDB()

            // ── Foto principal: la primera del array (índice 0) ──
            let imagen = "No hay foto"
            const principal = nuevasFotos[0]
            if (principal?.file) {
                const sizeMB = principal.file.size / (1024 * 1024)
                if (sizeMB > 10) {
                    mostrarMsg(false, `La imagen pesa ${sizeMB.toFixed(1)} MB. El máximo es 10 MB.`)
                    setGuardando(false)
                    return
                }
                const r = await api.subirFoto(form.producto, principal.file)
                imagen = r.ruta
            }

            // Crear el producto con la foto principal
            await api.crearProducto({ ...form, costo: Number(form.costo), precio_venta: Number(form.precio_venta), stock: Number(form.stock), imagen, codigo_interno: form.codigo_interno || undefined, codigo_barras: form.codigo_barras || undefined, ubicacion: form.ubicacion || undefined })
            mostrarMsg(true, `${form.producto} registrado`)

            // ── Subir fotos adicionales (índices 1+) si hay ──
            const extras = nuevasFotos.slice(1)
            for (const extra of extras) {
                if (!extra.file) continue
                try {
                    let imgAEnviar = extra.file
                    try { imgAEnviar = await comprimirImagen(extra.file) }
                    catch { /* enviar original si falla */ }
                    await api.subirImagenExtra(form.producto, imgAEnviar)
                } catch {
                    console.warn("Error subiendo imagen extra para", form.producto)
                }
            }

            setNuevasFotos([])
            setForm({ producto: "", descripcion: "", categoria: ["General"], costo: "", precio_venta: "", stock: 1, codigo_interno: "", codigo_barras: "", ubicacion: "" })
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function guardarRestock() {
        if (guardando) return
        setGuardando(true)
        try {
            const prodActual = inv.find(p => p.producto === restock.producto)
            const precio = restock.precio_venta === "" ? (prodActual?.precio_venta || 0) : Number(restock.precio_venta)
            await api.restockear({ ...restock, costo: Number(restock.costo), stock: Number(restock.stock), precio_venta: precio })
            mostrarMsg(true, `+${Number(restock.stock)} a ${restock.producto}`)
            recargar()
            setRestockProdSeleccionado(null)
            setRestock({ producto: "", costo: "", precio_venta: "", stock: 1 })
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function guardarProducto() {
        if (!prodEditar || guardando) return
        setGuardando(true)
        try {
            // ── Foto principal: la primera del array editFotos ──
            let nuevaImagen: string | undefined = undefined
            const principalEdit = editFotos[0]
            if (principalEdit?.file) {
                // Reemplazo de foto principal → subir nueva
                const sizeMB = principalEdit.file.size / (1024 * 1024)
                if (sizeMB > 10) {
                    mostrarMsg(false, `La imagen pesa ${sizeMB.toFixed(1)} MB. El máximo es 10 MB.`)
                    setGuardando(false)
                    return
                }
                const r = await api.subirFoto(prodEditar, principalEdit.file)
                nuevaImagen = r.ruta
            } else if (editFotos.length === 0 && editProdVal.imagen !== "No hay foto") {
                // Se eliminaron todas las fotos → quitar foto principal
                nuevaImagen = "No hay foto"
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

            // ── Sincronizar fotos extras (índices 1+) ──
            // Eliminar fotos que ya no están en el array
            const fotosActuales = await api.getImagenesProducto(prodEditar)
            for (const existente of fotosActuales) {
                const sigueEnArray = editFotos.some(f => f.id === existente.id)
                if (!sigueEnArray) {
                    try { await api.eliminarImagenExtra(existente.id) }
                    catch { /* ignorar error al eliminar */ }
                }
            }
            // Subir nuevas fotos extras + reemplazadas
                        // Para cada foto del array que tenga file (es nueva/cambiada):
                        //   - Si tiene orden, reemplazar en ese orden (backend borra la vieja)
                        //   - Si no tiene orden, insercion nueva
                        const nuevosExtras = editFotos.slice(1).filter(f => f.file)
                        for (const extra of nuevosExtras) {
                            if (!extra.file) continue
                            try {
                                let imgAEnviar = extra.file
                                try { imgAEnviar = await comprimirImagen(extra.file) }
                                catch { /* enviar original */ }
                                await api.subirImagenExtra(prodEditar, imgAEnviar, extra.orden)
                            } catch {
                                console.warn("Error subiendo imagen extra para", prodEditar)
                            }
                        }

            mostrarMsg(true, "Producto actualizado")
            setProdEditar(""); setEditProdNombre(""); setEditFotos([]); recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    /** Guarda los cambios de un lote individual desde el formulario Editar Prod. */
    async function guardarLoteIndividual() {
        if (loteEditandoId === null || guardando) return
        setGuardando(true)
        try {
            await api.editarLote(loteEditandoId, { costo: Number(editLoteVal.costo), precio_venta: Number(editLoteVal.precio_venta), stock: Number(editLoteVal.stock) })
            mostrarMsg(true, "Lote actualizado")
            setLoteEditandoId(null)
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    /**
     * Da de baja un lote individual desde el formulario Editar Prod.
     * Muestra un diálogo de confirmación persistente que no desaparece
     * hasta que se completa la eliminación, para evitar errores accidentales.
     * Si es el último lote activo, también desactiva el producto automáticamente.
     */
    async function eliminarLoteHandler(id_lote: string) {
        setGuardando(true)
        try {
            const res = await api.eliminarLote(id_lote)
            setLoteEliminarConfirm(null)
            if (res.producto_desactivado) {
                mostrarMsg(true, `Lote #${id_lote} eliminado. El producto "${res.producto}" también fue desactivado por ser el único lote.`)
            } else {
                mostrarMsg(true, `Lote #${id_lote} eliminado`)
            }
            recargar()
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error al eliminar lote"}`)
        } finally {
            setGuardando(false)
        }
    }

    function confirmarEliminarCategoria() {
        const cat = confirmEliminarCat
        if (!cat) return
        setConfirmEliminarCat(null)
        eliminarCategoria(cat)
    }

    async function eliminarCategoria(cat: string) {
        try {
            const res = await api.eliminarCategoria(cat) as { productos_actualizados: number }
            mostrarMsg(true, `Categoría "${cat}" eliminada de ${res.productos_actualizados} producto(s)`)
            await Promise.all([recargar(), cargarCategorias()])
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    const TABS: { id: Tab; label: string; icon: string }[] = [
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
    // Productos filtrados y ordenados para el Restock
    const productosRestock = inv.filter(p => {
        const b = restockBuscador.toLowerCase()
        const porBusqueda = !b || p.producto.toLowerCase().includes(b) ||
            p.descripcion?.toLowerCase().includes(b) ||
            p.codigo_interno?.toLowerCase().includes(b) ||
            p.codigo_barras?.toLowerCase().includes(b) ||
            (p.categoria || ["General"]).join(" ").toLowerCase().includes(b)
        const porCategoria = restockCatSelec === "Todas" || (p.categoria || ["General"]).includes(restockCatSelec)
        return porBusqueda && porCategoria
    }).sort((a, b) => {
        switch (restockOrdenamiento) {
            case "precio-desc":
                return b.precio_venta - a.precio_venta
            case "stock-desc":
                return b.stock_total - a.stock_total
            case "alfabetico":
                return a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
            case "alfabetico-desc":
                return b.producto.localeCompare(a.producto, "es", { sensitivity: "base" })
            default:
                return a.stock_total - b.stock_total
        }
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
                {/* Stat cards — clickeables para ver explicación */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }} className="md:grid-cols-4">
                    {[
                        { label: "Productos activos", valor: totalActivos, icon: "PackagePlus" },
                        { label: "Valor del inventario", valor: `$${valorInv.toFixed(0)}`, icon: "PiggyBank" },
                        { label: "Ganancia potencial", valor: `$${ganPotencial.toFixed(0)}`, icon: "Banknote" },
                        { label: "Stock descuadrado", valor: stockDesc, icon: "TriangleAlert" },
                    ].map(m => (
                        <div
                            key={m.label}
                            className="card fade-up"
                            onClick={() => setKpiExplicacion(m.label)}
                            style={{
                                padding: "14px 16px",
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                cursor: "pointer",
                                transition: "all 0.15s",
                                border: kpiExplicacion === m.label ? "2px solid var(--primary-mid)" : "2px solid transparent"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 16px var(--primary-glow)" }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}
                        >
                            <div style={{ background: "var(--gradient-1)", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.1rem" }}>
                                <Icon name={m.icon as any} size={24} color="var(--primary-soft)" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{m.label}</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>{m.valor}</p>
                            </div>                        </div>
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
                            <GaleriaProducto
                                fotos={nuevasFotos}
                                onChange={setNuevasFotos}
                                maxFotos={5}
                                disabled={guardando}
                                label="Fotos del producto"
                            />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                <Input label="Cantidad" type="number" min={1} placeholder="1" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value === "" ? "" : Number(e.target.value) }))} />
                                <Input label="Costo" type="number" min={0} step="0.01" placeholder="0.00" value={form.costo} onChange={e => setForm(p => ({ ...p, costo: e.target.value === "" ? "" : Number(e.target.value) }))} />
                                <Input label="Precio" type="number" min={0} step="0.01" placeholder="0.00" value={form.precio_venta} onChange={e => setForm(p => ({ ...p, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))} />
                            </div>
                            <button className="btn-primary" onClick={guardarNuevo} disabled={guardando || !form.producto || form.precio_venta === "" || form.precio_venta === 0}>
                                {guardando ? "Procesando..." : " Dar de Alta"}
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
                                                            onClick={() => setConfirmEliminarCat(cat.nombre)}
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

                {/* ── Restock: buscador + grid (como Editar Prod.) ── */}
                {tab === "restock" && !restockProdSeleccionado && (
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
                                    onClick={() => {
                                        setRestockOrdenamiento(prev => {
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
                                    value={restockOrdenamiento}
                                    onChange={e => setRestockOrdenamiento(e.target.value)}
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

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                            {productosRestock.length === 0 ? (
                                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                                    <span style={{ fontSize: "4rem", display: "block", marginBottom: 16, opacity: 0.3 }}>—</span>
                                    <h2 style={{ fontSize: "1.5rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 8px" }}>Sin resultados</h2>
                                    <p style={{ fontSize: "1rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>Intenta con otra búsqueda o categoría</p>
                                </div>
                            ) : (
                                productosRestock.map(prod => (
                                    <div
                                        key={prod.producto}
                                        className="card fade-up"
                                        style={{ padding: 12, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                                        onClick={() => {
                                            setRestockProdSeleccionado(prod)
                                            setRestock(r => ({
                                                ...r,
                                                producto: prod.producto,
                                                costo: Number(prod.costo_promedio ?? 0).toFixed(2),
                                                precio_venta: Number(prod.precio_venta ?? 0).toFixed(2)
                                            }))
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
                                                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }}
                                                    onError={(e) => { e.currentTarget.style.display = "none" }}
                                                    loading="lazy" />
                                            ) : (
                                                <Icon name="PackagePlus" size={32} color="var(--primary-mid)" />
                                            )}
                                        </div>
                                        <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.producto}</p>
                                        <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>${prod.precio_venta.toFixed(2)}</p>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px" }}>{(prod.categoria || ["General"]).join(", ")}</span>
                                            <span style={{
                                                fontSize: "0.62rem", fontWeight: 700,
                                                color: prod.stock_total < 0 ? "#b71c1c" : "#2e7d32",
                                                background: prod.stock_total < 0 ? "#ffeef0" : "#e8f5e9",
                                                borderRadius: 6, padding: "2px 6px"
                                            }}>Stock: {prod.stock_total}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}

                {/* ── Restock: formulario para el producto seleccionado ── */}
                {tab === "restock" && restockProdSeleccionado && (
                    <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <button
                                onClick={() => {
                                    setRestockProdSeleccionado(null)
                                    setRestockBuscador("")
                                    setRestockCatSelec("Todas")
                                    setRestock({ producto: "", costo: "", precio_venta: "", stock: 1 })
                                }}
                                style={{ background: "var(--bg-card2)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}
                            >
                                <Icon name="ArrowLeft" size={18} color="var(--text-main)" /> Volver
                            </button>
                            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                                Añadir stock a: <strong style={{ color: "var(--text-main)" }}>{restockProdSeleccionado.producto}</strong>
                            </span>
                        </div>

                        {/* Resumen del producto */}
                        <div style={{
                            padding: "12px 16px",
                            borderRadius: 12,
                            background: "var(--bg-card2)",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8
                        }}>
                            <div>
                                <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Stock actual</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>{restockProdSeleccionado.stock_total}</p>
                            </div>
                            <div>
                                <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Precio venta</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)" }}>${restockProdSeleccionado.precio_venta.toFixed(2)}</p>
                            </div>
                            <div>
                                <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Costo promedio</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>${(restockProdSeleccionado.costo_promedio ?? 0).toFixed(2)}</p>
                            </div>
                            <div>
                                <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Margen</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: restockProdSeleccionado.precio_venta > (restockProdSeleccionado.costo_promedio ?? 0) ? "#2e7d32" : "#b71c1c" }}>
                                    {restockProdSeleccionado.precio_venta > 0
                                        ? `${(((restockProdSeleccionado.precio_venta - (restockProdSeleccionado.costo_promedio ?? 0)) / restockProdSeleccionado.precio_venta) * 100).toFixed(1)}%`
                                        : "—"}
                                </p>
                            </div>
                        </div>

                        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                            Costo y precio prellenados según el producto. Ajústalos si este nuevo lote tiene valores diferentes.
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <Input label="Cantidad" type="number" min={1} placeholder="1" value={restock.stock} onChange={e => setRestock(r => ({ ...r, stock: e.target.value === "" ? "" : Number(e.target.value) }))} />
                            <Input label="Costo" type="number" min={0} step="0.01" placeholder="0.00" value={restock.costo} onChange={e => setRestock(r => ({ ...r, costo: e.target.value === "" ? "" : Number(e.target.value) }))} />
                            <Input label="Precio" type="number" min={0} step="0.01" placeholder="0.00" value={restock.precio_venta} onChange={e => setRestock(r => ({ ...r, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))} />
                        </div>
                        <button className="btn-primary" onClick={guardarRestock} disabled={guardando || !restock.producto || !restock.stock || Number(restock.stock) <= 0}>
                            {guardando ? "Procesando..." : "Añadir Stock"}
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
                                        boxShadow: catSelecEditar === cat ? "0 2px 6px var(--primary-glow)" : "none"
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

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                                {productosEditar.length === 0 ? (
                                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                                        <span style={{ fontSize: "4rem", display: "block", marginBottom: 16, opacity: 0.3 }}>—</span>
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
                                                setEditFotos([]) // reset al cambiar de producto
                                                setEditProdVal({
                                                    descripcion: prod.descripcion ?? "",
                                                    estado: prod.estado ?? "Activo",
                                                    imagen: prod.imagen ?? "No hay foto",
                                                    categoria: prod.categoria ?? ["General"],
                                                    codigo_interno: prod.codigo_interno ?? "",
                                                    codigo_barras: prod.codigo_barras ?? "",
                                                    ubicacion: prod.ubicacion ?? "",
                                                })
                                                // Cargar todas las fotos del producto (principal + extras) en editFotos
                                                const fotos: FotoGaleria[] = []
                                                if (prod.imagen && prod.imagen !== "No hay foto") {
                                                    fotos.push({ url: prod.imagen, orden: 1 }) // principal = orden 1
                                                }
                                                api.getImagenesProducto(prod.producto)
                                                    .then(extras => {
                                                        const todas = [...fotos, ...extras.map(e => ({ url: e.url, id: e.id, orden: e.orden }))]
                                                        setEditFotos(todas)
                                                    })
                                                    .catch(() => setEditFotos(fotos))
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
                                                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }}
                                                        onError={(e) => { e.currentTarget.style.display = "none" }}
                                                        loading="lazy" />
                                                ) : (
                                                    <Icon name="Package" size={32} color="var(--text-muted)" />
                                                )}
                                            </div>
                                            <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.producto}</p>
                                            <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>${prod.precio_venta.toFixed(2)}</p>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px" }}>{(prod.categoria || ["General"]).join(", ")}</span>
                                                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: prod.stock_total < 0 ? "#b71c1c" : "#2e7d32", background: prod.stock_total < 0 ? "#ffeef0" : "#e8f5e9", borderRadius: 6, padding: "2px 6px" }}>Stock: {prod.stock_total}</span>
                                            </div>
                                        </div>
                                    )))}
                            </div>
                    </>
                )}

                {/* Editar producto — formulario + lotes */}
                {tab === "editar" && prodEditar && (
                    <>
                        {/* ── Card 1: Información del producto ── */}
                        <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <button
                                    onClick={() => { setProdEditar(""); setBuscadorEditar(""); setCatSelecEditar("Todas"); setLoteEditandoId(null); setEditFotos([]) }}
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
                            <Input label="Descripción" value={editProdVal.descripcion} onChange={e => setEditProdVal(p => ({ ...p, descripcion: e.target.value }))} />

                            <GaleriaProducto
                                fotos={editFotos}
                                onChange={setEditFotos}
                                maxFotos={5}
                                disabled={guardando}
                                label="Fotos del producto"
                            />

                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Estado</label>
                                <select className="input-primary" value={editProdVal.estado} onChange={e => setEditProdVal(p => ({ ...p, estado: e.target.value }))}>
                                    <option value="Activo">Activo</option>
                                    <option value="Inactivo">Inactivo</option>
                                </select>
                            </div>

                            <button className="btn-primary" onClick={guardarProducto} disabled={guardando}>
                                {guardando ? "Procesando..." : "Guardar Cambios"}
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
                                                                <button onClick={() => { setLoteEditandoId(null); setLoteEliminarConfirm(null) }}
                                                                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)" }}>
                                                                    <Icon name="X" size={16} color="var(--text-muted)" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                                <button onClick={() => {
                                                                    setLoteEditandoId(lote.id_lote)
                                                                    setEditLoteVal({ costo: lote.costo, precio_venta: lote.precio_venta, stock: lote.stock_lote })
                                                                }}
                                                                    style={{ background: "none", border: "none", color: "var(--primary-mid)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", padding: 4 }}>
                                                                    Editar
                                                                </button>
                                                                <button onClick={() => setLoteEliminarConfirm(lote.id_lote)}
                                                                    title={`Dar de baja lote #${lote.id_lote}`}
                                                                    style={{ background: "none", border: "none", color: "#ad4955ff", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", padding: 4 }}>
                                                                    <Icon name="Trash2" size={14} color="#ad4955ff" />
                                                                </button>
                                                            </div>
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

                        {/* ── Diálogo de confirmación persistente para dar de baja un lote ── */}
                        {loteEliminarConfirm && (() => {
                            // Determinamos si es el único lote activo del producto
                            const lotesDelProducto = lotes.filter(l => l.producto === prodEditar)
                            const esUltimoLote = lotesDelProducto.length <= 1
                            return (
                                <div style={{
                                    position: "fixed", inset: 0, zIndex: 9999,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                                    padding: 24
                                }}>
                                    <div className="card" style={{
                                        maxWidth: 440, width: "100%", padding: 28, gap: 20,
                                        display: "flex", flexDirection: "column",
                                        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                                        border: "1px solid var(--border-light)"
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{
                                                width: 44, height: 44, borderRadius: 12,
                                                background: "#ffeef0", display: "flex",
                                                alignItems: "center", justifyContent: "center", flexShrink: 0
                                            }}>
                                                <Icon name="TriangleAlert" size={24} color="#ad4955ff" />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                                    Dar de baja lote
                                                </h3>
                                                <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                                    #{loteEliminarConfirm}
                                                </p>
                                            </div>
                                        </div>

                                        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                                            ¿Estás seguro de que quieres dar de baja este lote? Esta acción marcará el lote como inactivo y pondrá su stock en 0.
                                        </p>

                                        {/* Advertencia adicional si es el último lote: el producto también se desactivará */}
                                        {esUltimoLote && (
                                            <div style={{
                                                padding: "12px 16px", borderRadius: 10,
                                                background: "#fff4e5", border: "1px solid #ffd699",
                                                display: "flex", gap: 10, alignItems: "flex-start"
                                            }}>
                                                <div style={{ flexShrink: 0, marginTop: 2 }}>
                                                    <Icon name="TriangleAlert" size={20} color="#cc7a00" />
                                                </div>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#8a5e00" }}>
                                                        Último lote activo
                                                    </p>
                                                    <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#8a5e00", fontWeight: 500 }}>
                                                        Este es el único lote activo de <strong>{prodEditar}</strong>.
                                                        Al dar de baja este lote, el producto también será desactivado automáticamente.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                                            <button
                                                onClick={() => setLoteEliminarConfirm(null)}
                                                disabled={guardando}
                                                style={{
                                                    padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                                    background: "var(--bg-card2)", color: "var(--text-main)",
                                                    fontWeight: 700, fontSize: "0.82rem", cursor: guardando ? "not-allowed" : "pointer",
                                                    transition: "all 0.15s"
                                                }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={() => eliminarLoteHandler(loteEliminarConfirm)}
                                                disabled={guardando}
                                                style={{
                                                    padding: "10px 20px", borderRadius: 10, border: "none",
                                                    background: guardando ? "#ccc" : "#ad4955ff",
                                                    color: guardando ? "#999" : "#fff",
                                                    fontWeight: 700, fontSize: "0.82rem",
                                                    cursor: guardando ? "not-allowed" : "pointer",
                                                    display: "flex", alignItems: "center", gap: 8,
                                                    transition: "all 0.15s"
                                                }}
                                            >
                                                {guardando ? (
                                                    <><Icon name="Hourglass" size={16} color="#999" /> Procesando...</>
                                                ) : (
                                                    <><Icon name="Trash2" size={16} color="#fff" /> Sí, dar de baja</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </>
                )}

                {/* ── Modal: Confirmar eliminar categoría ── */}
                {confirmEliminarCat !== null && (
                    <div style={{
                        position: "fixed", inset: 0, zIndex: 9999,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                        padding: 24
                    }}>
                        <div className="card" style={{
                            maxWidth: 440, width: "100%", padding: 28, gap: 20,
                            display: "flex", flexDirection: "column",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                            border: "1px solid var(--border-light)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: "#ffeef0", display: "flex",
                                    alignItems: "center", justifyContent: "center", flexShrink: 0
                                }}>
                                    <Icon name="TriangleAlert" size={24} color="#ad4955ff" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                    Eliminar categoría
                                </h3>
                            </div>

                            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                                ¿Estás seguro de eliminar la categoría <strong>"{confirmEliminarCat}"</strong>? Se eliminará de todos los productos.
                            </p>

                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                                <button onClick={() => setConfirmEliminarCat(null)}
                                    style={{
                                        padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                        background: "var(--bg-card2)", color: "var(--text-main)",
                                        fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                                        transition: "all 0.15s"
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button onClick={confirmarEliminarCategoria}
                                    style={{
                                        padding: "10px 20px", borderRadius: 10, border: "none",
                                        background: "#ad4955ff",
                                        color: "#fff",
                                        fontWeight: 700, fontSize: "0.82rem",
                                        cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 8,
                                        transition: "all 0.15s"
                                    }}
                                >
                                    <Icon name="Trash2" size={16} color="#fff" /> Sí, eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Popup de explicación de KPI ── */}
                {kpiExplicacion && (() => {
                    const info = explicacionesKPI[kpiExplicacion]
                    if (!info) return null
                    // Mapa de íconos para cada KPI
                    const iconosKPI: Record<string, string> = {
                        "Productos activos": "PackagePlus",
                        "Valor del inventario": "PiggyBank",
                        "Ganancia potencial": "Banknote",
                        "Stock descuadrado": "TriangleAlert",
                    }
                    const iconoKPI = iconosKPI[kpiExplicacion] || "Info"
                    return (
                        <div
                            style={{
                                position: "fixed", inset: 0, zIndex: 9999,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                                padding: 24
                            }}
                            onClick={() => setKpiExplicacion(null)}
                        >
                            <div
                                className="fade-up"
                                onClick={e => e.stopPropagation()}
                                style={{
                                    maxWidth: 480,
                                    width: "100%",
                                    padding: 28,
                                    borderRadius: 20,
                                    background: "var(--bg-card)",
                                    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                                    border: "1px solid var(--border-primary)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 16
                                }}
                            >
                                {/* Header */}
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: "var(--gradient-1)",
                                        display: "flex",
                                        alignItems: "center", justifyContent: "center", flexShrink: 0
                                    }}>
                                        <Icon name={iconoKPI as any} size={24} color="var(--primary-soft)" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                            ¿Qué significa?
                                        </h3>
                                        <p style={{ margin: "2px 0 0", fontSize: "0.85rem", fontWeight: 700, color: "var(--primary-mid)" }}>
                                            {kpiExplicacion}
                                        </p>
                                    </div>
                                </div>

                                {/* Descripción */}
                                <div style={{
                                    padding: "16px 20px",
                                    borderRadius: 12,
                                    background: "var(--bg-card2)",
                                    lineHeight: 1.6,
                                    fontSize: "0.88rem",
                                    color: "var(--text-main)",
                                    fontWeight: 500
                                }}>
                                    {info.descripcion}
                                </div>

                                {/* Fórmula */}
                                <div style={{
                                    padding: "12px 16px",
                                    borderRadius: 10,
                                    background: "var(--primary-bg)",
                                    border: "1px solid var(--border-primary)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10
                                }}>
                                    <Icon name="Calculator" size={18} color="var(--primary-mid)" />
                                    <span style={{
                                        fontSize: "0.82rem",
                                        fontWeight: 700,
                                        color: "var(--primary-dark)",
                                        fontFamily: "monospace"
                                    }}>
                                        {info.formula}
                                    </span>
                                </div>

                                {/* Botón cerrar */}
                                <button
                                    onClick={() => setKpiExplicacion(null)}
                                    style={{
                                        alignSelf: "flex-end",
                                        padding: "10px 24px",
                                        borderRadius: 10,
                                        border: "none",
                                        background: "var(--gradient-1)",
                                        color: "#fff",
                                        fontWeight: 700,
                                        fontSize: "0.85rem",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        transition: "all 0.15s"
                                    }}
                                >
                                    Entendido
                                </button>
                            </div>
                        </div>
                    )
                })()}

                <div style={{ height: 20 }} />
            </div>
        </div>
    )
}
