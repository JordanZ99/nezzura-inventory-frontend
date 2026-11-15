"use client"
// ==============================================================================
// src/app/cobros/page.tsx
// Gestion de Cobros (giro 'servicios', migración 061).
// Orquestador estilo gastos/page.tsx: tabs (Cobros | Cuotas), stats de aging,
// lista con abonos, y modales de alta/edición (extra) + registrar pago.
// ==============================================================================

import { useState } from "react"
import { useQueries } from "@tanstack/react-query"
import PageHeader from "@/components/ui/PageHeader"
import ModalConfirmacion from "@/components/ui/ModalConfirmacion"
import Icon from "@/components/ui/Icon"
import { ToastBanner, useToast } from "@/components/ui/Toast"
import StatsCobros from "@/components/cobros/StatsCobros"
import ListaCobros from "@/components/cobros/ListaCobros"
import GestionCuotas from "@/components/cobros/GestionCuotas"
import GestionPlanes from "@/components/cobros/GestionPlanes"
import ModalWhatsApp from "@/components/cobros/ModalWhatsApp"
import { useTenant } from "@/contexts/TenantContext"
import { abrirWhatsApp, textoRecordatorio, textoRecibo } from "@/lib/whatsapp"
import { api } from "@/lib/api"
import { periodoActual, useAccionesCobros, useCobrosLista, useResumenCobros } from "@/hooks/useCobros"
import type { Cobro, EntradaPrograma, PagoCobro, RepartoAbono } from "@/types"

interface ClienteOption { id: string; nombre: string }

type Tab = "cobros" | "cuotas" | "planes"
type ModoExtra = "nuevo" | "editar" | null

interface FormExtra {
    cliente_id: string
    concepto: string
    monto: string
    vencimiento: string
    notas: string
    programa: EntradaPrograma[]
}

