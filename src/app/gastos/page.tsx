"use client"
// ==============================================================================
// src/app/gastos/page.tsx — Rediseño Argon primary
// Orquestador: hooks de dominio + componentes de sección + modales compartidos.
// ==============================================================================

import PageHeader from "@/components/ui/PageHeader"
import { ToastBanner } from "@/components/ui/Toast"
import ModalConfirmacion from "@/components/ui/ModalConfirmacion"
import GestionGastosProgramados from "@/components/GestionGastosProgramados"
import TabsGastos from "@/components/gastos/TabsGastos"
import StatsGastos from "@/components/gastos/StatsGastos"
import FormRegistrarGasto from "@/components/gastos/FormRegistrarGasto"
import GestionCategorias from "@/components/gastos/GestionCategorias"
import TablaMovimientos from "@/components/gastos/TablaMovimientos"
import { useGastosDatos } from "@/hooks/useGastosDatos"
import { useGastosForm } from "@/hooks/useGastosForm"
import { useGastosUI } from "@/hooks/useGastosUI"

export default function Gastos() {
    const { gastos, cargando, recargar, esMobile } = useGastosDatos()
    const { form, setForm, editandoId, editMonto, setEditMonto, editCategoria, setEditCategoria, editDescripcion, setEditDescripcion, confirmEliminarGastoId, setConfirmEliminarGastoId, confirmDescartarGastoId, setConfirmDescartarGastoId, categoriasGasto, cargandoCats, nuevaCatNombre, setNuevaCatNombre, catEditandoNombre, catEditandoVal, setCatEditandoVal, guardandoCat, confirmEliminarCatGasto, setConfirmEliminarCatGasto, guardarNuevaCategoriaGasto, iniciarEditarCategoriaGasto, guardarEditarCategoriaGasto, cancelarEditarCategoriaGasto, confirmarEliminarCategoriaGasto, agregar, eliminar, confirmar, descartar, iniciarEdicion, cancelarEdicion, guardarEdicion } = useGastosForm(recargar)
    const { tab, setTab, filtroPendientes, setFiltroPendientes, gastosVisibles, totalPagado, numPagados, pendientes, totalPendiente } = useGastosUI({ gastos })

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero ── */}
            <PageHeader
                gradiente="var(--gradient-4)"
                agColor="var(--ag-color-4)"
                subtitulo="EGRESOS"
                subtituloStyle={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}
                titulo="Gastos"
                icono="DollarSign"
                iconoEncerrado
                iconoColor="var(--primary-soft)"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
            />

            <div style={{ padding: "0 16px", marginTop: -60, position: "relative", zIndex: 1 }}>

                {/* ── Tabs (patrón Inventario) ── */}
                <TabsGastos tab={tab} setTab={setTab} />

                {/* ── Tab: Movimientos ── */}
                {tab === "movimientos" && (
                    <>
                        <StatsGastos
                            esMobile={esMobile}
                            totalPagado={totalPagado}
                            numPagados={numPagados}
                            pendientes={pendientes}
                            totalPendiente={totalPendiente}
                            filtroPendientes={filtroPendientes}
                            onToggleFiltro={() => setFiltroPendientes(prev => !prev)}
                        />

                        <ToastBanner />

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
                            {/* Columna izquierda: Formulario + Categorías apiladas */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: "1 1 300px", maxWidth: 400, minWidth: 0 }}>
                                <FormRegistrarGasto
                                    form={form}
                                    setForm={setForm}
                                    categoriasGasto={categoriasGasto}
                                    onAgregar={agregar}
                                />

                                <GestionCategorias
                                    esMobile={esMobile}
                                    categoriasGasto={categoriasGasto}
                                    cargandoCats={cargandoCats}
                                    nuevaCatNombre={nuevaCatNombre}
                                    setNuevaCatNombre={setNuevaCatNombre}
                                    guardandoCat={guardandoCat}
                                    onGuardarNueva={guardarNuevaCategoriaGasto}
                                    catEditandoNombre={catEditandoNombre}
                                    catEditandoVal={catEditandoVal}
                                    setCatEditandoVal={setCatEditandoVal}
                                    onIniciarEditar={iniciarEditarCategoriaGasto}
                                    onGuardarEditar={guardarEditarCategoriaGasto}
                                    onCancelarEditar={cancelarEditarCategoriaGasto}
                                    onSolicitarEliminar={setConfirmEliminarCatGasto}
                                />
                            </div>

                            {/* Lista / Tabla */}
                            <TablaMovimientos
                                gastosVisibles={gastosVisibles}
                                cargando={cargando}
                                filtroPendientes={filtroPendientes}
                                editandoId={editandoId}
                                editMonto={editMonto}
                                setEditMonto={setEditMonto}
                                editCategoria={editCategoria}
                                setEditCategoria={setEditCategoria}
                                editDescripcion={editDescripcion}
                                setEditDescripcion={setEditDescripcion}
                                categoriasGasto={categoriasGasto}
                                onGuardarEdicion={guardarEdicion}
                                onCancelarEdicion={cancelarEdicion}
                                onConfirmar={confirmar}
                                onIniciarEdicion={iniciarEdicion}
                                onSolicitarDescartar={setConfirmDescartarGastoId}
                                onSolicitarEliminar={setConfirmEliminarGastoId}
                            />
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
