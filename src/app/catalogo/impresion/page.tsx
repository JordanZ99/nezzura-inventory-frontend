"use client"
// ==============================================================================
// src/app/catalogo/impresion/page.tsx
// CATÁLOGO PARA IMPRIMIR — Modo Local (Opción A).
//
// Página 100% client-side: lee IndexedDB (nada de red) y muestra el catálogo
// como documento listo en papel. "Descargar PDF" = window.print(): el diálogo
// del navegador ofrece "Guardar como PDF" (gratis, sin dependencias) o mandar
// directo a la impresora para la carta de precios de la pared.
//
// Dos modos: con fotos (catálogo a color) y lista (carta de precios compacta).
// La ruta vive bajo /catalogo (pública en el middleware): el acceso real lo
// decide el propio render — solo hay datos si hay licencia de dispositivo
// activa en ESTE aparato.
// ==============================================================================

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Icon from "@/components/ui/Icon"
import { obtenerModo } from "@/lib/local/modo"
import { obtenerLicencia } from "@/lib/local/licencia"
import { obtenerTenantIdHibrido } from "@/lib/local/hibrido"
import { getCargaCatalogo, type CargaCatalogo } from "@/lib/local/repos/catalogo"
import { formatearPrecio } from "@/lib/posts"

/** Precio visible del producto:
 *  - Con variaciones → lista compacta ("Sencilla $2 · Doble $3").
 *  - Lotes con precios distintos → rango ("$10 – $15") + sufijo.
 *  - Precio único → "$35" + sufijo ("c/u", "por kilo"...). */
function textosPrecio(p: import("@/types").Producto): { principal: string, secundario: string } {
    if (p.variaciones?.length) {
        return {
            principal: p.variaciones.map(v => `${v.nombre} ${formatearPrecio(v.precio)}`.trim()).join(" · "),
            secundario: "",
        }
    }
    const sufijo = p.sufijo_precio ? ` ${p.sufijo_precio}` : ""
    const bajo = p.precio_min ?? p.precio_venta
    const alto = p.precio_max ?? p.precio_venta
    if (bajo > 0 && alto > bajo) return { principal: `${formatearPrecio(bajo)} – ${formatearPrecio(alto)}${sufijo}`, secundario: "" }
    return { principal: `${formatearPrecio(p.precio_venta)}${sufijo}`, secundario: "" }
}

// ── Estilos del documento (pantalla = vista previa de papel; @media print) ──
const CSS_DOCUMENTO = `
.cat-imp { background: #f1f2f4; }
.cat-doc { max-width: 860px; margin: 0 auto; background: #fff; color: #14181c;
  box-shadow: 0 2px 18px rgba(0,0,0,0.12); border-radius: 4px; }
.cat-cabecera { text-align: center; padding: 34px 28px 22px; border-bottom: 2px solid #14181c; }
.cat-cabecera img.cat-logo { width: 88px; height: 88px; border-radius: 50%; object-fit: cover;
  border: 2px solid #14181c; background: #fff; }
.cat-cabecera h1 { font-size: 1.8rem; font-weight: 800; margin: 14px 0 6px; letter-spacing: -0.4px; }
.cat-contacto { font-size: 0.78rem; color: #4a5361; line-height: 1.7; }
.cat-seccion { padding: 22px 26px 4px; break-inside: avoid; }
.cat-seccion h2 { font-size: 1.02rem; font-weight: 800; margin: 0 0 12px; padding-bottom: 4px;
  border-bottom: 1.5px solid #d6d9de; letter-spacing: 0.3px; }
.cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.cat-item { break-inside: avoid; }
.cat-foto { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px;
  background: #f3f4f6; border: 1px solid #e4e6ea; display: block; }
.cat-nombre { font-size: 0.83rem; font-weight: 700; margin: 7px 0 2px; line-height: 1.25; }
.cat-precio { font-size: 0.95rem; font-weight: 800; }
.cat-sufijo { font-size: 0.72rem; color: #6b7482; font-weight: 600; }
.cat-nota  { font-size: 0.7rem; color: #6b7482; line-height: 1.35; margin: 1px 0 0; }
.cat-var   { font-size: 0.68rem; color: #4a5361; margin: 2px 0 0; line-height: 1.4; }
.cat-descripcion { font-size: 0.72rem; color: #4a5361; margin: 2px 0 0; line-height: 1.35; }
.cat-renglon { display: flex; align-items: baseline; gap: 8px; padding: 5px 0; break-inside: avoid; }
.cat-renglon .r-nombre { font-size: 0.83rem; font-weight: 600; }
.cat-renglon .r-puntos { flex: 1; border-bottom: 1px dotted #9aa1ab; transform: translateY(-3px); }
.cat-renglon .r-precio { font-size: 0.85rem; font-weight: 800; white-space: nowrap; }
.cat-pie { text-align: center; font-size: 0.7rem; color: #7c848f; padding: 22px 28px 26px;
  border-top: 1px solid #e4e6ea; margin-top: 26px; }

@media print {
  @page { size: A4; margin: 10mm; }
  html, body { background: #fff !important; }
  .cat-imp { background: #fff !important; }
  .cat-no-imp { display: none !important; }
  .cat-doc { box-shadow: none; border-radius: 0; max-width: none; margin: 0; }
  .cat-seccion { break-inside: avoid; }
}
`

