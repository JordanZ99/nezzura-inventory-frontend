"use client"
// ==============================================================================
// src/app/inventario/page.tsx  —  Rediseño Argon primary -Prueba botón de guardado
// ==============================================================================
// Orquestador del módulo Inventario. Toda la lógica y la UI viven en:
//   - src/hooks/useInventarioData.ts   (datos + API + derivados)
//   - src/hooks/useInventarioForm.ts   (formularios + validaciones + compresión)
//   - src/hooks/useInventarioUI.ts     (estado visual: tabs, buscadores, modales)
//   - src/components/inventario/*      (componentes visuales por sección)
// Esta página solo compone los hooks y las secciones, sin lógica de negocio.

import { useEffect } from "react"
import Icon from "@/components/ui/Icon"
import PageHeader from "@/components/ui/PageHeader"
import ImageCropperModal from "@/components/ui/ImageCropperModal"
import { compararProductos, filtrarProductos } from "@/lib/ordenamiento"
import { useTenant } from "@/contexts/TenantContext"
import { useInventarioData } from "@/hooks/useInventarioData"
import { useInventarioForm } from "@/hooks/useInventarioForm"
import { useInventarioUI } from "@/hooks/useInventarioUI"
import CardAltaProducto from "@/components/inventario/CardAltaProducto"
import CardGestionCategorias from "@/components/inventario/CardGestionCategorias"
import GridRestock from "@/components/inventario/GridRestock"
import FormRestock from "@/components/inventario/FormRestock"
import GridEditar from "@/components/inventario/GridEditar"
import FormEditar from "@/components/inventario/FormEditar"


