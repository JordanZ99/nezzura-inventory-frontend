// ==============================================================================
// src/components/personalizacion/CardIdentidadNegocio.tsx
// Tarjeta "Identidad del Negocio": logo (subida + URL manual), nombre de la
// empresa, modo de precio sugerido del POS y guardar cambios. Todo el estado/
// handlers vienen de usePersonalizacionCuenta vía props.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import { ToastBanner } from "@/components/ui/Toast"

interface Props {
    inputFileRef: React.RefObject<HTMLInputElement>
    logoUrl: string
    setLogoUrl: (v: string) => void
    handleLogoFile: (e: React.ChangeEvent<HTMLInputElement>) => void
    subiendoLogo: boolean
    empresa: string
    setEmpresa: (v: string) => void
    modoPrecio: string
    cambiarModoPrecio: (modo: string) => void
    guardandoModo: boolean
    guardando: boolean
    cargandoTenant: boolean
    guardarCambios: () => void
}

export function CardIdentidadNegocio({
    inputFileRef,
    logoUrl,
    setLogoUrl,
    handleLogoFile,
    subiendoLogo,
    empresa,
    setEmpresa,
    modoPrecio,
    cambiarModoPrecio,
    guardandoModo,
    guardando,
    cargandoTenant,
    guardarCambios,
}: Props) {
    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 320px", maxWidth: 460 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Identidad del Negocio</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>Personaliza el logo y el nombre de tu empresa.</p>

            <ToastBanner />

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Logo: Vista previa y subida */}
                <div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Logo del Negocio</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {/* Vista previa circular (click para cambiar) */}
                        <div
                            onClick={() => inputFileRef.current?.click()}
                            style={{
                                width: 72, height: 72, borderRadius: "50%",
                                border: "2.5px solid var(--border-primary)",
                                overflow: "hidden", flexShrink: 0,
                                background: "var(--bg-app)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer",
                                transition: "opacity 0.2s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                        >
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                <Icon name="ImageOff" size={28} color="var(--text-muted)" />
                            )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                            <input
                                ref={inputFileRef}
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={handleLogoFile}
                            />
                            <button
                                onClick={() => inputFileRef.current?.click()}
                                disabled={subiendoLogo}
                                className="btn-primary"
                                style={{ fontSize: "0.8rem", padding: "8px 14px", width: "fit-content" }}
                            >
                                {subiendoLogo ? "Subiendo..." : <><Icon name="Camera" size={16} /> Subir imagen</>}
                            </button>
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                Se optimiza a WebP automáticamente
                            </span>
                        </div>
                    </div>

                    {/* URL manual */}
                    <div style={{ marginTop: 12 }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                            O pega un enlace directo de Cloudinary
                        </span>
                        <input
                            className="input-primary"
                            placeholder="https://res.cloudinary.com/..."
                            value={logoUrl}
                            onChange={e => setLogoUrl(e.target.value)}
                            style={{ fontSize: "0.8rem" }}
                        />
                    </div>
                </div>

                {/* Nombre del negocio */}
                <div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Nombre del Negocio</span>
                    <input
                        className="input-primary"
                        placeholder="Ej: Nezzura Digital"
                        value={empresa}
                        onChange={e => setEmpresa(e.target.value)}
                        maxLength={60}
                    />
                </div>

                {/* Modo de precio sugerido del Punto de Venta */}
                <div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Precio sugerido (Punto de Venta)</span>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0 0 8px", fontWeight: 500 }}>
                        Cómo el POS sugiere el precio al agregar un producto al carrito.
                    </p>
                    <select
                        value={modoPrecio}
                        disabled={guardandoModo}
                        onChange={e => cambiarModoPrecio(e.target.value)}
                        style={{
                            width: "100%",
                            fontSize: "0.8rem",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)",
                            color: "var(--text-main)",
                            outline: "none",
                            cursor: "pointer",
                            fontWeight: 600,
                        }}
                    >
                        <option value="antiguo">Lote más antiguo con stock (recomendado)</option>
                        <option value="maximo">Precio máximo con stock</option>
                        <option value="reciente">Lote más reciente con stock</option>
                    </select>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block", marginTop: 6 }}>
                        {guardandoModo ? "Guardando..." : "Se guarda automáticamente"}
                    </span>
                </div>

                {/* Guardar Cambios */}
                <button
                    className="btn-primary"
                    onClick={guardarCambios}
                    disabled={guardando || cargandoTenant}
                    style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                    <Icon name="Save" size={16} />
                    {guardando ? "Guardando..." : "Guardar Cambios"}
                </button>
            </div>
        </div>
    )
}