export default function CatalogoImpresion() {
    const [carga, setCarga] = useState<CargaCatalogo | null>(null)
    const [estado, setEstado] = useState<"cargando" | "no-local" | "listo" | "vacio">("cargando")
    const [conFotos, setConFotos] = useState(true)
    const [ocultarAgotados, setOcultarAgotados] = useState(false)

    useEffect(() => {
        if (obtenerModo() !== "local" || (!obtenerLicencia() && !obtenerTenantIdHibrido())) {
            setEstado("no-local")
            return
        }
        getCargaCatalogo()
            .then(c => {
                setCarga(c)
                setEstado(c.productos.length ? "listo" : "vacio")
            })
            .catch(() => setEstado("no-local"))
    }, [])

    // Agrupar por categoría (en el orden de la parrilla); sin categoría → "Otros"
    const secciones = useMemo(() => {
        if (!carga) return []
        const fila: { nombre: string, items: typeof carga.productos }[] = []
        const porNombre = new Map<string, typeof carga.productos>()
        for (const cat of carga.categorias) {
            const lista = carga.productos.filter(p => p.categoria?.includes(cat.nombre) &&
                (!ocultarAgotados || p.tipo_producto !== "stock" || (p.stock_total ?? 0) > 0))
            if (lista.length) { porNombre.set(cat.nombre, lista); fila.push({ nombre: cat.nombre, items: lista }) }
        }
        const otros = carga.productos.filter(p =>
            !(p.categoria?.length && p.categoria.some(c => porNombre.has(c))) &&
            (!ocultarAgotados || p.tipo_producto !== "stock" || (p.stock_total ?? 0) > 0))
        if (otros.length) fila.push({ nombre: "Otros", items: otros })
        return fila
    }, [carga, ocultarAgotados])

    // ── No local / sin licencia ──
    if (estado === "no-local") {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-app)", padding: 24 }}>
                <div style={{ textAlign: "center", maxWidth: 420 }}>
                    <Icon name="Printer" size={44} color="var(--primary-dark)" />
                    <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)", margin: "12px 0 8px" }}>
                        Catálogo para imprimir
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                        El catálogo para imprimir vive en Modo Local.
                        Abre tu app desde el dispositivo con la licencia activa.
                    </p>
                    <Link href="/personalizacion" style={{ display: "inline-block", marginTop: 14, color: "var(--primary-mid)", fontWeight: 800, fontSize: "0.85rem" }}>
                        ← Volver a Ajustes
                    </Link>
                </div>
            </div>
        )
    }

    if (estado !== "listo" || !carga) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-app)", padding: 24 }}>
                <div style={{ textAlign: "center", maxWidth: 420 }}>
                    <Icon name="Store" size={44} color="var(--primary-dark)" />
                    <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)", margin: "12px 0 8px" }}>
                        {estado === "cargando" ? "Cargando catálogo..." : "Nada que imprimir todavía"}
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                        {estado === "vacio"
                            ? "Marca productos como visibles en catálogo (Inventario → tarjeta del producto) y vuelve aquí."
                            : ""}
                    </p>
                    {estado !== "cargando" && (
                        <Link href="/inventario" style={{ display: "inline-block", marginTop: 14, color: "var(--primary-mid)", fontWeight: 800, fontSize: "0.85rem" }}>
                            ← Ir a Inventario
                        </Link>
                    )}
                </div>
            </div>
        )
    }

    const contacto: string[] = []
    if (carga.telefono) contacto.push(carga.telefono)
    if (carga.correo) contacto.push(carga.correo)
    if (carga.sitio_web) contacto.push(carga.sitio_web)
    if (carga.instagram) contacto.push(`@${carga.instagram.replace(/^@/, "")}`)
    if (carga.facebook) contacto.push(`Facebook: ${ carga.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, "").replace(/^\/+/, "") }`)
    if (carga.maps) contacto.push("Ubicación en Google Maps")

    return (
        <div className="cat-imp" style={{ minHeight: "100vh" }}>
            <style>{CSS_DOCUMENTO}</style>

            {/* ── Barra de herramientas (pantalla, no sale en el papel) ── */}
            <div className="cat-no-imp" style={{
                display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "center",
                padding: "14px 16px", position: "sticky", top: 0, zIndex: 10,
                background: "var(--gradient-layout)", borderBottom: "1px solid var(--border-primary)",
            }}>
                <Link href="/personalizacion" style={{
                    display: "flex", alignItems: "center", gap: 5, color: "#fff", fontWeight: 700, fontSize: "0.8rem",
                }}>
                    <Icon name="ChevronLeft" size={16} /> Ajustes
                </Link>

                <div style={{ display: "flex", gap: 6, margin: "0 8px" }}>
                    <button onClick={() => setConFotos(true)} style={{
                        padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer",
                        fontSize: "0.78rem", fontWeight: 700,
                        background: conFotos ? "#fff" : "rgba(255,255,255,0.16)",
                        color: conFotos ? "#14181c" : "#fff",
                    }}>
                        Con fotos
                    </button>
                    <button onClick={() => setConFotos(false)} style={{
                        padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer",
                        fontSize: "0.78rem", fontWeight: 700,
                        background: !conFotos ? "#fff" : "rgba(255,255,255,0.16)",
                        color: !conFotos ? "#14181c" : "#fff",
                    }}>
                        Lista de precios
                    </button>
                </div>

                <label style={{
                    display: "flex", alignItems: "center", gap: 6,
                    color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                }}>
                    <input
                        type="checkbox"
                        checked={ocultarAgotados}
                        onChange={e => setOcultarAgotados(e.target.checked)}
                        style={{ accentColor: "#fff" }}
                    />
                    Ocultar agotados
                </label>

                <button onClick={() => window.print()} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "9px 18px", borderRadius: 999, border: "none", cursor: "pointer",
                    background: "var(--primary-mid)", color: "#fff", fontWeight: 800, fontSize: "0.82rem",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                }}>
                    <Icon name="Printer" size={16} /> Descargar PDF / Imprimir
                </button>
            </div>

            {/* ── Documento (lo que sale en el papel) ── */}
            <div className="cat-doc" style={{ marginBottom: 40 }}>
                <header className="cat-cabecera">
                    {carga.logo && <img className="cat-logo" src={carga.logo} alt={carga.empresa || "Logo"} />}
                    <h1>{carga.empresa || "Mi catálogo"}</h1>
                    {contacto.length > 0 && (
                        <div className="cat-contacto">{contacto.join("  ·  ")}</div>
                    )}
                </header>

                {secciones.map(sec => (
                    <section className="cat-seccion" key={sec.nombre}>
                        <h2>{sec.nombre}</h2>

                        {conFotos ? (
                            <div className="cat-grid">
                                {sec.items.map(p => {
                                    const precios = textosPrecio(p)
                                    return (
                                        <article className="cat-item" key={p.producto}>
                                            {p.imagen && <img className="cat-foto" src={p.imagen} alt={p.producto} loading="lazy" />}
                                            <div className="cat-nombre">{p.producto}</div>
                                            <div className="cat-precio">{precios.principal}</div>
                                            <div className="cat-sufijo">
                                                {p.tipo_producto === "stock" && (p.stock_total ?? 0) === 0 ? "Agotado" : ""}
                                            </div>
                                            {p.descripcion && (
                                                <div className="cat-descripcion">
                                                    {p.descripcion.length > 90 ? `${p.descripcion.slice(0, 88)}…` : p.descripcion}
                                                </div>
                                            )}
                                        </article>
                                    )
                                })}
                            </div>
                        ) : (
                            <div>
                                {sec.items.map(p => {
                                        const precios = textosPrecio(p)
                                        const nota = (p.tipo_producto === "stock" && (p.stock_total ?? 0) === 0) ? "Agotado" : ""
                                        return (
                                            <div className="cat-renglon" key={p.producto}>
                                                <span className="r-nombre">{p.producto}</span>
                                                <span className="r-puntos" aria-hidden />
                                                <span className="r-precio">
                                                    {precios.principal}{nota ? ` · ${nota}` : ""}
                                                </span>
                                            </div>
                                        )
                                    })}
                            </div>
                        )}
                    </section>
                ))}

                <footer className="cat-pie">
                    Impreso el {new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })} ·
                    Precios sujetos a cambio
                </footer>
            </div>

            {/* Astucia para móviles: Chrome no comparte PDF en el print dialog */}
            <div className="cat-no-imp" style={{ maxWidth: 640, margin: "0 auto 28px", padding: "0 18px", textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.6 }}>
                    En el diálogo de impresión elige <strong>“Guardar como PDF”</strong> (o “Imprimir”)
                    y luego compártelo por WhatsApp. Cambia precios en el inventario y vuelve a
                    generar este catálogo cuando quieras.
                </p>
            </div>
        </div>
    )
}

