import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import GaleriaProducto from "@/components/ui/GaleriaProducto"
import type { FotoGaleria } from "@/components/ui/GaleriaProducto"
import type { Producto } from "@/lib/api"
import type { FormAltaProducto, NuevaVariacionAlta, NuevoMaterialAlta } from "@/hooks/useInventarioForm"
import Input from "./Input"
import AltaVariaciones from "./AltaVariaciones"
import AltaMateriales from "./AltaMateriales"
import SelectorSufijoPrecio from "./SelectorSufijoPrecio"

interface Props {
    form: FormAltaProducto
    setForm: Dispatch<SetStateAction<FormAltaProducto>>
    categoriasExistentes: string[]
    nuevaCategoria: string
    setNuevaCategoria: Dispatch<SetStateAction<string>>
    agregarCategoria: () => void
    nuevasFotos: FotoGaleria[]
    setNuevasFotos: Dispatch<SetStateAction<FotoGaleria[]>>
    guardando: boolean
    planLocked: boolean
    relacionImagen: string
    esMovil: boolean
    nuevasVariaciones: NuevaVariacionAlta[]
    setNuevasVariaciones: Dispatch<SetStateAction<NuevaVariacionAlta[]>>
    nuevosMateriales: NuevoMaterialAlta[]
    setNuevosMateriales: Dispatch<SetStateAction<NuevoMaterialAlta[]>>
    inv: Producto[]
    guardarNuevo: () => Promise<void>
}

