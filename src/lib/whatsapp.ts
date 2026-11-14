// ==============================================================================
// src/lib/whatsapp.ts
// Utilidad de envío por WhatsApp (giro 'servicios'): sin API de pago — abre
// wa.me con el mensaje ya redactado y EDITABLE (tú decides si se manda,
// patrón Kobsi/CobrApp). Si el cliente no tiene teléfono válido, devuelve
// false y la UI muestra aviso; jamás rompe el flujo de dinero.
// ==============================================================================

/** Normaliza un teléfono a formato internacional para wa.me. Mexico-first:
 *  10 dígitos → +52. Devuelve null si no hay número utilizable. */
export function normalizarTelefono(telefono?: string | null): string | null {
    if (!telefono) return null
    const d = String(telefono).replace(/\D/g, "")
    if (d.length < 10) return null
    if (d.length === 10) return `52${d}`
    if (d.length === 12 && d.startsWith("52")) return d
    if (d.length === 13 && d.startsWith("+52")) return d.slice(1)
    return d // otros formatos (otro país): se intenta tal cual
}

/** Abre WhatsApp con el texto listo. True = abierto; False = sin teléfono. */
export function abrirWhatsApp(telefono: string | null | undefined, texto: string): boolean {
    const tel = normalizarTelefono(telefono)
    if (!tel) return false
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, "_blank", "noopener")
    return true
}

export interface DatosMensaje {
    nombre: string
    telefono?: string | null
    empresa?: string
}

const _fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0)

/** Recibo de pago: confirmación amable con el saldo restante. */
export function textoRecibo(datos: DatosMensaje, concepto: string, abono: number, fecha: string, saldoRestante: number): string {
    const saldoTxt = saldoRestante > 0
        ? `Te quedan ${_fmt(saldoRestante)}.`
        : "¡Ya está pagado completo! 🎉"
    return (
        `Hola ${datos.nombre} 👋\n` +
        `Te confirmo tu abono de ${_fmt(abono)} (${fecha}) de ${concepto}. ${saldoTxt}\n` +
        `¡Gracias! — ${datos.empresa || "Tu negocio"}`
    )
}

/** Recordatorio de cobro (C.2): tono suave por defecto, editable en la UI. */
export function textoRecordatorio(
    tipo: "vence_manana" | "vence_hoy" | "vencido" | "promesa",
    datos: DatosMensaje,
    concepto: string,
    monto: number,
    detalles?: { diasVencido?: number; fecha?: string | null; saldo?: number; moratorios?: number; fechaPromesa?: string | null },
): string {
    const v = detalles?.fecha
    switch (tipo) {
        case "vence_manana":
            return `Hola ${datos.nombre} 👋 Un recordatorio: mañana ${v ?? ""} vence tu pago de ${concepto} (${_fmt(monto)}). ¡Saludos! — ${datos.empresa || ""}`
        case "vence_hoy":
            return `Hola ${datos.nombre} 👋 Hoy ${v ?? ""} vence tu pago de ${concepto} (${_fmt(monto)}). Cuando puedas, me avisas 🙂 — ${datos.empresa || ""}`
        case "vencido": {
            const mora = (detalles?.moratorios ?? 0) > 0
                ? `\nMoratorios al día: ${_fmt(detalles?.moratorios ?? 0)}`
                : ""
            return `Hola ${datos.nombre}, tu pago de ${concepto} (${_fmt(monto)}) está pendiente desde el ${v ?? ""} (${detalles?.diasVencido ?? 0} día(s)).${mora}\n¿Me confirmas cuándo me lo puedes pasar? 🙏 — ${datos.empresa || ""}`
        }
        case "promesa":
            return `Hola ${datos.nombre} 👋 Quedo atento a tu pago de ${concepto} (${_fmt(monto)}) el día ${detalles?.fechaPromesa ?? ""}. ¡Gracias! — ${datos.empresa || ""}`
    }
}
