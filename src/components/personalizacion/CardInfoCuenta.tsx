// ==============================================================================
// src/components/personalizacion/CardInfoCuenta.tsx
// Tarjeta "Información de la Cuenta": email, tenant ID, descarga de respaldo
// (JSON/XLSX) y cerrar sesión. Todo el estado/handlers vienen de
// usePersonalizacionCuenta (la página los pasa por props).
// ==============================================================================

import Icon from "@/components/ui/Icon"

interface Props {
    cargando: boolean
    userEmail: string | null
    cargandoTenant: boolean
    tenantId?: string
    descargando: "json" | "xlsx" | null
    handleDescargarJson: () => void
    handleDescargarXlsx: () => void
    handleLogout: () => void
}

export function CardInfoCuenta({
    cargando,
    userEmail,
    cargandoTenant,
    tenantId,
    descargando,
    handleDescargarJson,
    handleDescargarXlsx,
    handleLogout,
}: Props) {
    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 320px", maxWidth: 460 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Información de la Cuenta</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>Detalles del administrador de Nezzura Digital.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 12 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Correo Electrónico</span>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>{cargando ? "Cargando..." : userEmail}</span>
                </div>
                <div style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 12 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Tenant ID</span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-main)", fontWeight: 700, wordBreak: "break-all" }}>{cargandoTenant ? "Cargando..." : tenantId}</span>
                </div>
                <div style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 12 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Mis Datos</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                            id="btn-descargar-json"
                            onClick={handleDescargarJson}
                            disabled={descargando !== null}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flex: "1 1 auto",
                                padding: "10px 16px",
                                background: "none",
                                border: "1.5px solid var(--border-primary)",
                                borderRadius: 12,
                                color: "var(--primary-icons)",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                cursor: descargando !== null ? "default" : "pointer",
                                opacity: descargando !== null ? 0.5 : 1,
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={e => { if (descargando === null) e.currentTarget.style.background = "var(--primary-soft)" }}
                            onMouseLeave={e => e.currentTarget.style.background = "none"}
                        >
                            <Icon name="Download" size={16} />
                            {descargando === "json" ? "Descargando..." : "Descargar Datos (JSON)"}
                        </button>
                        <button
                            id="btn-descargar-xlsx"
                            onClick={handleDescargarXlsx}
                            disabled={descargando !== null}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flex: "1 1 auto",
                                padding: "10px 16px",
                                background: "none",
                                border: "1.5px solid var(--border-primary)",
                                borderRadius: 12,
                                color: "var(--primary-icons)",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                cursor: descargando !== null ? "default" : "pointer",
                                opacity: descargando !== null ? 0.5 : 1,
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={e => { if (descargando === null) e.currentTarget.style.background = "var(--primary-soft)" }}
                            onMouseLeave={e => e.currentTarget.style.background = "none"}
                        >
                            <Icon name="FileSpreadsheet" size={16} />
                            {descargando === "xlsx" ? "Descargando..." : "Descargar Excel (XLSX)"}
                        </button>
                    </div>
                </div>
                <div>
                    <button
                        id="btn-logout"
                        onClick={handleLogout}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "10px 16px",
                            background: "none",
                            border: "1.5px solid var(--border-primary)",
                            borderRadius: 12,
                            color: "var(--primary-icons)",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "background 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--primary-soft)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                        <Icon name="LogOut" size={16} />
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </div>
    )
}
