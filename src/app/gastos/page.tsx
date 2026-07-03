"use client"
// ==============================================================================
// src/app/gastos/page.tsx — Rediseño Argon primary
// Ahora con tabs: Movimientos | Gastos Programados (mismo patrón que Inventario)
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Gasto } from "@/lib/api"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"
import GestionGastosProgramados from "@/components/GestionGastosProgramados"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

type Tab = "movimientos" | "programados"

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "movimientos", label: "Movimientos", icon: "ListChecks" },
    { id: "programados", label: "Gastos Programados", icon: "CalendarClock" },
]

export default function Gastos() {
    const [tab, setTab] = useState<Tab>("movimientos")
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [cargando, setCargando] = useState(true)
    const [form, setForm] = useState({
        fecha: new Date().toISOString().substring(0, 10),
        categoria: "Otros",
        descripcion: "",
        monto: ""
    })
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const [editandoId, setEditandoId] = useState<number | null>(null)
    const [editMonto, setEditMonto] = useState("")
    const [editCategoria, setEditCategoria] = useState("Otros")
    const [editDescripcion, setEditDescripcion] = useState("")

    // ── Estados para modales de confirmación ──
    const [confirmEliminarGastoId, setConfirmEliminarGastoId] = useState<number | null>(null)
    const [confirmDescartarGastoId, setConfirmDescartarGastoId] = useState<number | null>(null)
    const [confirmEliminarCatGasto, setConfirmEliminarCatGasto] = useState<string | null>(null)

    // ── Estado para categorías de gasto editables ──
    const [categoriasGasto, setCategoriasGasto] = useState<string[]>(["Otros"])
    const [catColapsado, setCatColapsado] = useState(true)
    const [esMobile, setEsMobile] = useState(true) // mobile-first para evitar flash de contenido
    const [cargandoCats, setCargandoCats] = useState(false)
    const [nuevaCatNombre, setNuevaCatNombre] = useState("")
    const [catEditandoNombre, setCatEditandoNombre] = useState<string | null>(null)
    const [catEditandoVal, setCatEditandoVal] = useState("")
    const [guardandoCat, setGuardandoCat] = useState(false)

    /**
     * Carga la lista de categorías de gasto desde la API.
     * Si el tenant no tiene categorías (primer inicio), siembra las categorías
     * por defecto para que el usuario no vea una lista vacía.
     */
    async function cargarCategoriasGasto() {
        setCargandoCats(true)
        try {
            const cats = await api.getCategoriasGasto()
            if (cats.length === 0) {
                // Seed inicial: crear las categorías por defecto
                const defaults = ["Evento", "Decoración", "Materiales", "Alimentos", "Envíos", "Otros"]
                await Promise.all(defaults.map(n => api.crearCategoriaGasto(n).catch(() => {})))
                const cats2 = await api.getCategoriasGasto()
                setCategoriasGasto(cats2.map(c => c.nombre))
            } else {
                setCategoriasGasto(cats.map(c => c.nombre))
            }
        } catch {
            // Si falla la API, usamos las categorías por defecto como fallback
            setCategoriasGasto(["Evento", "Decoración", "Materiales", "Alimentos", "Envíos", "Otros"])
        } finally {
            setCargandoCats(false)
        }
    }

    async function guardarNuevaCategoriaGasto() {
        const nombre = nuevaCatNombre.trim()
        if (!nombre || guardandoCat) return
        setGuardandoCat(true)
        try {
            await api.crearCategoriaGasto(nombre)
            setNuevaCatNombre("")
            await cargarCategoriasGasto()
            mostrarMsg(true, `✅ Categoría "${nombre}" creada`)
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al crear categoría"}`)
        } finally {
            setGuardandoCat(false)
        }
    }

    function iniciarEditarCategoriaGasto(nombre: string) {
        setCatEditandoNombre(nombre)
        setCatEditandoVal(nombre)
    }

    async function guardarEditarCategoriaGasto(viejoNombre: string) {
        const nuevo = catEditandoVal.trim()
        if (!nuevo || nuevo === viejoNombre || guardandoCat) {
            cancelarEditarCategoriaGasto()
            return
        }
        setGuardandoCat(true)
        try {
            await api.editarCategoriaGasto(viejoNombre, nuevo)
            cancelarEditarCategoriaGasto()
            await cargarCategoriasGasto()
            // Actualizar también el form y edit si estaban usando el nombre viejo
            if (form.categoria === viejoNombre) setForm(f => ({ ...f, categoria: nuevo }))
            if (editCategoria === viejoNombre) setEditCategoria(nuevo)
            mostrarMsg(true, `✅ Categoría renombrada a "${nuevo}"`)
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al renombrar"}`)
        } finally {
            setGuardandoCat(false)
        }
    }

    function cancelarEditarCategoriaGasto() {
        setCatEditandoNombre(null)
        setCatEditandoVal("")
    }

    async function confirmarEliminarCategoriaGasto() {
        const nombre = confirmEliminarCatGasto
        if (!nombre) return
        setConfirmEliminarCatGasto(null)
        try {
            await api.eliminarCategoriaGasto(nombre)
            await cargarCategoriasGasto()
            // Si el form o edit usaban esta categoría, reasignar a Otros
            if (form.categoria === nombre) setForm(f => ({ ...f, categoria: "Otros" }))
            if (editCategoria === nombre) setEditCategoria("Otros")
            mostrarMsg(true, `🗑️ Categoría "${nombre}" eliminada`)
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al eliminar categoría"}`)
        }
    }

    async function recargar() {
        const g = await api.getGastos()
        setGastos(g)
    }
    useEffect(() => {
        // Detectar si es mobile para el colapsable de categorías
        const mql = window.matchMedia('(max-width: 767px)')
        setEsMobile(mql.matches)
        const handler = (e: MediaQueryListEvent) => setEsMobile(e.matches)
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [])
    useEffect(() => { Promise.all([recargar(), cargarCategoriasGasto()]).finally(() => setCargando(false)) }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    async function agregar() {
        const monto = parseFloat(form.monto)
        if (!form.descripcion || isNaN(monto)) return
        try {
            await api.crearGasto({
                fecha: form.fecha + "T12:00:00.000Z",
                categoria: form.categoria,
                descripcion: form.descripcion,
                monto
            })
            mostrarMsg(true, `✅ Gasto registrado: $${monto.toFixed(2)}`)
            setForm(f => ({ ...f, descripcion: "", monto: "" }))
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function eliminar(id: number) {
        setConfirmEliminarGastoId(null)
        try {
            await api.eliminarGasto(id)
            mostrarMsg(true, "🗑️ Gasto eliminado")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function confirmar(id: number) {
        try {
            await api.confirmarGasto(id)
            mostrarMsg(true, "✅ Gasto confirmado como pagado")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function descartar(id: number) {
        setConfirmDescartarGastoId(null)
        try {
            await api.descartarGasto(id)
            mostrarMsg(true, "🗑️ Gasto descartado")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    function iniciarEdicion(g: Gasto) {
        setEditandoId(g.id)
        setEditMonto(g.monto.toString())
        setEditCategoria(g.categoria)
        setEditDescripcion(g.descripcion)
    }

    function cancelarEdicion() {
        setEditandoId(null)
        setEditMonto("")
        setEditCategoria("Otros")
        setEditDescripcion("")
    }

    async function guardarEdicion(id: number) {
        const monto = parseFloat(editMonto)
        if (isNaN(monto) || monto <= 0) return
        try {
            await api.actualizarGasto(id, { monto, categoria: editCategoria, descripcion: editDescripcion })
            mostrarMsg(true, "✅ Gasto actualizado")
            cancelarEdicion()
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    // ── Stats: solo gastos pagados ──
    const pagados = gastos.filter(g => g.estado !== "pendiente" && g.estado !== "descartado")
    const totalPagado = pagados.reduce((a, g) => a + g.monto, 0)
    const numPagados = pagados.length
    const pendientes = gastos.filter(g => g.estado === "pendiente")
    const totalPendiente = pendientes.reduce((a, g) => a + g.monto, 0)

    function estadoBadge(estado?: string) {
        switch (estado) {
            case "pendiente":
                return { label: "Pendiente", bg: "#fef9c3", color: "#ca8a04" }
            case "descartado":
                return { label: "Descartado", bg: "#f3f4f6", color: "#6b7280" }
            default:
                return { label: "Pagado", bg: "#dcfce7", color: "#16a34a" }
        }
    }

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero con Antigravity ── */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--gradient-4)", padding: "32px 24px 90px" }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                    <Antigravity
                        count={400} magnetRadius={12} ringRadius={8}
                        waveSpeed={0.5} waveAmplitude={1.2} particleSize={1.5}
                        lerpSpeed={0.08} color="var(--ag-color-4)" autoAnimate={true}
                        particleVariance={0.8} rotationSpeed={0.3} depthFactor={0.5}
                        pulseSpeed={2} particleShape="capsule" fieldStrength={8}
                    />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}>EGRESOS</p>
                    <h1 className="hidden md:flex" style={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}>
                        <div style={{ marginLeft: "-5px" }}>
                            <Icon name="DollarSign" size={32} color="var(--primary-soft)" />
                        </div>
                        Gastos</h1>
                </div>
            </div>

            <div style={{ padding: "0 16px", marginTop: -60, position: "relative", zIndex: 1 }}>

                {/* ── Tabs (patrón Inventario) ── */}
                <div className="card" style={{ display: "flex", padding: 6, gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flex: 1, minWidth: 80, padding: "10px 16px", gap: 8, borderRadius: 10, border: "none",
                            background: tab === t.id ? "var(--gradient-4)" : "transparent",
                            color: tab === t.id ? "#fff" : "var(--text-muted)",
                            fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s",
                        }}>
                            <Icon name={t.icon as any} size={22} color={tab === t.id ? "#fff" : "var(--text-muted)"} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Tab: Movimientos ── */}
                {tab === "movimientos" && (
                    <>
                        {/* Stats cards: solo pagados */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                            <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                                <Icon name="BanknoteArrowDown" size={32} color="var(--primary-alter)" />
                                <div>
                                    <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Total Pagado</p>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-alter)" }}>${totalPagado.toFixed(0)}</p>
                                </div>
                            </div>
                            <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                                <Icon name="ClipboardList" size={32} color="var(--primary-pale)" />
                                <div>
                                    <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Pagados</p>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-pale)" }}>{numPagados}</p>
                                </div>
                            </div>
                            <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                                <Icon name="Clock" size={32} color="var(--primary-dark)" />
                                <div>
                                    <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Pendientes</p>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-dark)" }}>
                                        {pendientes.length > 0 ? `${pendientes.length} ($${totalPendiente.toFixed(0)})` : "0"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {msg && (
                            <div className="card fade-up" style={{
                                padding: "12px 16px", marginBottom: 16,
                                borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#ef4444"}`,
                                color: msg.ok ? "#2e7d32" : "#b91c1c",
                                fontSize: "0.9rem", fontWeight: 700
                            }}>
                                {msg.texto}
                            </div>
                        )}

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
                            {/* Columna izquierda: Formulario + Categorías apiladas */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: "1 1 300px", maxWidth: 400, minWidth: 0 }}>
                                {/* Formulario */}
                                <div className="card fade-up" style={{ padding: 20 }}>
                                    <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 800 }}> Registrar Gasto</h2>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Fecha</label>
                                            <input type="date" className="input-primary" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Categoría</label>
                                            <select className="input-primary" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                                                {categoriasGasto.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Descripción</label>
                                            <input className="input-primary" placeholder="Ej: Pago de luz, comida..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Monto ($)</label>
                                            <input type="number" step="0.01" className="input-primary" placeholder="0.00" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                                        </div>
                                        <button className="btn-primary" style={{ marginTop: 8 }} onClick={agregar} disabled={!form.descripcion || !form.monto || !form.fecha}>
                                            Añadir Gasto
                                        </button>
                                    </div>
                                </div>

                                {/* ── Card: Gestionar Categorías (colapsable en mobile) ── */}
                                <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                                    <div
                                        onClick={() => { if (esMobile) setCatColapsado(c => !c) }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            cursor: esMobile ? "pointer" : "default",
                                            userSelect: "none",
                                        }}
                                    >
                                        <h2 style={{
                                            margin: 0,
                                            fontSize: "1rem",
                                            fontWeight: 800,
                                            color: "var(--text-main)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            flex: 1
                                        }}>
                                            <Icon name="Tags" size={20} color="var(--primary-mid)" />
                                            Gestionar Categorías
                                        </h2>
                                        {esMobile && (
                                            <span style={{
                                                transition: "transform 0.25s ease",
                                                transform: catColapsado ? "rotate(0deg)" : "rotate(180deg)",
                                                display: "flex",
                                                alignItems: "center",
                                                color: "var(--text-muted)",
                                                opacity: 0.6
                                            }}>
                                                <Icon name="ChevronDown" size={20} />
                                            </span>
                                        )}
                                    </div>

                                    {/* Contenido colapsable: solo se oculta en mobile cuando está colapsado */}
                                    <div style={{
                                        display: esMobile && catColapsado ? "none" : "flex",
                                        flexDirection: "column",
                                        gap: 14
                                    }}>
                                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, fontWeight: 600, flexShrink: 0 }}>
                                        Crea, renombra o elimina las categorías de gasto.
                                    </p>

                                    {/* Input para crear nueva categoría */}
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                                        <input
                                            type="text"
                                            placeholder="Nombre de la nueva categoría..."
                                            value={nuevaCatNombre}
                                            onChange={e => setNuevaCatNombre(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter") guardarNuevaCategoriaGasto() }}
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
                                            onClick={guardarNuevaCategoriaGasto}
                                            disabled={!nuevaCatNombre.trim() || guardandoCat}
                                            style={{
                                                background: nuevaCatNombre.trim() && !guardandoCat ? "var(--primary-mid)" : "var(--bg-card2)",
                                                color: nuevaCatNombre.trim() && !guardandoCat ? "#fff" : "var(--text-muted)",
                                                border: "none", borderRadius: 10,
                                                padding: "8px 16px", fontWeight: 700, fontSize: "0.78rem",
                                                cursor: nuevaCatNombre.trim() && !guardandoCat ? "pointer" : "not-allowed",
                                                transition: "all 0.15s",
                                                whiteSpace: "nowrap",
                                                display: "flex", alignItems: "center", gap: 6
                                            }}
                                        >
                                            <Icon name="Plus" size={16} color={nuevaCatNombre.trim() && !guardandoCat ? "#fff" : "var(--text-muted)"} /> Crear
                                        </button>
                                    </div>

                                    {/* Separador */}
                                    <div style={{ height: 1, background: "var(--border-light)", margin: "4px 0", flexShrink: 0 }} />

                                    {/* Lista de categorías */}
                                    {cargandoCats ? (
                                        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20, fontSize: "0.8rem" }}>
                                            Cargando categorías...
                                        </p>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1, minHeight: 0, scrollbarWidth: "thin" }}>
                                            {categoriasGasto.map(cat => {
                                                const editando = catEditandoNombre === cat
                                                return (
                                                    <div
                                                        key={cat}
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                            padding: "8px 12px",
                                                            borderRadius: 10,
                                                            background: "var(--bg-card2)",
                                                            transition: "all 0.15s"
                                                        }}
                                                        onMouseEnter={e => { if (!editando) e.currentTarget.style.background = "var(--border-light)" }}
                                                        onMouseLeave={e => { if (!editando) e.currentTarget.style.background = "var(--bg-card2)" }}
                                                    >
                                                        {editando ? (
                                                            <>
                                                                <input
                                                                    type="text"
                                                                    value={catEditandoVal}
                                                                    onChange={e => setCatEditandoVal(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === "Enter") guardarEditarCategoriaGasto(cat)
                                                                        if (e.key === "Escape") cancelarEditarCategoriaGasto()
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
                                                                    onClick={() => guardarEditarCategoriaGasto(cat)}
                                                                    disabled={guardandoCat || !catEditandoVal.trim()}
                                                                    style={{
                                                                        background: "var(--primary-mid)", color: "#fff",
                                                                        border: "none", borderRadius: 8,
                                                                        padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700,
                                                                        cursor: guardandoCat || !catEditandoVal.trim() ? "not-allowed" : "pointer",
                                                                        display: "flex", alignItems: "center", gap: 4
                                                                    }}
                                                                >
                                                                    <Icon name="Check" size={14} color="#fff" />
                                                                </button>
                                                                <button
                                                                    onClick={cancelarEditarCategoriaGasto}
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
                                                            <>
                                                                <Icon name="Tag" size={16} color="var(--primary-mid)" />
                                                                <span style={{ flex: 1, fontWeight: 600, fontSize: "0.8rem", color: "var(--text-main)" }}>
                                                                    {cat}
                                                                </span>
                                                                {cat !== "Otros" && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => iniciarEditarCategoriaGasto(cat)}
                                                                            title={`Renombrar "${cat}"`}
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
                                                                        <button onClick={() => setConfirmEliminarCatGasto(cat)}
                                                                            title={`Eliminar "${cat}"`}
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
                                                            </>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                    </div>{/* fin contenido colapsable */}
                                </div>
                            </div>

                            {/* Lista / Tabla */}
                            <div className="card fade-up" style={{ flex: "1 1 400px", overflow: "hidden" }}>
                                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-primary)", backgroundColor: "var(--bg-card)" }}>
                                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>
                                        <span style={{ marginRight: 6, verticalAlign: "middle", display: "inline-flex" }}>
                                            <Icon name="ListChecks" size={18} />
                                        </span>
                                        Movimientos
                                    </h3>
                                </div>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                        <thead>
                                            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                                                {["Fecha", "Categoría", "Gasto", "Monto", "Estado", ""].map(h => (
                                                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gastos.map(g => {
                                                const esPendiente = g.estado === "pendiente"
                                                const badge = estadoBadge(g.estado)
                                                return (
                                                    <tr key={g.id} style={{
                                                        borderBottom: "1px solid var(--bg-card)",
                                                        background: esPendiente ? "var(--bg-warning)" : "transparent",
                                                        borderLeft: esPendiente ? "3px solid #f59e0b" : "3px solid transparent",
                                                        opacity: g.estado === "descartado" ? 0.5 : 1,
                                                        transition: "background 0.15s",
                                                    }} className={esPendiente ? "" : "hover:bg-primary-50/20"}>
                                                        <td style={{ padding: "12px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                                            {(g.fecha || '').split('T')[0].split('-').reverse().join('/') || '—'}
                                                        </td>
                                                        <td style={{ padding: "12px 14px" }}>
                                                            {editandoId === g.id ? (
                                                                <select className="input-primary" style={{ padding: "4px 8px", fontSize: "0.75rem", fontWeight: 600 }}
                                                                    value={editCategoria} onChange={e => setEditCategoria(e.target.value)}>
                                                                    {categoriasGasto.map(c => <option key={c} value={c}>{c}</option>)}
                                                                </select>
                                                            ) : (
                                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "#fdf2f8", color: "var(--primary-dark)", padding: "3px 8px", borderRadius: 12 }}>
                                                                    {g.categoria}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                                                            {editandoId === g.id ? (
                                                                <input type="text" className="input-primary" style={{ padding: "4px 8px", fontSize: "0.85rem", fontWeight: 600, minWidth: 120 }}
                                                                    value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} />
                                                            ) : g.descripcion}
                                                        </td>
                                                        <td style={{ padding: "12px 14px", fontWeight: 800, color: esPendiente ? "#d97706" : "#b71c1c" }}>
                                                            {editandoId === g.id ? (
                                                                <input type="number" step="0.01" min="0.01" className="input-primary" style={{ width: 100, padding: "4px 8px", fontSize: "0.85rem", fontWeight: 700 }}
                                                                    value={editMonto} onChange={e => setEditMonto(e.target.value)} />
                                                            ) : `-$${g.monto.toFixed(2)}`}
                                                        </td>
                                                        <td style={{ padding: "12px 14px" }}>
                                                            <span style={{
                                                                fontSize: "0.7rem", fontWeight: 700,
                                                                background: badge.bg, color: badge.color,
                                                                padding: "3px 8px", borderRadius: 12,
                                                                display: "inline-flex", alignItems: "center", gap: 4,
                                                            }}>
                                                                {esPendiente && <Icon name="Timer" size={12} />}
                                                                {badge.label}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                                                            {editandoId === g.id ? (
                                                                <span style={{ display: "inline-flex", gap: 4 }}>
                                                                    <button onClick={() => guardarEdicion(g.id)} title="Guardar cambios"
                                                                        style={{ background: "var(--bg-success)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "#16a34a", display: "inline-flex", alignItems: "center" }}
                                                                        onMouseEnter={e => { e.currentTarget.style.background = "#bbf7d0"; e.currentTarget.style.color = "#15803d" }}
                                                                        onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-success)"; e.currentTarget.style.color = "#16a34a" }}>
                                                                        <Icon name="Check" size={16} />
                                                                    </button>
                                                                    <button onClick={cancelarEdicion} title="Cancelar"
                                                                        style={{ background: "transparent", border: "1.5px solid var(--border-primary)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
                                                                        onMouseEnter={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.borderColor = "#fca5a5"; e.currentTarget.style.color = "#b91c1c" }}
                                                                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-primary)"; e.currentTarget.style.color = "var(--text-muted)" }}>
                                                                        <Icon name="X" size={16} />
                                                                    </button>
                                                                </span>
                                                            ) : esPendiente ? (
                                                                <span style={{ display: "inline-flex", gap: 4 }}>
                                                                    <button onClick={() => confirmar(g.id)} title="Confirmar pago"
                                                                        style={{ background: "var(--bg-success)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "#16a34a", display: "inline-flex", alignItems: "center" }}
                                                                        onMouseEnter={e => { e.currentTarget.style.background = "#bbf7d0"; e.currentTarget.style.color = "#15803d" }}
                                                                        onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-success)"; e.currentTarget.style.color = "#16a34a" }}>
                                                                        <Icon name="Check" size={16} />
                                                                    </button>
                                                                    <button onClick={() => setConfirmDescartarGastoId(g.id)} title="Descartar gasto"
                                                                        style={{ background: "transparent", border: "1.5px solid var(--border-primary)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
                                                                        onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.borderColor = "#9ca3af" }}
                                                                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-primary)" }}>
                                                                        <Icon name="X" size={16} />
                                                                    </button>
                                                                </span>
                                                            ) : (
                                                                <span style={{ display: "inline-flex", gap: 20, alignItems: "center" }}>
                                                                    <button onClick={() => iniciarEdicion(g)} title="Editar gasto"
                                                                        style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.35, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px", borderRadius: 8, minWidth: 32, minHeight: 32, transition: "opacity 0.15s, background 0.15s" }}
                                                                        onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.background = "var(--bg-card2)" }}
                                                                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.35"; e.currentTarget.style.background = "transparent" }}>
                                                                        <Icon name="Pencil" size={16} />
                                                                    </button>
                                                                    <button onClick={() => setConfirmEliminarGastoId(g.id)} title="Eliminar gasto"
                                                                        style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.3, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px", borderRadius: 8, minWidth: 32, minHeight: 32, transition: "opacity 0.15s, background 0.15s" }}
                                                                        onMouseEnter={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.background = "var(--bg-card2)" }}
                                                                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.3"; e.currentTarget.style.background = "transparent" }}>
                                                                        <Icon name="Trash2" size={16} />
                                                                    </button>
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                            {gastos.length === 0 && !cargando && (
                                                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No hay gastos registrados.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ── Tab: Gastos Programados ── */}
                {tab === "programados" && (
                    <GestionGastosProgramados />
                )}

                {/* ── Modal: Confirmar eliminar gasto ── */}
                {confirmEliminarGastoId !== null && (
                    <ModalConfirmacion
                        icon="Trash2"
                        iconBg="#ffeef0"
                        iconColor="#ad4955ff"
                        titulo="Eliminar gasto"
                        mensaje="¿Estás seguro de eliminar este gasto? Esta acción no se puede deshacer."
                        btnConfirmar="Sí, eliminar"
                        btnColor="#ad4955ff"
                        onCancelar={() => setConfirmEliminarGastoId(null)}
                        onConfirmar={() => eliminar(confirmEliminarGastoId)}
                    />
                )}

                {/* ── Modal: Confirmar descartar gasto pendiente ── */}
                {confirmDescartarGastoId !== null && (
                    <ModalConfirmacion
                        icon="X"
                        iconBg="#f3f4f6"
                        iconColor="#6b7280"
                        titulo="Descartar gasto pendiente"
                        mensaje="¿Estás seguro de descartar este gasto pendiente? El gasto se marcará como descartado y no contará en las estadísticas."
                        btnConfirmar="Sí, descartar"
                        btnColor="#6b7280"
                        onCancelar={() => setConfirmDescartarGastoId(null)}
                        onConfirmar={() => descartar(confirmDescartarGastoId)}
                    />
                )}

                {/* ── Modal: Confirmar eliminar categoría de gasto ── */}
                {confirmEliminarCatGasto !== null && (
                    <ModalConfirmacion
                        icon="Trash2"
                        iconBg="#ffeef0"
                        iconColor="#ad4955ff"
                        titulo="Eliminar categoría"
                        mensaje={`¿Eliminar la categoría "${confirmEliminarCatGasto}"? Los gastos existentes se reasignarán a "Otros".`}
                        btnConfirmar="Sí, eliminar"
                        btnColor="#ad4955ff"
                        onCancelar={() => setConfirmEliminarCatGasto(null)}
                        onConfirmar={confirmarEliminarCategoriaGasto}
                    />
                )}

                <div style={{ height: 32 }} />
            </div>
        </div>
    )
}

// =============================================================================
// Componente reutilizable: Modal de confirmación
// =============================================================================
function ModalConfirmacion({
    icon,
    iconBg,
    iconColor,
    titulo,
    mensaje,
    btnConfirmar,
    btnColor,
    onCancelar,
    onConfirmar,
}: {
    icon: string
    iconBg: string
    iconColor: string
    titulo: string
    mensaje: string
    btnConfirmar: string
    btnColor: string
    onCancelar: () => void
    onConfirmar: () => void
}) {
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
                        background: iconBg, display: "flex",
                        alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                        <Icon name={icon as any} size={24} color={iconColor} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                            {titulo}
                        </h3>
                    </div>
                </div>

                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                    {mensaje}
                </p>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={onCancelar}
                        style={{
                            padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)", color: "var(--text-main)",
                            fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                            transition: "all 0.15s"
                        }}
                    >
                        Cancelar
                    </button>
                    <button onClick={onConfirmar}
                        style={{
                            padding: "10px 20px", borderRadius: 10, border: "none",
                            background: btnColor,
                            color: "#fff",
                            fontWeight: 700, fontSize: "0.82rem",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 8,
                            transition: "all 0.15s"
                        }}
                    >
                        <Icon name={icon as any} size={16} color="#fff" /> {btnConfirmar}
                    </button>
                </div>
            </div>
        </div>
    )
}