export default function Inventario() {
    const { tenant } = useTenant()

    // ── Hooks: datos, UI y formularios ──
    const data = useInventarioData()
    const ui = useInventarioUI()
    const formHook = useInventarioForm({
        inv: data.inv,
        actualizarInv: data.actualizarInv,
        recargar: data.recargar,
        cargarCategorias: data.cargarCategorias,
        setTab: ui.setTab,
        setRestockProdSeleccionado: ui.setRestockProdSeleccionado,
    })

    const {
        lotes,
        inv,
        categorias,
        cargandoCats,
        relacionImagen,
        cargarCategorias,
        totalActivos,
        valorInv,
        ganPotencial,
        stockDesc,
        categoriasExistentes,
    } = data
    const {
        esMovil,
        tab, setTab,
        restockBuscador, setRestockBuscador,
        restockCatSelec, setRestockCatSelec,
        restockProdSeleccionado, setRestockProdSeleccionado,
        restockOrdenamiento, setRestockOrdenamiento,
        restockBuscadorDebounced, setRestockBuscadorDebounced,
        buscadorEditar, setBuscadorEditar,
        catSelecEditar, setCatSelecEditar,
        editarOrdenamiento, setEditarOrdenamiento,
        kpiExplicacion, setKpiExplicacion,
    } = ui
    const {
        msg,
        form, setForm,
        nuevasVariaciones, setNuevasVariaciones,
        nuevosMateriales, setNuevosMateriales,
        nuevasFotos, setNuevasFotos,
        nuevaCategoria, setNuevaCategoria,
        agregarCategoria,
        guardarNuevo,
        guardando,
        restock, setRestock,
        guardarRestock,
        prodEditar, setProdEditar,
        editProdNombre, setEditProdNombre,
        editProdVal, setEditProdVal,
        editFotos, setEditFotos,
        guardarProducto,
        editVariaciones,
        nuevaVarNombre, setNuevaVarNombre,
        nuevaVarPrecio, setNuevaVarPrecio,
        nuevaVarStock, setNuevaVarStock,
        guardandoVar,
        cropVariacion,
        cargarProductoEdicion,
        registrarCambioVariacion,
        ajustarStockVariacion,
        agregarVariacion,
        eliminarVariacionItem,
        solicitarFotoVariacion,
        cancelarCropVariacion,
        completarFotoVariacion,
        quitarFotoVariacionItem,
        pendientesVarRef,
        editRecetas,
        matBuscador, setMatBuscador,
        matSeleccionado, setMatSeleccionado,
        matCantidad, setMatCantidad,
        matVariacionSel, setMatVariacionSel,
        guardandoReceta,
        matSugerencias,
        agregarMaterialItem,
        editarMaterialItem,
        eliminarMaterialItem,
        loteEditandoId, setLoteEditandoId,
        editLoteVal, setEditLoteVal,
        loteEliminarConfirm, setLoteEliminarConfirm,
        guardarLoteIndividual,
        eliminarLoteHandler,
        nuevaCatNombre, setNuevaCatNombre,
        catEditandoId, setCatEditandoId,
        catEditandoNombre, setCatEditandoNombre,
        confirmEliminarCat, setConfirmEliminarCat,
        guardarNuevaCategoria,
        iniciarEditarCategoria,
        guardarEditarCategoria,
        cancelarEditarCategoria,
        confirmarEliminarCategoria,
    } = formHook

    // Al cambiar al tab "nuevo", cargamos las categorías si no están
    useEffect(() => {
        if (tab === "nuevo") {
            cargarCategorias()
        }
    }, [tab])

    const TABS: { id: "nuevo" | "restock" | "editar"; label: string; icon: string }[] = [
        { id: "nuevo", label: "Nuevo", icon: "ClipboardPlus" },
        { id: "restock", label: "Restock", icon: "PackagePlus" },
        { id: "editar", label: "Editar Prod.", icon: "Pencil" },
    ]

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

    // Productos filtrados y ordenados para "Editar Prod."
    // (filtrado y ordenamiento compartidos con POS y Restock — src/lib/ordenamiento.ts)
    const productosEditar = filtrarProductos(inv, buscadorEditar, catSelecEditar)
        .sort((a, b) => compararProductos(a, b, editarOrdenamiento))
    // Productos filtrados y ordenados para el Restock (búsqueda también por
    // código interno/barras). Los servicios (sin stock) no se pueden
    // restockear → se excluyen.
    const productosRestock = filtrarProductos(inv, restockBuscadorDebounced, restockCatSelec, true)
        .filter(p => p.tipo_producto !== "servicio")
        .sort((a, b) => compararProductos(a, b, restockOrdenamiento))

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero ── */}
            <PageHeader
                gradiente="var(--gradient-2)"
                agColor="var(--ag-color-2)"
                subtitulo="GESTIÓN"
                subtituloStyle={{ color: "var(--primary-darkGray)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}
                titulo="Inventario"
                icono="Package"
                iconoColor="var(--primary-dark)"
                tituloClase=""
                tituloStyle={{ color: "var(--primary-dark)", fontSize: "1.7rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "12px" }}
            />

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
                        <button key={t.id} onClick={() => {
                            // Al volver a la pestaña Editar con un producto abierto,
                            // recargarlo (refresca el stock de las variaciones tras un
                            // "Ajustar stock") — solo si no hay cambios sin guardar.
                            if (t.id === "editar" && prodEditar && Object.keys(pendientesVarRef.current).length === 0) {
                                const fresco = inv.find(p => p.producto === prodEditar)
                                if (fresco) cargarProductoEdicion(fresco)
                            }
                            setTab(t.id)
                        }} style={{
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
                        <CardAltaProducto
                            form={form}
                            setForm={setForm}
                            categoriasExistentes={categoriasExistentes}
                            nuevaCategoria={nuevaCategoria}
                            setNuevaCategoria={setNuevaCategoria}
                            agregarCategoria={agregarCategoria}
                            nuevasFotos={nuevasFotos}
                            setNuevasFotos={setNuevasFotos}
                            guardando={guardando}
                            planLocked={tenant?.plan === "basico"}
                            relacionImagen={relacionImagen}
                            esMovil={esMovil}
                            nuevasVariaciones={nuevasVariaciones}
                            setNuevasVariaciones={setNuevasVariaciones}
                            nuevosMateriales={nuevosMateriales}
                            setNuevosMateriales={setNuevosMateriales}
                            inv={inv}
                            guardarNuevo={guardarNuevo}
                        />
                        <CardGestionCategorias
                            nuevaCatNombre={nuevaCatNombre}
                            setNuevaCatNombre={setNuevaCatNombre}
                            guardarNuevaCategoria={guardarNuevaCategoria}
                            guardando={guardando}
                            cargandoCats={cargandoCats}
                            categorias={categorias}
                            catEditandoId={catEditandoId}
                            setCatEditandoId={setCatEditandoId}
                            catEditandoNombre={catEditandoNombre}
                            setCatEditandoNombre={setCatEditandoNombre}
                            guardarEditarCategoria={guardarEditarCategoria}
                            cancelarEditarCategoria={cancelarEditarCategoria}
                            iniciarEditarCategoria={iniciarEditarCategoria}
                            confirmEliminarCat={confirmEliminarCat}
                            setConfirmEliminarCat={setConfirmEliminarCat}
                        />
                    </div>
                )}

                {/* ── Restock: buscador + grid (como Editar Prod.) ── */}
                {tab === "restock" && !restockProdSeleccionado && (
                    <GridRestock
                        categoriasExistentes={categoriasExistentes}
                        restockCatSelec={restockCatSelec}
                        setRestockCatSelec={setRestockCatSelec}
                        restockBuscador={restockBuscador}
                        setRestockBuscador={setRestockBuscador}
                        restockOrdenamiento={restockOrdenamiento}
                        setRestockOrdenamiento={setRestockOrdenamiento}
                        productosRestock={productosRestock}
                        onSeleccionarProducto={(prod) => {
                            setRestockProdSeleccionado(prod)
                            setRestock(r => ({
                                ...r,
                                producto: prod.producto,
                                costo: Number(prod.costo_promedio ?? 0).toFixed(2),
                                precio_venta: Number(prod.precio_venta ?? 0).toFixed(2),
                                variacion: ""
                            }))
                        }}
                        relacionImagen={relacionImagen}
                    />
                )}

                {/* ── Restock: formulario para el producto seleccionado ── */}
                {tab === "restock" && restockProdSeleccionado && (
                    <FormRestock
                        producto={restockProdSeleccionado}
                        restock={restock}
                        setRestock={setRestock}
                        guardarRestock={guardarRestock}
                        guardando={guardando}
                        lotes={lotes}
                        onVolver={() => {
                            setRestockProdSeleccionado(null)
                            setRestockBuscador("")
                            setRestockBuscadorDebounced("")
                            setRestockCatSelec("Todas")
                            setRestock({ producto: "", costo: "", precio_venta: "", stock: 1, etiqueta: "", variacion: "" })
                        }}
                    />
                )}

                {/* Editar producto — buscador */}
                {tab === "editar" && !prodEditar && (
                    <GridEditar
                        categoriasExistentes={categoriasExistentes}
                        catSelecEditar={catSelecEditar}
                        setCatSelecEditar={setCatSelecEditar}
                        buscadorEditar={buscadorEditar}
                        setBuscadorEditar={setBuscadorEditar}
                        editarOrdenamiento={editarOrdenamiento}
                        setEditarOrdenamiento={setEditarOrdenamiento}
                        productosEditar={productosEditar}
                        cargarProductoEdicion={cargarProductoEdicion}
                        relacionImagen={relacionImagen}
                    />
                )}

                {/* Editar producto — formulario + lotes */}
                {tab === "editar" && prodEditar && (
                    <FormEditar
                        prodEditar={prodEditar}
                        onVolver={() => { setProdEditar(""); setLoteEditandoId(null); setEditFotos([]) }}
                        editProdNombre={editProdNombre}
                        setEditProdNombre={setEditProdNombre}
                        editProdVal={editProdVal}
                        setEditProdVal={setEditProdVal}
                        categoriasExistentes={categoriasExistentes}
                        editFotos={editFotos}
                        setEditFotos={setEditFotos}
                        guardando={guardando}
                        planLocked={tenant?.plan === "basico"}
                        relacionImagen={relacionImagen}
                        guardarProducto={guardarProducto}
                        editVariaciones={editVariaciones}
                        guardandoVar={guardandoVar}
                        registrarCambioVariacion={registrarCambioVariacion}
                        eliminarVariacionItem={eliminarVariacionItem}
                        solicitarFotoVariacion={solicitarFotoVariacion}
                        quitarFotoVariacionItem={quitarFotoVariacionItem}
                        ajustarStockVariacion={ajustarStockVariacion}
                        nuevaVarNombre={nuevaVarNombre}
                        setNuevaVarNombre={setNuevaVarNombre}
                        nuevaVarPrecio={nuevaVarPrecio}
                        setNuevaVarPrecio={setNuevaVarPrecio}
                        nuevaVarStock={nuevaVarStock}
                        setNuevaVarStock={setNuevaVarStock}
                        agregarVariacion={agregarVariacion}
                        lotes={lotes}
                        matVariacionSel={matVariacionSel}
                        setMatVariacionSel={setMatVariacionSel}
                        editRecetas={editRecetas}
                        guardandoReceta={guardandoReceta}
                        editarMaterialItem={editarMaterialItem}
                        eliminarMaterialItem={eliminarMaterialItem}
                        matBuscador={matBuscador}
                        setMatBuscador={setMatBuscador}
                        matSeleccionado={matSeleccionado}
                        setMatSeleccionado={setMatSeleccionado}
                        matCantidad={matCantidad}
                        setMatCantidad={setMatCantidad}
                        matSugerencias={matSugerencias}
                        agregarMaterialItem={agregarMaterialItem}
                        loteEditandoId={loteEditandoId}
                        setLoteEditandoId={setLoteEditandoId}
                        editLoteVal={editLoteVal}
                        setEditLoteVal={setEditLoteVal}
                        loteEliminarConfirm={loteEliminarConfirm}
                        setLoteEliminarConfirm={setLoteEliminarConfirm}
                        guardarLoteIndividual={guardarLoteIndividual}
                        eliminarLoteHandler={eliminarLoteHandler}
                    />
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

                {/* Cropper de la foto de una variación (mismo ratio que las fotos del producto) */}
                {cropVariacion && (
                    <ImageCropperModal
                        imageUrl={cropVariacion.url}
                        aspectRatio={relacionImagen === "4 / 5" ? 4 / 5 : 1}
                        onCropComplete={completarFotoVariacion}
                        onCancel={cancelarCropVariacion}
                    />
                )}
            </div>
        </div>
    )
}
