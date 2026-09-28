// ==============================================================================
// src/components/personalizacion/ListaCategoriasVisibles.tsx
// Lista de categorías del catálogo con toggle de visibilidad (click en el ojo)
// y REORDENAMIENTO por drag & drop (@dnd-kit, orden persistido en
// categorias.orden — mismo patrón que la parrilla de mesas).
// El drag solo inicia desde el asa (GripVertical); el resto de la fila es el
// botón de visibilidad, para que no compitan los gestos.
// ==============================================================================

import { useEffect, useState } from "react"
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Icon from "@/components/ui/Icon"
import type { Categoria } from "@/lib/api"

interface Props {
    categoriasCatalogo: Categoria[]
    categoriaToggling: string | null
    toggleCategoria: (categoria: string) => void
    onReordenar: (nuevaLista: Categoria[]) => void
}

function FilaCategoria({ cat, categoriaToggling, toggleCategoria }: {
    cat: Categoria
    categoriaToggling: string | null
    toggleCategoria: (categoria: string) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
    const visible = cat.visible_en_catalogo !== false

    return (
        <div
            ref={setNodeRef}
            style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: 10,
                border: `1.5px solid ${visible ? "var(--primary-mid)" : "var(--border-primary)"}`,
                background: visible ? "var(--primary-soft)" : "var(--bg-card2)",
                transition,
                transform: CSS.Transform.toString(transform),
                zIndex: isDragging ? 10 : 1,
                opacity: isDragging ? 0.7 : visible ? 1 : 0.6,
                boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.25)" : "none",
            }}
        >
            {/* Asa de arrastre: única zona que inicia el drag */}
            <span
                {...attributes}
                {...listeners}
                title="Arrastra para reordenar"
                style={{
                    touchAction: "none",
                    cursor: "grab",
                    display: "flex",
                    padding: "4px 6px 4px 2px",
                    marginRight: 6,
                    flexShrink: 0,
                    color: "var(--text-muted)",
                }}
            >
                <Icon name="GripVertical" size={16} />
            </span>

            <button
                onClick={() => toggleCategoria(cat.nombre)}
                disabled={categoriaToggling === cat.nombre}
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: categoriaToggling === cat.nombre ? "wait" : "pointer",
                    textAlign: "left",
                    width: "100%",
                    color: "inherit",
                }}
            >
                <div>
                    <span style={{
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        color: visible ? "var(--text-main)" : "var(--text-muted)",
                    }}>
                        {cat.nombre}
                    </span>
                    <span style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        marginLeft: 8,
                        fontWeight: 500,
                    }}>
                        ({cat.total_productos} productos)
                    </span>
                </div>
                <Icon
                    name={visible ? "Eye" : "EyeOff"}
                    size={18}
                    color={visible ? "var(--primary-mid)" : "var(--text-muted)"}
                />
            </button>
        </div>
    )
}

export function ListaCategoriasVisibles({ categoriasCatalogo, categoriaToggling, toggleCategoria, onReordenar }: Props) {
    // Orden local (optimista) para que el drag no "salte" mientras se guarda
    const [ordenLocal, setOrdenLocal] = useState<Categoria[]>(categoriasCatalogo)
    useEffect(() => { setOrdenLocal(categoriasCatalogo) }, [categoriasCatalogo])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    )

    function alSoltar(e: DragEndEvent) {
        const { active, over } = e
        if (!over || active.id === over.id) return
        const vieja = ordenLocal.findIndex(c => c.id === active.id)
        const nueva = ordenLocal.findIndex(c => c.id === over.id)
        if (vieja < 0 || nueva < 0) return
        const nuevoOrden = arrayMove(ordenLocal, vieja, nueva)
        setOrdenLocal(nuevoOrden)
        onReordenar(nuevoOrden)
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={alSoltar}>
            <SortableContext items={ordenLocal.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ordenLocal.map(cat => (
                        <FilaCategoria
                            key={cat.id}
                            cat={cat}
                            categoriaToggling={categoriaToggling}
                            toggleCategoria={toggleCategoria}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    )
}
