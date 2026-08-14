// ==============================================================================
// src/components/gastos/GestionCategorias.tsx
// Card "Gestionar Categorías" (colapsable en mobile): input para crear, lista
// con rename inline (autoFocus, Enter/Escape, Check/X) y eliminar. El estado
// de colapso es local al componente (solo se oculta en mobile).
// ==============================================================================

import { useState, type Dispatch, type SetStateAction } from "react"
import Icon from "@/components/ui/Icon"

interface Props {
    esMobile: boolean
    categoriasGasto: string[]
    cargandoCats: boolean
    nuevaCatNombre: string
    setNuevaCatNombre: Dispatch<SetStateAction<string>>
    guardandoCat: boolean
    onGuardarNueva: () => void
    catEditandoNombre: string | null
    catEditandoVal: string
    setCatEditandoVal: Dispatch<SetStateAction<string>>
    onIniciarEditar: (nombre: string) => void
    onGuardarEditar: (viejoNombre: string) => void
    onCancelarEditar: () => void
    onSolicitarEliminar: (nombre: string) => void
}

export default function GestionCategorias({
    esMobile,
    categoriasGasto,
    cargandoCats,
    nuevaCatNombre,
    setNuevaCatNombre,
    guardandoCat,
    onGuardarNueva,
    catEditandoNombre,
    catEditandoVal,
    setCatEditandoVal,
    onIniciarEditar,
    onGuardarEditar,
    onCancelarEditar,
    onSolicitarEliminar,
}: Props) {
    const [catColapsado, setCatColapsado] = useState(true)

    return (
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
                        onKeyDown={e => { if (e.key === "Enter") onGuardarNueva() }}
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
                        onClick={onGuardarNueva}
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
                                                    if (e.key === "Enter") onGuardarEditar(cat)
                                                    if (e.key === "Escape") onCancelarEditar()
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
                                                onClick={() => onGuardarEditar(cat)}
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
                                                onClick={onCancelarEditar}
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
                                                        onClick={() => onIniciarEditar(cat)}
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
                                                    <button onClick={() => onSolicitarEliminar(cat)}
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
    )
}
