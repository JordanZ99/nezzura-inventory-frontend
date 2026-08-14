// ==============================================================================
// src/components/gastos/tipos.ts
// Props compartidas entre FilaGasto y TablaMovimientos (la fila tiene 3 modos:
// ver / editando / acciones — confirmar pago, descartar, editar, eliminar).
// ==============================================================================

import type { Dispatch, SetStateAction } from "react"
import type { Gasto } from "@/lib/api"

export interface AccionesFilaGasto {
    editandoId: number | null
    editMonto: string
    setEditMonto: Dispatch<SetStateAction<string>>
    editCategoria: string
    setEditCategoria: Dispatch<SetStateAction<string>>
    editDescripcion: string
    setEditDescripcion: Dispatch<SetStateAction<string>>
    categoriasGasto: string[]
    onGuardarEdicion: (id: number) => void
    onCancelarEdicion: () => void
    onConfirmar: (id: number) => void
    onIniciarEdicion: (g: Gasto) => void
    onSolicitarDescartar: (id: number) => void
    onSolicitarEliminar: (id: number) => void
}