/** Card "Dar de alta producto" de la pestaña Nuevo. */
export default function CardAltaProducto({
    form, setForm,
    categoriasExistentes,
    nuevaCategoria, setNuevaCategoria,
    agregarCategoria,
    nuevasFotos, setNuevasFotos,
    guardando, planLocked, relacionImagen, esMovil,
    nuevasVariaciones, setNuevasVariaciones,
    nuevosMateriales, setNuevosMateriales,
    inv, guardarNuevo,
}: Props) {
    return (
        <div className="card fade-up md:flex-1" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>Dar de alta producto</h2>
            {/* Tipo de producto: stock, servicio (sin stock) o compuesto (receta) */}
            <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8 }}>Tipo de producto</label>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, tipo_producto: "stock" }))}
                        style={{
                            flex: 1, padding: "10px 12px", borderRadius: 12, border: "none", cursor: "pointer",
                            fontSize: "0.78rem", fontWeight: 700, transition: "all 0.15s",
                            background: form.tipo_producto === "stock" ? "var(--primary-mid)" : "var(--bg-card2)",
                            color: form.tipo_producto === "stock" ? "#fff" : "var(--text-main)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexDirection: esMovil ? "column" : "row", gap: esMovil ? 4 : 6,
                        }}
                    >
                        <Icon name="Package" size={16} /> Con stock
                    </button>
                    <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, tipo_producto: "servicio" }))}
                        style={{
                            flex: 1, padding: "10px 12px", borderRadius: 12, border: "none", cursor: "pointer",
                            fontSize: "0.78rem", fontWeight: 700, transition: "all 0.15s",
                            background: form.tipo_producto === "servicio" ? "var(--primary-mid)" : "var(--bg-card2)",
                            color: form.tipo_producto === "servicio" ? "#fff" : "var(--text-main)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexDirection: esMovil ? "column" : "row", gap: esMovil ? 4 : 6,
                        }}
                    >
                        <Icon name="Scissors" size={16} /> Servicio (sin stock)
                    </button>
                    <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, tipo_producto: "compuesto" }))}
                        style={{
                            flex: 1, padding: "10px 12px", borderRadius: 12, border: "none", cursor: "pointer",
                            fontSize: "0.78rem", fontWeight: 700, transition: "all 0.15s",
                            background: form.tipo_producto === "compuesto" ? "var(--primary-mid)" : "var(--bg-card2)",
                            color: form.tipo_producto === "compuesto" ? "#fff" : "var(--text-main)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexDirection: esMovil ? "column" : "row", gap: esMovil ? 4 : 6,
                        }}
                    >
                        <Icon name="Hamburger" size={16} /> Compuesto (receta)
                    </button>
                </div>
                <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "6px 0 0" }}>
                    {form.tipo_producto === "servicio"
                        ? "Se vende sin límite de inventario (ej. corte de cabello, consulta, lavado de auto)."
                        : form.tipo_producto === "compuesto"
                            ? "Se vende y consume stock de sus materiales (ej. hamburguesa: pan + carne + queso). Añade los ingredientes más abajo."
                            : "Se lleva control de inventario por lotes (ej. peluches, plantas, ropa)."}
                </p>
            </div>
            <Input label="Nombre del producto" value={form.producto} onChange={e => setForm(p => ({ ...p, producto: e.target.value }))} />
            <Input label="Descripción" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Input label="Código interno" value={form.codigo_interno} onChange={e => setForm(p => ({ ...p, codigo_interno: e.target.value }))} />
                <Input label="Código de barras" value={form.codigo_barras} onChange={e => setForm(p => ({ ...p, codigo_barras: e.target.value }))} />
                <Input label="Ubicación" value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} />
            </div>
            <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8 }}>Categorías</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {/* Chips de categorías existentes */}
                    {categoriasExistentes.map(cat => {
                        const activa = form.categoria.includes(cat)
                        return (
                            <button
                                key={cat}
                                onClick={() => setForm(f => ({
                                    ...f,
                                    categoria: activa
                                        ? f.categoria.filter(c => c !== cat)
                                        : [...f.categoria, cat]
                                }))}
                                style={{
                                    background: activa ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: activa ? "#fff" : "var(--primary-text)",
                                    border: "none", borderRadius: 12,
                                    padding: "4px 10px", fontSize: "0.65rem", fontWeight: 700,
                                    cursor: "pointer", transition: "all 0.15s"
                                }}
                            >
                                {cat} {activa ? "✓" : "+"}
                            </button>
                        )
                    })}
                </div>
                {/* Input rápido para crear una categoría nueva */}
                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                    <input
                        type="text"
                        placeholder="Nueva categoría..."
                        value={nuevaCategoria}
                        onChange={e => setNuevaCategoria(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") agregarCategoria() }}
                        style={{
                            flex: 1,
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--border-primary)",
                            fontSize: "0.78rem",
                            outline: "none",
                            background: "var(--bg-card2)",
                            color: "var(--text-main)"
                        }}
                    />
                    <button
                        onClick={agregarCategoria}
                        disabled={!nuevaCategoria.trim()}
                        style={{
                            background: nuevaCategoria.trim() ? "var(--primary-mid)" : "var(--bg-card2)",
                            color: nuevaCategoria.trim() ? "#fff" : "var(--text-muted)",
                            border: "none", borderRadius: 10,
                            padding: "6px 14px", fontWeight: 700, fontSize: "0.8rem",
                            cursor: nuevaCategoria.trim() ? "pointer" : "not-allowed",
                            transition: "all 0.15s",
                            whiteSpace: "nowrap"
                        }}
                    >
                        + Crear
                    </button>
                </div>
            </div>
            <GaleriaProducto
                fotos={nuevasFotos}
                onChange={setNuevasFotos}
                maxFotos={5}
                disabled={guardando}
                label="Fotos del producto"
                planLocked={planLocked}
                aspectRatio={relacionImagen === "4 / 5" ? 4 / 5 : 1}
            />
            <div style={{ display: "grid", gridTemplateColumns: form.tipo_producto === "stock" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
                {form.tipo_producto === "stock" && (
                    <Input label="Cantidad" type="number" min={0} step="0.1" placeholder="1" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value === "" ? "" : Number(e.target.value) }))} />
                )}
                {form.tipo_producto === "compuesto" ? (
                    <Input label="Precio de venta" type="number" min={0} step="0.01" placeholder="0.00" value={form.precio_venta} onChange={e => setForm(p => ({ ...p, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))} />
                ) : (
                    <>
                        <Input label="Costo" type="number" min={0} step="0.01" placeholder="0.00" value={form.costo} onChange={e => setForm(p => ({ ...p, costo: e.target.value === "" ? "" : Number(e.target.value) }))} />
                        <Input label="Precio de venta" type="number" min={0} step="0.01" placeholder="0.00" value={form.precio_venta} onChange={e => setForm(p => ({ ...p, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))} />
                    </>
                )}
            </div>
            {form.tipo_producto === "compuesto" && (
                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="Lightbulb" size={14} /> El costo real se calcula en vivo al vender (según el costo de los ingredientes). Puedes añadirlos aquí abajo o después, en "Editar Prod.".
                </p>
            )}
            {/* Visible en catálogo: por defecto activo, para que un ingrediente
                (material de compuestos) no aparezca accidentalmente en el catálogo */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Visible en catálogo</label>
                <select
                    className="input-primary"
                    value={form.visible_en_catalogo ? "true" : "false"}
                    onChange={e => setForm(p => ({ ...p, visible_en_catalogo: e.target.value === "true" }))}
                    title={form.visible_en_catalogo
                        ? "Este producto se mostrará en tu catálogo público"
                        : "Este producto quedará oculto en tu catálogo público (ideal para ingredientes)"}
                >
                    <option value="true">Visible</option>
                    <option value="false">Oculto</option>
                </select>
            </div>

            {/* Variaciones e ingredientes: se crean junto al producto (transacción única) */}
            <AltaVariaciones
                lista={nuevasVariaciones}
                tipoStock={form.tipo_producto === "stock"}
                disabled={guardando}
                datosBase={{
                    nombre: String(form.producto || ""),
                    precio: form.precio_venta === "" ? "" : String(form.precio_venta),
                    stock: form.stock === "" ? "" : String(form.stock),
                    costo: form.costo === "" ? "" : String(form.costo),
                }}
                onAgregar={(nombre, precio, stockInicial, costo) => setNuevasVariaciones(prev => [...prev, { nombre, precio, stock_inicial: stockInicial, costo }])}
                onQuitar={(i) => setNuevasVariaciones(prev => prev.filter((_, idx) => idx !== i))}
            />
            {form.tipo_producto === "compuesto" && (
                <AltaMateriales
                    inv={inv}
                    lista={nuevosMateriales}
                    disabled={guardando}
                    onAgregar={(material, cantidad) => setNuevosMateriales(prev => [...prev, { material, cantidad }])}
                    onQuitar={(i) => setNuevosMateriales(prev => prev.filter((_, idx) => idx !== i))}
                />
            )}
            <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8 }}>Unidad de venta</label>
                <SelectorSufijoPrecio value={form.sufijo_precio} onChange={v => setForm(p => ({ ...p, sufijo_precio: v }))} fraccionable={form.fraccionable} onFraccionableChange={v => setForm(p => ({ ...p, fraccionable: v }))} />
            </div>
            {form.tipo_producto === "stock" && (
                <Input label="Etiqueta del lote (opcional)" placeholder="Ej: 20cm, Premium, Oferta" value={form.etiqueta} onChange={e => setForm(p => ({ ...p, etiqueta: e.target.value }))} />
            )}
            <button className="btn-primary" onClick={guardarNuevo} disabled={guardando || !form.producto || form.precio_venta === "" || form.precio_venta === 0}>
                {guardando ? "Procesando..." : " Dar de Alta"}
            </button>
        </div>
    )
}
