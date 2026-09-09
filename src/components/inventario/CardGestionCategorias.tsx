import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import type { Categoria } from "@/lib/api"

interface Props {
    nuevaCatNombre: string
    setNuevaCatNombre: Dispatch<SetStateAction<string>>
    guardarNuevaCategoria: () => Promise<void>
    guardando: boolean
    cargandoCats: boolean
    categorias: Categoria[]
    catEditandoId: string | null
    setCatEditandoId: Dispatch<SetStateAction<string | null>>
    catEditandoNombre: string
    setCatEditandoNombre: Dispatch<SetStateAction<string>>
    guardarEditarCategoria: (viejoNombre: string) => Promise<void>
    cancelarEditarCategoria: () => void
    iniciarEditarCategoria: (cat: { id: string; nombre: string }) => void
    confirmEliminarCat: string | null
    setConfirmEliminarCat: Dispatch<SetStateAction<string | null>>
}

/** Card "Gestionar Categorías" de la pestaña Nuevo. */
export default function CardGestionCategorias({
    nuevaCatNombre, setNuevaCatNombre,
    guardarNuevaCategoria,
    guardando,
    cargandoCats,
    categorias,
    catEditandoId, setCatEditandoId,
    catEditandoNombre, setCatEditandoNombre,
    guardarEditarCategoria, cancelarEditarCategoria, iniciarEditarCategoria,
    confirmEliminarCat, setConfirmEliminarCat,
}: Props) {
    return (
        <div className="card fade-up md:flex-1" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="Tags" size={20} color="var(--primary-mid)" />
                Gestionar Categorías
            </h2>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, fontWeight: 600, flexShrink: 0 }}>
                Crea, renombra o elimina las categorías de tu inventario.
            </p>

            {/* Input para crear nueva categoría — fijo arriba */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <input
                    type="text"
                    placeholder="Nombre de la nueva categoría..."
                    value={nuevaCatNombre}
                    onChange={e => setNuevaCatNombre(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") guardarNuevaCategoria() }}
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
                    onClick={guardarNuevaCategoria}
                    disabled={!nuevaCatNombre.trim() || guardando}
                    style={{
                        background: nuevaCatNombre.trim() && !guardando ? "var(--primary-mid)" : "var(--bg-card2)",
                        color: nuevaCatNombre.trim() && !guardando ? "#fff" : "var(--text-muted)",
                        border: "none", borderRadius: 10,
                        padding: "8px 16px", fontWeight: 700, fontSize: "0.78rem",
                        cursor: nuevaCatNombre.trim() && !guardando ? "pointer" : "not-allowed",
                        transition: "all 0.15s",
                        whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: 6
                    }}
                >
                    <Icon name="Plus" size={16} color={nuevaCatNombre.trim() && !guardando ? "#fff" : "var(--text-muted)"} /> Crear
                </button>
            </div>

            {/* Separador */}
            <div style={{ height: 1, background: "var(--border-light)", margin: "4px 0", flexShrink: 0 }} />

            {/* Lista de categorías existentes — scrollable si sobran */}
            {cargandoCats ? (
                <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20, fontSize: "0.8rem" }}>
                    Cargando categorías...
                </p>
            ) : categorias.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>
                        Aún no hay categorías. ¡Crea la primera!
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1, minHeight: 0, scrollbarWidth: "thin" }}>
                    {categorias.map(cat => {
                        const editando = catEditandoId === cat.id
                        return (
                            <div
                                key={cat.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    background: "var(--bg-card2)",
                                    transition: "all 0.15s"
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = "var(--border-light)" }}
                                onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card2)" }}
                            >
                                {editando ? (
                                    /* Modo edición: input inline */
                                    <>
                                        <input
                                            type="text"
                                            value={catEditandoNombre}
                                            onChange={e => setCatEditandoNombre(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") guardarEditarCategoria(cat.nombre)
                                                if (e.key === "Escape") cancelarEditarCategoria()
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
                                            onClick={() => guardarEditarCategoria(cat.nombre)}
                                            disabled={guardando || !catEditandoNombre.trim()}
                                            style={{
                                                background: "var(--primary-mid)", color: "#fff",
                                                border: "none", borderRadius: 8,
                                                padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700,
                                                cursor: guardando || !catEditandoNombre.trim() ? "not-allowed" : "pointer",
                                                display: "flex", alignItems: "center", gap: 4
                                            }}
                                        >
                                            <Icon name="Check" size={14} color="#fff" />
                                        </button>
                                        <button
                                            onClick={cancelarEditarCategoria}
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
                                    /* Modo vista: nombre + contador + acciones */
                                    <>
                                        <Icon name="Tag" size={16} color="var(--primary-mid)" />
                                        <span style={{ flex: 1, fontWeight: 600, fontSize: "0.8rem", color: "var(--text-main)" }}>
                                            {cat.nombre}
                                        </span>
                                        <span style={{
                                            fontSize: "0.62rem",
                                            fontWeight: 700,
                                            color: "var(--primary-dark)",
                                            background: "var(--bg-app)",
                                            borderRadius: 8,
                                            padding: "2px 8px",
                                            whiteSpace: "nowrap"
                                        }}>
                                            {cat.total_productos} prod.
                                        </span>
                                        <button
                                            onClick={() => iniciarEditarCategoria(cat)}
                                            title={`Renombrar "${cat.nombre}"`}
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
                                        <button
                                            onClick={() => setConfirmEliminarCat(cat.nombre)}
                                            title={`Eliminar "${cat.nombre}"`}
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
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