interface FormPago {
    monto: string
    metodo: string
    fecha: string
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function Cobros() {
    const { mostrarMsg } = useToast()
    const { tenant } = useTenant()
    const [tab, setTab] = useState<Tab>("cobros")
    const [periodo, setPeriodo] = useState(periodoActual())
    const [soloPendientes, setSoloPendientes] = useState(false)
    // Filtro "Hoy" (mig 080): los pendientes con vencimiento a la fecha o antes.
    const [soloHoy, setSoloHoy] = useState(false)

    const { resumen, cargando: cargandoResumen } = useResumenCobros()

    // En "Todos" (periodo vacío) se ve la cartera completa, pagados incluidos.
    const { cobros, cargando: cargandoLista } = useCobrosLista({
        periodo: periodo || undefined,
        solo_pendientes: soloPendientes,
    })
    // Filtro "Hoy" (mig 080): pendientes con vencimiento a la fecha o antes.
    const hoyISOStr = hoyISO()
    const cobrosVisibles = soloHoy
        ? cobros.filter(c => c.estado !== "pagado" && (c.vencimiento || "").slice(0, 10) <= hoyISOStr)
        : cobros

    const { clientesQuery } = useClientesOptions()
    const clientes: ClienteOption[] = clientesQuery.data ?? []

    const acciones = useAccionesCobros()

    // ── Modal: cobro extra (alta/edición) ──
    const [modoExtra, setModoExtra] = useState<ModoExtra>(null)
    const [extraEditando, setExtraEditando] = useState<Cobro | null>(null)
    const [formExtra, setFormExtra] = useState<FormExtra>(FORM_EXTRA_VACIO(hoyISO()))
    const [guardandoExtra, setGuardandoExtra] = useState(false)

    // ── Promesa de pago (mig 080) ──
    const [promesaPara, setPromesaPara] = useState<Cobro | null>(null)
    const [formPromesa, setFormPromesa] = useState(hoyISO())

    function abrirPromesa(cobro: Cobro) {
        setPromesaPara(cobro)
        setFormPromesa(cobro.promesa_fecha?.slice(0, 10) || hoyISO())
    }

    async function guardarPromesa() {
        if (!promesaPara) return
        try {
            await acciones.actualizarCobro({
                id: promesaPara.id,
                data: { promesa_fecha: formPromesa || "" },
            })
            mostrarMsg(true, formPromesa
                ? "Promesa de pago registrada — los recordatorios se pausan hasta esa fecha"
                : "Promesa quitada")
            setPromesaPara(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al registrar la promesa")
        }
    }

    /** Mig 080: recordatorio por WhatsApp (texto editable antes de enviar). */
    function abrirRecordatorio(cobro: Cobro) {
        const venc = cobro.vencimiento?.slice(0, 10) || null
        const tipo = cobro.vencido ? "vencido" : "vence_hoy"
        const texto = textoRecordatorio(tipo, {
            nombre: cobro.cliente_nombre, empresa: tenant?.empresa,
        }, cobro.concepto, cobro.saldo, {
            diasVencido: cobro.dias_vencido,
            fecha: venc,
            saldo: cobro.saldo,
            moratorios: cobro.moratorios ?? 0,
        })
        setWhatsappPara({ telefono: cobro.cliente_telefono ?? null, texto })
    }

    // ── Modal: registrar abono (o editarlo, mig 081) ──
    const [pagoPara, setPagoPara] = useState<Cobro | null>(null)
    const [modoAbono, setModoAbono] = useState<"nuevo" | "editar">("nuevo")
    const [abonoEditando, setAbonoEditando] = useState<{ cobro: Cobro; indice: number } | null>(null)
    const [formPago, setFormPago] = useState<FormPago>({ monto: "", metodo: "transferencia", fecha: hoyISO() })
    const [guardandoPago, setGuardandoPago] = useState(false)
    // Recibo tras abonar (A.3): confirmación + envío por WhatsApp opcional.
    const [recibo, setRecibo] = useState<{
        nombre: string; telefono: string | null; concepto: string
        monto: number; fecha: string; saldoRestante: number; reparto: RepartoAbono[]
    } | null>(null)
    // Mini-modal de WhatsApp con el texto editable (tú decides si se manda).
    const [whatsappPara, setWhatsappPara] = useState<{ telefono: string | null; texto: string } | null>(null)

    // ── Config de intereses moratorios (mig 079) ──
    const [configMora, setConfigMora] = useState(false)
    const [formMora, setFormMora] = useState({ activo: false, tasa: "4", gracia: "0" })
    const [cargandoMora, setCargandoMora] = useState(false)
    const [guardandoMora, setGuardandoMora] = useState(false)

    async function abrirConfigMora() {
        try {
            setCargandoMora(true)
            const perfil = await api.getPerfil()
            const m = perfil.moratorios
            setFormMora({ activo: Boolean(m?.activo), tasa: String(m?.tasa_mensual ?? 4), gracia: String(m?.dias_gracia ?? 0) })
        } catch {
            setFormMora({ activo: false, tasa: "4", gracia: "0" })
        } finally {
            setCargandoMora(false)
            setConfigMora(true)
        }
    }

    async function guardarConfigMora() {
        const tasa = Number(formMora.tasa)
        const gracia = Number(formMora.gracia)
        if (formMora.activo && !(tasa > 0 && tasa <= 100)) {
            mostrarMsg(false, "La tasa mensual debe ser mayor a 0 y menor a 100")
            return
        }
        if (formMora.activo && !(gracia >= 0 && gracia <= 60)) {
            mostrarMsg(false, "Los días de gracia deben ser entre 0 y 60")
            return
        }
        try {
            setGuardandoMora(true)
            await api.actualizarPerfilNegocio({
                moratorios: formMora.activo
                    ? { activo: true, tasa_mensual: tasa, dias_gracia: Math.round(gracia) }
                    : { activo: false },
            })
            mostrarMsg(true, formMora.activo
                ? `Moratorios activados: ${tasa}% mensual${gracia > 0 ? `, ${gracia} día(s) de gracia` : ""}`
                : "Moratorios desactivados")
            setConfigMora(false)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al guardar la configuración")
        } finally {
            setGuardandoMora(false)
        }
    }

    /** Mig 079: materializar los moratorios derivados de un cobro vencido. */
    async function cargarMoraDe(cobro: Cobro) {
        try {
            const r = await acciones.cargarMoratorios(cobro.id)
            mostrarMsg(true, `Moratorios cargados: ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(r.cargado)} (aparecen como cobro aparte)`)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al cargar los moratorios")
        }
    }

    // ── Modal: eliminar cobro ──
    const [confirmandoEliminar, setConfirmandoEliminar] = useState<Cobro | null>(null)
    // ── Modal: eliminar cuenta completa (los N cobros de una misma cuota) ──
    const [confirmandoEliminarCuenta, setConfirmandoEliminarCuenta] = useState<Cobro[] | null>(null)

    function abrirNuevoExtra() {
        setExtraEditando(null)
        setFormExtra(FORM_EXTRA_VACIO(hoyISO()))
        setModoExtra("nuevo")
    }

    function abrirEditarExtra(cobro: Cobro) {
        setExtraEditando(cobro)
        setFormExtra({
            cliente_id: cobro.cliente_id,
            concepto: cobro.concepto,
            monto: String(cobro.monto),
            vencimiento: cobro.vencimiento ? cobro.vencimiento.slice(0, 10) : "",
            notas: cobro.notas || "",
            programa: cobro.programa,
        })
        setModoExtra("editar")
    }

    async function guardarExtra() {
        const monto = Number(formExtra.monto)
        if (!formExtra.cliente_id || !formExtra.concepto.trim() || !(monto > 0)) {
            mostrarMsg(false, "Cliente, concepto y monto mayor a 0 son obligatorios")
            return
        }
        const programaLimpio = formExtra.programa.filter(p => p.etiqueta.trim() && Number(p.monto) > 0 && p.fecha)
        try {
            setGuardandoExtra(true)
            if (modoExtra === "editar" && extraEditando) {
                await acciones.actualizarCobro({
                    id: extraEditando.id,
                    data: {
                        concepto: formExtra.concepto.trim(),
                        monto,
                        vencimiento: formExtra.vencimiento || "",
                        programa: programaLimpio,
                        notas: formExtra.notas.trim(),
                    },
                })
                mostrarMsg(true, "Cobro actualizado")
            } else {
                await acciones.crearExtra({
                    cliente_id: formExtra.cliente_id,
                    concepto: formExtra.concepto.trim(),
                    monto,
                    vencimiento: formExtra.vencimiento || null,
                    programa: programaLimpio.length ? programaLimpio : undefined,
                    notas: formExtra.notas.trim() || undefined,
                })
                mostrarMsg(true, "Cobro extra creado")
            }
            setModoExtra(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al guardar el cobro")
        } finally {
            setGuardandoExtra(false)
        }
    }

    function abrirPago(cobro: Cobro) {
        setPagoPara(cobro)
        setModoAbono("nuevo")
        setAbonoEditando(null)
        setFormPago({ monto: String(cobro.saldo), metodo: "transferencia", fecha: hoyISO() })
    }

    /** Mig 081: corregir un abono ya registrado (✏️). */
    function abrirEditarAbono(cobro: Cobro, indice: number) {
        const abono = cobro.pagos[indice]
        if (!abono) return
        setAbonoEditando({ cobro, indice })
        setModoAbono("editar")
        setPagoPara(cobro)
        setFormPago({ monto: String(abono.monto), metodo: abono.metodo || "efectivo", fecha: abono.fecha || hoyISO() })
    }

    /** Mig 081: abrir el mini-modal de WhatsApp con el texto ya redactado. */
    function abrirReciboWhatsApp(cobro: Cobro, abono: PagoCobro) {
        const saldoRestante = Math.max(cobro.saldo, 0)
        const texto = textoRecibo(
            { nombre: cobro.cliente_nombre, empresa: tenant?.empresa },
            cobro.concepto, abono.monto, abono.fecha, saldoRestante,
        )
        setWhatsappPara({ telefono: cobro.cliente_telefono ?? null, texto })
    }

    /** Vista previa del reparto en cascada (mig 081) — el backend es la verdad. */
    function vistaPreviaReparto(cuentaCobros: Cobro[], monto: number) {
        const pendientes = [...cuentaCobros]
            .sort((a, b) => (a.vencimiento || "").localeCompare(b.vencimiento || ""))
            .filter(c => c.estado !== "pagado")
        let resto = monto
        const lineas: { fecha: string; monto: number; sobrepago?: boolean }[] = []
        for (const c of pendientes) {
            if (resto <= 0) break
            const a = Math.min(resto, c.saldo)
            lineas.push({ fecha: c.vencimiento?.slice(0, 10) ?? "—", monto: a })
            resto -= a
        }
        if (resto > 0 && pendientes.length) {
            lineas.push({ fecha: pendientes[pendientes.length - 1].vencimiento?.slice(0, 10) ?? "—", monto: resto, sobrepago: true })
        }
        return lineas
    }

    async function guardarPago() {
        if (!pagoPara) return
        const monto = Number(formPago.monto)
        if (!(monto > 0)) {
            mostrarMsg(false, "El abono debe ser mayor a 0")
            return
        }
        try {
            setGuardandoPago(true)
            if (modoAbono === "editar" && abonoEditando) {
                await acciones.editarAbono({
                    id: abonoEditando.cobro.id,
                    indice: abonoEditando.indice,
                    data: {
                        monto,
                        metodo: formPago.metodo as "efectivo" | "transferencia" | "tarjeta" | "otro" | null,
                        fecha: formPago.fecha,
                    },
                })
                mostrarMsg(true, "Abono actualizado")
                setPagoPara(null)
                setAbonoEditando(null)
                return
            }
            // Mig 081: en cobros de cuenta, el excedente se reparte en cascada.
            const r = await acciones.abonar({
                id: pagoPara.id,
                data: {
                    monto,
                    metodo: formPago.metodo as "efectivo" | "transferencia" | "tarjeta" | "otro" | null,
                    fecha: formPago.fecha || undefined,
                    cascada: Boolean(pagoPara.cuota_id),
                },
            })
            const reparto = r.reparto ?? []
            if (reparto.length > 1) {
                mostrarMsg(true, `Abono registrado: cubrió ${reparto.length} cobro(s) de la cuenta`)
            } else {
                mostrarMsg(true, monto >= pagoPara.saldo ? "Cobro liquidado" : "Abono registrado")
            }
            setRecibo({
                nombre: pagoPara.cliente_nombre,
                telefono: pagoPara.cliente_telefono ?? null,
                concepto: pagoPara.concepto,
                monto,
                fecha: formPago.fecha || hoyISO(),
                saldoRestante: r.cuenta_saldo ?? r.saldo,
                reparto,
            })
            setPagoPara(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al registrar el abono")
        } finally {
            setGuardandoPago(false)
        }
    }

    async function generarMes() {
        if (!periodo) {
            mostrarMsg(false, "Elige el periodo (mes) a generar")
            return
        }
        try {
            const r = await acciones.generar(periodo)
            mostrarMsg(true, r.mensaje || "Generación lista")
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al generar el mes")
        }
    }

    async function eliminarCobro() {
        if (!confirmandoEliminar) return
        try {
            const r = await acciones.eliminarCobro(confirmandoEliminar.id)
            mostrarMsg(true, r.mensaje || "Cobro eliminado")
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al eliminar el cobro")
        } finally {
            setConfirmandoEliminar(null)
        }
    }

    async function eliminarCuentaCompleta() {
        if (!confirmandoEliminarCuenta) return
        // Política: se eliminan los cobros SIN abonos (deudas programadas); los
        // que ya tienen dinero entrado se conservan para no perder el historial.
        const sinAbonos = confirmandoEliminarCuenta.filter(c => c.pagos.length === 0)
        const conDinero = confirmandoEliminarCuenta.length - sinAbonos.length
        try {
            for (const c of sinAbonos) {
                await acciones.eliminarCobro(c.id)
            }
            mostrarMsg(
                true,
                conDinero > 0
                    ? `Cuenta limpiada: ${sinAbonos.length} cobro(s) eliminado(s); ${conDinero} con abonos se conservan`
                    : `Cuenta eliminada (${sinAbonos.length} cobro(s))`,
            )
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al eliminar la cuenta")
        } finally {
            setConfirmandoEliminarCuenta(null)
        }
    }

    function alternarFiltroPendientes() {
        setSoloPendientes(v => !v)
    }

    return (
        <div style={{ minHeight: "100vh" }}>
            <PageHeader
                gradiente="var(--gradient-1)"
                agColor="var(--ag-color-1)"
                subtitulo="SERVICIOS · CARTERA POR COBRAR"
                subtituloStyle={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}
                titulo="Cobros"
                icono="Wallet"
                iconoEncerrado
                iconoColor="var(--primary-soft)"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
            />

            <div style={{ padding: "0 16px", marginTop: -60, position: "relative", zIndex: 1 }}>
                {/* Tabs (patrón TabsGastos: card blanca flotante sobre el hero) */}
                <div className="card" style={{ display: "flex", padding: 6, gap: 4, marginBottom: 20 }}>
                    {([["cobros", "Cobros"], ["cuotas", "Cuotas y ventas"], ["planes", "Mis cuentas"]] as const).map(([clave, etiqueta]) => (
                        <button key={clave} onClick={() => setTab(clave)}
                            style={{
                                flex: 1, minWidth: 80,
                                padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                                background: tab === clave ? "var(--primary-mid)" : "transparent",
                                color: tab === clave ? "#fff" : "var(--text-muted)",
                                fontSize: "0.85rem", fontWeight: 700, transition: "all 0.2s",
                            }}>
                            {etiqueta}
                        </button>
                    ))}
                </div>

                <ToastBanner />

                {tab === "cobros" && (
                    <>
                        {/* Barra de control del periodo */}
                        <div style={{
                            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
                            background: "var(--bg-card)", borderRadius: 14, padding: "12px 14px", marginBottom: 14,
                            border: "1px solid var(--border-light)",
                        }}>
                            <input
                                type="month"
                                value={periodo}
                                onChange={e => setPeriodo(e.target.value)}
                                style={{
                                    padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.8rem",
                                }}
                            />
                            <button onClick={() => setPeriodo("")}
                                title="Ver la cartera completa (todos los periodos)"
                                style={{
                                    padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                                    background: periodo === "" ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: periodo === "" ? "#fff" : "var(--text-main)",
                                    fontSize: "0.78rem", fontWeight: 800,
                                }}>
                                Todos
                            </button>
                            <div style={{ flex: 1 }} />
                            <button onClick={abrirConfigMora} title="Intereses moratorios"
                                style={{
                                    padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                                    background: "var(--bg-card2)", color: "var(--text-main)",
                                    display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 800,
                                }}>
                                <Icon name="Percent" size={15} />
                                Moratorios
                            </button>
                            <button onClick={generarMes}
                                style={{
                                    padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                                    background: "var(--bg-card2)", color: "var(--text-main)",
                                    fontSize: "0.78rem", fontWeight: 800,
                                }}>
                                Generar mes
                            </button>
                            <button onClick={abrirNuevoExtra}
                                style={{
                                    padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                                    background: "var(--primary-mid)", color: "#fff",
                                    fontSize: "0.78rem", fontWeight: 800,
                                }}>
                                + Cobro puntual
                            </button>
                        </div>

                        <StatsCobros
                            resumen={resumen}
                            cargando={cargandoResumen}
                            filtroPendientes={soloPendientes}
                            onToggleFiltroPendientes={alternarFiltroPendientes}
                        />

                        {/* Filtro "Hoy" (mig 080): agenda del día — vencidos y el que vence hoy */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <button onClick={() => setSoloHoy(v => !v)} style={{
                                padding: "7px 16px", borderRadius: 20, cursor: "pointer", fontSize: "0.75rem", fontWeight: 800,
                                border: soloHoy ? "none" : "1px solid var(--border-primary)",
                                background: soloHoy ? "var(--primary-mid)" : "var(--bg-card)",
                                color: soloHoy ? "#fff" : "var(--text-main)",
                            }}>
                                Hoy
                            </button>
                            {soloHoy && (
                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                    Pendientes vencidos o que vencen hoy
                                </span>
                            )}
                        </div>

                        <ListaCobros
                            cobros={cobrosVisibles}
                            cargando={cargandoLista}
                            onRegistrarPago={abrirPago}
                            onEditarExtra={abrirEditarExtra}
                            onEliminar={setConfirmandoEliminar}
                            onEliminarGrupo={setConfirmandoEliminarCuenta}
                            onEditarAbono={abrirEditarAbono}
                            onEnviarRecibo={abrirReciboWhatsApp}
                            onCargarMoratorios={cargarMoraDe}
                            onRecordatorio={abrirRecordatorio}
                            onPromesa={abrirPromesa}
                        />
                    </>
                )}

                {tab === "cuotas" && (
                    <GestionCuotas mostrarMsg={mostrarMsg} />
                )}

                {tab === "planes" && (
                    <GestionPlanes mostrarMsg={mostrarMsg} clientes={clientes} />
                )}
            </div>

            {/* ── Modal: cobro extra (alta/edición) ── */}
            {modoExtra !== null && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20, overflowY: "auto",
                }}>
                    <div className="card" style={{
                        maxWidth: 480, width: "100%", padding: 24, display: "flex", flexDirection: "column",
                        border: "1px solid var(--border-light)", maxHeight: "90vh", overflowY: "auto",
                    }}>
                        <h3 style={{ margin: "0 0 14px", fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>
                            {modoExtra === "editar" ? "Editar cobro puntual" : "Nuevo cobro puntual"}
                        </h3>

                        <label style={estLabel}>Cliente</label>
                        <select value={formExtra.cliente_id} onChange={e => setFormExtra({ ...formExtra, cliente_id: e.target.value })} style={estInput}>
                            <option value="">— Selecciona —</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>

                        <label style={estLabel}>Concepto</label>
                        <input value={formExtra.concepto} onChange={e => setFormExtra({ ...formExtra, concepto: e.target.value })}
                            placeholder="App de inventarios v1, cierre de año..." style={estInput} />

                        <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Monto</label>
                                <input type="number" min="0" step="0.01" value={formExtra.monto}
                                    onChange={e => setFormExtra({ ...formExtra, monto: e.target.value })} style={estInput} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Vence (opcional)</label>
                                <input type="date" value={formExtra.vencimiento}
                                    onChange={e => setFormExtra({ ...formExtra, vencimiento: e.target.value })} style={estInput} />
                            </div>
                        </div>

                        {/* Plan de pagos (opcional) */}
                        <div style={{ marginTop: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <label style={{ ...estLabel, margin: 0 }}>Plan de pagos (opcional)</label>
                                <button
                                    onClick={() => setFormExtra(prev => ({
                                        ...prev,
                                        programa: [...prev.programa, { etiqueta: "", monto: 0, fecha: "" }],
                                    }))}
                                    style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary-mid)", fontWeight: 800, fontSize: "0.75rem" }}>
                                    + Agregar pago
                                </button>
                            </div>
                            {formExtra.programa.length === 0 && (
                                <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                    Ej.: Anticipo 50% / Entrega final 50% con sus fechas comprometidas.
                                </p>
                            )}
                            {formExtra.programa.map((p, i) => (
                                <div key={i} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                    <input placeholder="Etiqueta" value={p.etiqueta}
                                        onChange={e => {
                                            const programa = [...formExtra.programa]; programa[i] = { ...programa[i], etiqueta: e.target.value }
                                            setFormExtra({ ...formExtra, programa })
                                        }} style={{ ...estInput, flex: 2 }} />
                                    <input placeholder="$" type="number" min="0" step="0.01" value={p.monto || ""}
                                        onChange={e => {
                                            const programa = [...formExtra.programa]; programa[i] = { ...programa[i], monto: Number(e.target.value) || 0 }
                                            setFormExtra({ ...formExtra, programa })
                                        }} style={{ ...estInput, flex: 1 }} />
                                    <input type="date" value={p.fecha}
                                        onChange={e => {
                                            const programa = [...formExtra.programa]; programa[i] = { ...programa[i], fecha: e.target.value }
                                            setFormExtra({ ...formExtra, programa })
                                        }} style={{ ...estInput, flex: 1.4 }} />
                                    <button title="Quitar"
                                        onClick={() => setFormExtra({ ...formExtra, programa: formExtra.programa.filter((_, j) => j !== i) })}
                                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                                        <Icon name="X" size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <label style={estLabel}>Notas</label>
                        <input value={formExtra.notas} onChange={e => setFormExtra({ ...formExtra, notas: e.target.value })}
                            placeholder="Detalle del acuerdo" style={estInput} />

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                            <button onClick={() => setModoExtra(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={guardarExtra} disabled={guardandoExtra}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "var(--primary-mid)", color: "#fff", fontWeight: 800,
                                    cursor: guardandoExtra ? "wait" : "pointer",
                                }}>
                                {guardandoExtra ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: registrar abono (o editarlo) ── */}
            {pagoPara && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20,
                }}>
                    <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24, display: "flex", flexDirection: "column", border: "1px solid var(--border-light)" }}>
                        <h3 style={{ margin: "0 0 4px", fontSize: "1.02rem", fontWeight: 800, color: "var(--text-main)" }}>
                            {modoAbono === "editar" ? "Editar abono" : `Abonar a ${pagoPara.cliente_nombre}`}
                        </h3>
                        <p style={{ margin: "0 0 12px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                            {pagoPara.concepto}
                            {modoAbono === "editar"
                                ? ` · abono de ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(abonoEditando?.cobro.pagos[abonoEditando.indice]?.monto ?? 0)}`
                                : ` · saldo ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(pagoPara.saldo)}`}
                        </p>

                        {/* Vista previa del reparto en cascada (solo cuentas, al registrar) */}
                        {modoAbono === "nuevo" && pagoPara.cuota_id && Number(formPago.monto) > pagoPara.saldo && (
                            <div style={{
                                borderRadius: 10, border: "1px solid rgba(249,168,37,0.4)", background: "rgba(249,168,37,0.08)",
                                padding: "8px 12px", marginBottom: 10,
                            }}>
                                <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 800, color: "#b45309" }}>
                                    Pago mayor al saldo: se repartirá así
                                </p>
                                <p style={{ margin: "2px 0 0", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-main)" }}>
                                    {vistaPreviaReparto(
                                        cobros.filter(c => c.cuota_id === pagoPara.cuota_id),
                                        Number(formPago.monto),
                                    ).map(l =>
                                        `${l.fecha.slice(8, 10)} nov ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(l.monto)}${l.sobrepago ? " (de más)" : ""}`
                                    ).join(" · ")}
                                </p>
                            </div>
                        )}

                        <label style={estLabel}>Monto del abono</label>
                        <input type="number" min="0" step="0.01" value={formPago.monto}
                            onChange={e => setFormPago({ ...formPago, monto: e.target.value })} style={estInput} />

                        <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Método</label>
                                <select value={formPago.metodo} onChange={e => setFormPago({ ...formPago, metodo: e.target.value })} style={estInput}>
                                    <option value="efectivo">Efectivo</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Fecha</label>
                                <input type="date" value={formPago.fecha} max={hoyISO()}
                                    onChange={e => setFormPago({ ...formPago, fecha: e.target.value })} style={estInput} />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                            <button onClick={() => { setPagoPara(null); setAbonoEditando(null) }}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={guardarPago} disabled={guardandoPago}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "var(--primary-alter)", color: "#fff", fontWeight: 800,
                                    cursor: guardandoPago ? "wait" : "pointer",
                                }}>
                                {guardandoPago ? "Guardando..." : modoAbono === "editar" ? "Guardar cambios" : "Registrar abono"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: recibo tras abonar (A.3) ── */}
            {recibo && !whatsappPara && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20,
                }}>
                    <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--border-light)" }}>
                        <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 800, color: "var(--text-main)" }}>
                            Abono registrado ✓
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-main)" }}>
                            {recibo.nombre} · {recibo.concepto}
                        </p>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                            Abono {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(recibo.monto)}
                            {" · "}Saldo restante de la cuenta: <b style={{ color: "var(--text-main)" }}>
                                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(recibo.saldoRestante)}
                            </b>
                        </p>
                        {recibo.reparto.length > 1 && (
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                Cubrió {recibo.reparto.length} cobro(s): {recibo.reparto.map(x => `${x.vencimiento?.slice(8, 10)} nov ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(x.monto)}`).join(" · ")}
                            </p>
                        )}
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                            <button onClick={() => setRecibo(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cerrar
                            </button>
                            {recibo.telefono && (
                                <button
                                    onClick={() => setWhatsappPara({
                                        telefono: recibo.telefono,
                                        texto: textoRecibo(
                                            { nombre: recibo.nombre, empresa: tenant?.empresa },
                                            recibo.concepto, recibo.monto, recibo.fecha, recibo.saldoRestante,
                                        ),
                                    })}
                                    style={{
                                        padding: "10px 18px", borderRadius: 10, border: "none",
                                        background: "#128C7E", color: "#fff", fontWeight: 800, cursor: "pointer",
                                        display: "inline-flex", alignItems: "center", gap: 8,
                                    }}>
                                    <Icon name="MessageCircle" size={16} />
                                    Enviar recibo por WhatsApp
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mini-modal: WhatsApp con texto editable (tú decides si se manda) ── */}
            {whatsappPara && (
                <ModalWhatsApp
                    telefono={whatsappPara.telefono}
                    texto={whatsappPara.texto}
                    onClose={() => { setWhatsappPara(null); setRecibo(null) }}
                />
            )}

            {/* ── Modal: promesa de pago (mig 080) ── */}
            {promesaPara && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20,
                }}>
                    <div className="card" style={{ maxWidth: 400, width: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--border-light)" }}>
                        <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 800, color: "var(--text-main)" }}>
                            Promesa de pago
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                            {promesaPara.cliente_nombre} · {promesaPara.concepto} — mientras la promesa esté vigente, los recordatorios automáticos se pausan.
                        </p>
                        <div>
                            <label style={estLabel}>Fecha comprometida</label>
                            <input type="date" value={formPromesa}
                                onChange={e => setFormPromesa(e.target.value)} style={estInput} />
                        </div>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                            <button onClick={() => setPromesaPara(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            {promesaPara.promesa_fecha && (
                                <button onClick={() => { setFormPromesa(""); guardarPromesa() }}
                                    style={{
                                        padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                        background: "var(--bg-card2)", color: "#c62828", fontWeight: 800, cursor: "pointer",
                                    }}>
                                    Quitar promesa
                                </button>
                            )}
                            <button onClick={guardarPromesa}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "var(--primary-alter)", color: "#fff", fontWeight: 800, cursor: "pointer",
                                }}>
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: config de intereses moratorios (mig 079) ── */}
            {configMora && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20,
                }}>
                    <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--border-light)" }}>
                        <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 800, color: "var(--text-main)" }}>
                            Intereses moratorios
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                            Interés simple diario sobre el saldo VENCIDO de cada cobro. Se muestra aparte y solo se cobra cuando tú lo cargas. Aviso: la tasa debe estar pactada con el cliente (sin pacto, la ley da 6% anual tras requerimiento).
                        </p>
                        {cargandoMora ? (
                            <p style={{ margin: "10px 0", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>Cargando...</p>
                        ) : (
                            <>
                                <label style={{ ...estLabel, marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                                    <input type="checkbox" checked={formMora.activo}
                                        onChange={e => setFormMora({ ...formMora, activo: e.target.checked })} />
                                    Activar intereses moratorios
                                </label>
                                {formMora.activo && (
                                    <>
                                        <label style={estLabel}>Tasa mensual (%)</label>
                                        <input type="number" min="0.01" max="100" step="0.01" value={formMora.tasa}
                                            onChange={e => setFormMora({ ...formMora, tasa: e.target.value })} style={estInput} />
                                        <label style={estLabel}>Días de gracia (0 = desde el primer día vencido)</label>
                                        <input type="number" min="0" max="60" value={formMora.gracia}
                                            onChange={e => setFormMora({ ...formMora, gracia: e.target.value })} style={estInput} />
                                    </>
                                )}
                            </>
                        )}
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                            <button onClick={() => setConfigMora(false)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={guardarConfigMora} disabled={guardandoMora || cargandoMora}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "var(--primary-mid)", color: "#fff", fontWeight: 800,
                                    cursor: guardandoMora ? "wait" : "pointer",
                                }}>
                                {guardandoMora ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: eliminar cobro ── */}
            {confirmandoEliminar && (
                <ModalConfirmacion
                    icon="Trash2"
                    iconBg="rgba(229,57,53,0.12)"
                    iconColor="#b71c1c"
                    titulo="¿Eliminar este cobro?"
                    mensaje={`Se eliminará el cobro "${confirmandoEliminar.concepto}" de ${confirmandoEliminar.cliente_nombre} y sus abonos registrados. Úsalo solo si la deuda fue capturada mal.`}
                    btnConfirmar="Eliminar"
                    btnColor="#e53935"
                    onCancelar={() => setConfirmandoEliminar(null)}
                    onConfirmar={eliminarCobro}
                />
            )}

            {/* ── Modal: eliminar cuenta completa (los N cobros de una cuota/venta) ── */}
            {confirmandoEliminarCuenta && (
                <ModalConfirmacion
                    icon="Trash2"
                    iconBg="rgba(229,57,53,0.12)"
                    iconColor="#b71c1c"
                    titulo={`¿Eliminar la cuenta de ${confirmandoEliminarCuenta[0].cliente_nombre}?`}
                    mensaje={`Se eliminarán los ${confirmandoEliminarCuenta.length} cobro(s) programados de "${confirmandoEliminarCuenta[0].concepto}". Los que ya tengan abonos registrados se conservan para no perder el dinero.`}
                    btnConfirmar="Eliminar cuenta"
                    btnColor="#e53935"
                    onCancelar={() => setConfirmandoEliminarCuenta(null)}
                    onConfirmar={eliminarCuentaCompleta}
                />
            )}
        </div>
    )
}

/** Opciones de clientes para los selects (cartera completa incluida inactiva). */
function useClientesOptions() {
    const clientesQuery = useQueries({ queries: [{ queryKey: ["cobros", "clientes-select"], queryFn: () => api.getClientes(), staleTime: 60_000 }] })[0]
    return { clientesQuery }
}

function FORM_EXTRA_VACIO(hoy: string): FormExtra {
    return { cliente_id: "", concepto: "", monto: "", vencimiento: hoy, notas: "", programa: [] }
}

const estLabel: React.CSSProperties = {
    display: "block", margin: "12px 0 6px", fontSize: "0.68rem", fontWeight: 700,
    letterSpacing: 1, textTransform: "uppercase", color: "var(--text-label)",
}

const estInput: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
    color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 600,
    boxSizing: "border-box",
}
