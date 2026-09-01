// ==============================================================================
// src/components/mesas/ParrillaMesas.tsx
// Vista principal del POS restaurante: grid de mesas arrastrables (drag & drop
// con @dnd-kit, la posición se guarda en mesas.orden) + tile "＋ Mesa".
// Colores por estado: Libre (verde) · Ocupada (ámbar) · Cuenta (morado).
// Tocar una mesa abre su panel (PanelMesa) para pedir/cobrar.
// ==============================================================================

import { useEffect, useState } from "react"
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Icon from "@/components/ui/Icon"
import type { Mesa } from "@/lib/api"

interface Props {
    mesas: Mesa[]
    cargando: boolean
    onAbrirMesa: (mesa: Mesa) => void
    onNuevaMesa: () => void
    onEditarMesa: (mesa: Mesa) => void
    onReordenar: (ordenNuevo: { id: string; orden: number }[]) => void
}

// Colores por estado (borde superior de la tarjeta + pill)
const ESTILO_ESTADO: Record<Mesa["estado"], { color: string; bg: string }> = {
    "Libre": { color: "#2e7d32", bg: "#e8f5e9" },
    "Ocupada": { color: "#b45309", bg: "#fef3c7" },
    "Cuenta": { color: "#6d28d9", bg: "#ede9fe" },
}

function TarjetaMesa({ mesa, onAbrir, onEditar }: {
    mesa: Mesa
    onAbrir: (mesa: Mesa) => void
    onEditar: (mesa: Mesa) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mesa.id })
    const estilo = ESTILO_ESTADO[mesa.estado] ?? ESTILO_ESTADO["Libre"]

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onClick={() => onAbrir(mesa)}
            className="card fade-up"
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.55 : 1,
                zIndex: isDragging ? 10 : 1,
                padding: 12,
                cursor: "grab",
                touchAction: "none",
                borderTop: `4px solid ${estilo.color}`,
                position: "relative",
                minHeight: 118,
                display: "flex", flexDirection: "column", gap: 6,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {mesa.nombre}
                </p>
                <button
                    onClick={e => { e.stopPropagation(); onEditar(mesa) }}
                    onPointerDown={e => e.stopPropagation()}
                    title="Editar mesa"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}
                >
                    <Icon name="Pencil" size={14} color="var(--text-muted)" />
                </button>
            </div>
            <span style={{
                alignSelf: "flex-start",
                fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                color: estilo.color, background: estilo.bg, borderRadius: 6, padding: "2px 8px",
            }}>
                {mesa.estado}
            </span>
            {mesa.estado !== "Libre" ? (
                <div style={{ marginTop: "auto" }}>
                    <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>
                        {mesa.num_items} artículo(s)
                    </p>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem", color: "var(--primary-dark)" }}>
                        ${mesa.total.toFixed(2)}
                    </p>
                </div>
            ) : (
                <p style={{ margin: "auto 0", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)" }}>
                    {mesa.capacidad ? `${mesa.capacidad} pax` : "Disponible"}
                </p>
            )}
        </div>
    )
}

export function ParrillaMesas({ mesas, cargando, onAbrirMesa, onNuevaMesa, onEditarMesa, onReordenar }: Props) {
    // Orden local (optimista) para que el drag no "salte" mientras llega el refetch
    const [ordenLocal, setOrdenLocal] = useState<Mesa[]>(mesas)
    useEffect(() => { setOrdenLocal(mesas) }, [mesas])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    )

    function alSoltar(e: DragEndEvent) {
        const { active, over } = e
        if (!over || active.id === over.id) return
        const vieja = ordenLocal.findIndex(m => m.id === active.id)
        const nueva = ordenLocal.findIndex(m => m.id === over.id)
        if (vieja < 0 || nueva < 0) return
        const nuevo = arrayMove(ordenLocal, vieja, nueva)
        setOrdenLocal(nuevo)
        onReordenar(nuevo.map((m, i) => ({ id: m.id, orden: i + 1 })))
    }

    if (cargando) {
        return (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                Cargando mesas...
            </div>
        )
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={alSoltar}>
            <SortableContext items={ordenLocal.map(m => m.id)} strategy={rectSortingStrategy}>
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    gap: 12,
                }}>
                    {ordenLocal.map(m => (
                        <TarjetaMesa key={m.id} mesa={m} onAbrir={onAbrirMesa} onEditar={onEditarMesa} />
                    ))}
                    {/* Tile para crear mesa */}
                    <button
                        onClick={onNuevaMesa}
                        title="Agregar mesa"
                        style={{
                            textAlign: "center",
                            padding: 12,
                            cursor: "pointer",
                            borderRadius: 16,
                            border: "2px dashed var(--border-primary)",
                            background: "var(--bg-card)",
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            minHeight: 118, gap: 8,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary-mid)" }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-primary)" }}
                    >
                        <Icon name="Plus" size={30} color="var(--primary-mid)" />
                        <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)" }}>Mesa</span>
                    </button>
                </div>
            </SortableContext>
        </DndContext>
    )
}
