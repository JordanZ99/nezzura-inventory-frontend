// ==============================================================================
// src/components/gastos/FormRegistrarGasto.tsx
// Card "Registrar Gasto": fecha, categoría (select), descripción, monto y el
// botón Añadir (deshabilitado sin descripción/monto/fecha).
// ==============================================================================

import type { Dispatch, SetStateAction } from "react"
import type { FormGasto } from "@/hooks/useGastosForm"

interface Props {
    form: FormGasto
    setForm: Dispatch<SetStateAction<FormGasto>>
    categoriasGasto: string[]
    onAgregar: () => void
}

export default function FormRegistrarGasto({ form, setForm, categoriasGasto, onAgregar }: Props) {
    return (
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
                <button className="btn-primary" style={{ marginTop: 8 }} onClick={onAgregar} disabled={!form.descripcion || !form.monto || !form.fecha}>
                    Añadir Gasto
                </button>
            </div>
        </div>
    )
}
