import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import GaleriaProducto from "@/components/ui/GaleriaProducto"
import type { FotoGaleria } from "@/components/ui/GaleriaProducto"
import ScrollableTable from "@/components/ui/ScrollableTable"
import type { Lote, MaterialReceta, Producto, Variacion } from "@/lib/api"
import type { FormEditProd, FormEditLote } from "@/hooks/useInventarioForm"
import Input from "./Input"
import Pill from "@/components/ui/Pill"
import SelectorSufijoPrecio from "./SelectorSufijoPrecio"
import VariacionRow from "./VariacionRow"
import MaterialRecetaRow from "./MaterialRecetaRow"

interface Props {
    prodEditar: string
    onVolver: () => void
    editProdNombre: string
    setEditProdNombre: Dispatch<SetStateAction<string>>
    editProdVal: FormEditProd
    setEditProdVal: Dispatch<SetStateAction<FormEditProd>>
    categoriasExistentes: string[]
    editFotos: FotoGaleria[]
    setEditFotos: Dispatch<SetStateAction<FotoGaleria[]>>
    guardando: boolean
    planLocked: boolean
    relacionImagen: string
    guardarProducto: () => Promise<void>
    editVariaciones: Variacion[]
    guardandoVar: boolean
    registrarCambioVariacion: (id: number, nombre: string, precio: number) => void
    eliminarVariacionItem: (id: number) => Promise<void>
    solicitarFotoVariacion: (v: Variacion, file: File) => void
    quitarFotoVariacionItem: (v: Variacion) => Promise<void>
    ajustarStockVariacion: (v: Variacion) => void
    nuevaVarNombre: string
    setNuevaVarNombre: Dispatch<SetStateAction<string>>
    nuevaVarPrecio: number | string
    setNuevaVarPrecio: Dispatch<SetStateAction<number | string>>
    nuevaVarStock: string
    setNuevaVarStock: Dispatch<SetStateAction<string>>
    agregarVariacion: () => Promise<void>
    lotes: Lote[]
    matVariacionSel: number | null
    setMatVariacionSel: Dispatch<SetStateAction<number | null>>
    editRecetas: MaterialReceta[]
    guardandoReceta: boolean
    editarMaterialItem: (id: number, cantidad: number) => Promise<void>
    eliminarMaterialItem: (id: number) => Promise<void>
    matBuscador: string
    setMatBuscador: Dispatch<SetStateAction<string>>
    matSeleccionado: string
    setMatSeleccionado: Dispatch<SetStateAction<string>>
    matCantidad: number | string
    setMatCantidad: Dispatch<SetStateAction<number | string>>
    matSugerencias: Producto[]
    agregarMaterialItem: () => Promise<void>
    loteEditandoId: string | null
    setLoteEditandoId: Dispatch<SetStateAction<string | null>>
    editLoteVal: FormEditLote
    setEditLoteVal: Dispatch<SetStateAction<FormEditLote>>
    loteEliminarConfirm: string | null
    setLoteEliminarConfirm: Dispatch<SetStateAction<string | null>>
    guardarLoteIndividual: () => Promise<void>
    eliminarLoteHandler: (id: string) => Promise<void>
    // Abre el modal "Crear post" (Posts Automáticos, Fase 1) con este producto
    onCrearPost: () => void
}

/** Formulario completo de edición de producto (info + variaciones + recetas + lotes). */
export default function FormEditar({
    prodEditar, onVolver,
    editProdNombre, setEditProdNombre,
    editProdVal, setEditProdVal,
    categoriasExistentes,
    editFotos, setEditFotos,
    guardando, planLocked, relacionImagen,
    guardarProducto,
    editVariaciones, guardandoVar,
    registrarCambioVariacion, eliminarVariacionItem,
    solicitarFotoVariacion, quitarFotoVariacionItem, ajustarStockVariacion,
    nuevaVarNombre, setNuevaVarNombre,
    nuevaVarPrecio, setNuevaVarPrecio,
    nuevaVarStock, setNuevaVarStock,
    agregarVariacion,
    lotes,
    matVariacionSel, setMatVariacionSel,
    editRecetas, guardandoReceta,
    editarMaterialItem, eliminarMaterialItem,
    matBuscador, setMatBuscador,
    matSeleccionado, setMatSeleccionado,
    matCantidad, setMatCantidad,
    matSugerencias, agregarMaterialItem,
    loteEditandoId, setLoteEditandoId,
    editLoteVal, setEditLoteVal,
    loteEliminarConfirm, setLoteEliminarConfirm,
    guardarLoteIndividual, eliminarLoteHandler,
    onCrearPost,
}: Props) {
    return (
        <>
            {/* ── Card 1: Información del producto ── */}
            <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <button
                        // Al volver: se conserva el buscador y el filtro de categorías
                        // (ya NO se limpian) y el scroll se restaura vía useEffect.
                        onClick={onVolver}
                        style={{ background: "var(--bg-card2)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}
                    >
                        <Icon name="ArrowLeft" size={18} color="var(--text-main)" /> Volver
                    </button>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-muted)" }}>Editando: <strong style={{ color: "var(--text-main)" }}>{prodEditar}</strong></span>
                    {/* Crear post (Posts Automáticos — Fase 1) */}
                    <button
                        onClick={onCrearPost}
                        title="Genera una tarjeta lista para Instagram/WhatsApp con la foto, el nombre y el precio"
                        style={{
                            marginLeft: "auto",
                            background: "var(--gradient-1)", border: "none", borderRadius: 10,
                            padding: "7px 14px", cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 6,
                            fontSize: "0.76rem", fontWeight: 800, color: "#fff",
                            transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "0.9" }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "1" }}
                    >
                        <Icon name="ImagePlus" size={16} color="#fff" /> Crear post
                    </button>
                </div>
                <Input label="Nombre del producto" value={editProdNombre} onChange={e => setEditProdNombre(e.target.value)} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <Input label="Código interno" value={editProdVal.codigo_interno} onChange={e => setEditProdVal(p => ({ ...p, codigo_interno: e.target.value }))} />
                    <Input label="Código de barras" value={editProdVal.codigo_barras} onChange={e => setEditProdVal(p => ({ ...p, codigo_barras: e.target.value }))} />
                    <Input label="Ubicación" value={editProdVal.ubicacion} onChange={e => setEditProdVal(p => ({ ...p, ubicacion: e.target.value }))} />
                </div>

                <div>
                    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8 }}>Categorías</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {categoriasExistentes.map(cat => {
                            const activa = editProdVal.categoria.includes(cat)
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setEditProdVal(p => ({ ...p, categoria: activa ? p.categoria.filter(c => c !== cat) : [...p.categoria, cat] }))}
                                    style={{ background: activa ? "var(--primary-mid)" : "var(--bg-card2)", color: activa ? "#fff" : "var(--text-main)", border: "none", borderRadius: 12, padding: "6px 14px", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                                >{cat} {activa ? "✓" : "+"}</button>
                            )
                        })}
                    </div>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>Selecciona las categorías que aplican a este producto</p>
                </div>
                <Input label="Descripción" value={editProdVal.descripcion} onChange={e => setEditProdVal(p => ({ ...p, descripcion: e.target.value }))} />

                <GaleriaProducto
                    fotos={editFotos}
                    onChange={setEditFotos}
                    maxFotos={5}
                    disabled={guardando}
                    label="Fotos del producto"
                    planLocked={planLocked}
                    aspectRatio={relacionImagen === "4 / 5" ? 4 / 5 : 1}
                />

                {/* Tipo: no es editable en edición (se define al crear) */}
                <div style={{
                    padding: "10px 14px", borderRadius: 12,
                    background: editProdVal.tipo_producto !== "stock" ? "rgba(156,39,176,0.08)" : "var(--bg-card2)",
                    border: `1px solid ${editProdVal.tipo_producto !== "stock" ? "rgba(156,39,176,0.3)" : "var(--border-light)"}`,
                    fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)",
                    display: "flex", alignItems: "center", gap: 8,
                }}>
                    {editProdVal.tipo_producto === "servicio" ? (<><Icon name="Scissors" size={16} /> Servicio (sin stock)</>) : editProdVal.tipo_producto === "compuesto" ? (<><Icon name="Hamburger" size={16} /> Compuesto (receta)</>) : (<><Icon name="Package" size={16} /> Producto con stock</>)}
                </div>

                {/* Costo/precio de servicios y compuestos (viven en el producto, no en lotes) */}
                {editProdVal.tipo_producto !== "stock" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {editProdVal.tipo_producto === "servicio" && (
                            <Input label="Costo del servicio" type="number" min={0} step="0.01" placeholder="0.00" value={editProdVal.costo_servicio} onChange={e => setEditProdVal(p => ({ ...p, costo_servicio: e.target.value === "" ? "" : Number(e.target.value) }))} />
                        )}
                        <Input
                            label={editProdVal.tipo_producto === "compuesto" ? "Precio de venta" : "Precio de venta"}
                            type="number" min={0} step="0.01" placeholder="0.00"
                            value={editProdVal.precio_servicio}
                            onChange={e => setEditProdVal(p => ({ ...p, precio_servicio: e.target.value === "" ? "" : Number(e.target.value) }))}
                        />
                    </div>
                )}
                {editProdVal.tipo_producto === "compuesto" && (
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="Lightbulb" size={14} /> El costo real se calcula en vivo al vender, según el costo de los materiales de la receta (ver "Materiales" abajo).
                    </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Unidad de venta</label>
                    <SelectorSufijoPrecio value={editProdVal.sufijo_precio} onChange={v => setEditProdVal(p => ({ ...p, sufijo_precio: v }))} fraccionable={editProdVal.fraccionable} onFraccionableChange={v => setEditProdVal(p => ({ ...p, fraccionable: v }))} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Estado</label>
                        <select className="input-primary" value={editProdVal.estado} onChange={e => setEditProdVal(p => ({ ...p, estado: e.target.value }))}>
                            <option value="Activo">Activo</option>
                            <option value="Inactivo">Inactivo</option>
                        </select>
                    </div>

                    {/* ── Visible en catálogo (select idéntico al de Estado) ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Visible en catálogo</label>
                        <select
                            className="input-primary"
                            value={editProdVal.visible_en_catalogo ? "true" : "false"}
                            onChange={e => setEditProdVal(p => ({ ...p, visible_en_catalogo: e.target.value === "true" }))}
                            title={editProdVal.visible_en_catalogo
                                ? "Este producto se muestra en tu catálogo público"
                                : "Este producto está oculto en tu catálogo público"}
                        >
                            <option value="true">Visible</option>
                            <option value="false">Oculto</option>
                        </select>
                    </div>
                </div>

                <button className="btn-primary" onClick={guardarProducto} disabled={guardando}>
                    {guardando ? "Procesando..." : "Guardar Cambios"}
                </button>
            </div>

            {/* ── Card 1.5: Variaciones (aplica a cualquier tipo de producto) ── */}
            <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                <h2 style={{ margin: "0 0 2px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="Layers" size={20} color="var(--primary-mid)" />
                    Variaciones
                </h2>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                    Presentaciones con su propio precio para este producto (ej. Sencilla $60 / Doble $95, talla S/M/L, Corte Caballero/Dama). Aparecen como selector en el POS, en el catálogo ("desde $X") y se registran en cada venta.
                </p>

                {/* Lista de variaciones existentes (cada variación lleva su
                    propio inventario: el botón "Ajustar stock" crea/llena su lote) */}
                {editVariaciones.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {editVariaciones.map(v => (
                            <VariacionRow
                                key={v.id}
                                variacion={v}
                                disabled={guardando || guardandoVar}
                                stockVisible={editProdVal.tipo_producto === "stock"}
                                onCambiar={registrarCambioVariacion}
                                onEliminar={() => eliminarVariacionItem(v.id)}
                                onCambiarFoto={(file) => solicitarFotoVariacion(v, file)}
                                onQuitarFoto={() => quitarFotoVariacionItem(v)}
                                onAjustarStock={ajustarStockVariacion}
                            />
                        ))}
                    </div>
                )}
                {editVariaciones.length === 0 && (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                        Sin variaciones todavía. Este producto se vende con un solo precio.
                    </p>
                )}

                {/* Formulario de nueva variación */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Nombre</label>
                        <input
                            className="input-primary"
                            placeholder="Ej: Doble, S, Premium"
                            value={nuevaVarNombre}                                        onChange={e => setNuevaVarNombre(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") agregarVariacion() }}
                        />
                    </div>

                    {editProdVal.tipo_producto === "stock" && (
                        <div style={{ width: 100, display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Cant. inicial</label>
                            <input
                                className="input-primary"
                                type="number" min="0" step="0.01"
                                placeholder="1"
                                title="Stock inicial de la variación: crea su lote (0 = agotada desde el inicio)"
                                value={nuevaVarStock}
                                onChange={e => setNuevaVarStock(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") agregarVariacion() }}
                            />
                        </div>
                    )}

                    <div style={{ width: 110, display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Precio $</label>
                        <input
                            className="input-primary"
                            type="number" min="0" step="0.01"
                            placeholder="0.00"
                            value={nuevaVarPrecio}
                            onChange={e => setNuevaVarPrecio(e.target.value === "" ? "" : Number(e.target.value))}
                            onKeyDown={e => { if (e.key === "Enter") agregarVariacion() }}
                        />
                    </div>
                    <button className="btn-primary" onClick={agregarVariacion} disabled={guardandoVar} style={{ whiteSpace: "nowrap" }}>
                        {guardandoVar ? "Guardando..." : "Agregar variación"}
                    </button>
                </div>
                {editProdVal.tipo_producto === "stock" && (
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>
                        La cantidad inicial crea el lote propio de la variación; pon <strong>0</strong> si la quieres agotada desde el inicio.
                    </p>
                )}
            </div>

            {/* ── Card 1.6: Materiales de la receta (solo compuestos) ── */}
            {editProdVal.tipo_producto === "compuesto" && (
                <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                    <h2 style={{ margin: "0 0 2px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="Boxes" size={20} color="var(--primary-mid)" />
                        Materiales (receta)
                    </h2>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                        Al vender 1 unidad de <strong>{prodEditar}</strong>, el gestor descuenta la cantidad indicada de cada material. Se permiten fracciones (0.5, 150, 0.25...).
                    </p>

                    {/* ── Contexto de la receta: Base o por variación ── */}
                    {(editVariaciones.length > 0) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Receta para:</span>
                            <button
                                type="button"
                                onClick={() => { setMatVariacionSel(null); setMatBuscador(""); setMatSeleccionado(""); setMatCantidad("") }}
                                style={{
                                    padding: "6px 14px", borderRadius: 14, border: "none", cursor: "pointer",
                                    fontSize: "0.72rem", fontWeight: 700, transition: "all 0.15s",
                                    background: matVariacionSel === null ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: matVariacionSel === null ? "#fff" : "var(--text-main)",
                                }}
                            >
                                Base (todas)
                            </button>
                            {editVariaciones.map(v => {
                                const activa = matVariacionSel === v.id
                                return (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => { setMatVariacionSel(v.id); setMatBuscador(""); setMatSeleccionado(""); setMatCantidad("") }}
                                        style={{
                                            padding: "6px 14px", borderRadius: 14, border: "none", cursor: "pointer",
                                            fontSize: "0.72rem", fontWeight: 700, transition: "all 0.15s",
                                            background: activa ? "var(--primary-mid)" : "var(--bg-card2)",
                                            color: activa ? "#fff" : "var(--text-main)",
                                        }}
                                    >
                                        {v.nombre}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>
                        {matVariacionSel === null
                            ? "La receta BASE se usa cuando la variación vendida no tiene receta propia."
                            : `La variación '${editVariaciones.find(v => v.id === matVariacionSel)?.nombre ?? ""}' gastará estos materiales (si vacía, se usa la Base).`}
                    </p>

                    {/* Lista de materiales del contexto seleccionado */}
                    {(() => {
                        const recetasContexto = editRecetas.filter(r =>
                            matVariacionSel === null
                                ? (r.variacion_id === null || r.variacion_id === undefined)
                                : r.variacion_id === matVariacionSel
                        )
                        return recetasContexto.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {recetasContexto.map(r => (
                                    <MaterialRecetaRow
                                        key={r.id}
                                        material={r}
                                        disabled={guardandoReceta}
                                        onGuardar={(cantidad) => editarMaterialItem(r.id, cantidad)}
                                        onEliminar={() => eliminarMaterialItem(r.id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                                {matVariacionSel === null
                                    ? "Sin materiales en la receta base. Agrega los productos de stock que este compuesto consume."
                                    : "Esta variación no tiene receta propia: usará la Base. Agrega materiales aquí si gasta cantidades distintas."}
                            </p>
                        )
                    })()}

                    {/* Formulario de nuevo material: buscador + cantidad */}
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Material (búscalo)</label>
                            <input
                                className="input-primary"
                                placeholder="Buscar producto de stock..."
                                value={matBuscador}
                                onChange={e => setMatBuscador(e.target.value)}
                            />
                            {matSugerencias.length > 0 && matBuscador.trim() && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                                    {matSugerencias.map(s => {
                                        const activo = s.producto === matSeleccionado
                                        return (
                                            <button
                                                key={s.producto}
                                                type="button"
                                                onClick={() => { setMatSeleccionado(s.producto); setMatBuscador(s.producto) }}
                                                style={{
                                                    background: activo ? "var(--primary-mid)" : "var(--bg-card2)",
                                                    color: activo ? "#fff" : "var(--text-main)",
                                                    border: "none", borderRadius: 10,
                                                    padding: "5px 10px", fontSize: "0.7rem", fontWeight: 700,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {activo && <Icon name="Check" size={12} />} {s.producto}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            {matSeleccionado && (
                                <p style={{ fontSize: "0.68rem", color: "var(--primary-dark)", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                                    <Icon name="Check" size={14} /> {matSeleccionado}
                                </p>
                            )}
                        </div>
                        <div style={{ width: 110, display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Cantidad</label>
                            <input
                                className="input-primary"
                                type="number" min="0" step="any"
                                placeholder="1"
                                value={matCantidad}
                                onChange={e => setMatCantidad(e.target.value === "" ? "" : Number(e.target.value))}
                                onKeyDown={e => { if (e.key === "Enter") agregarMaterialItem() }}
                            />
                        </div>
                        <button className="btn-primary" onClick={agregarMaterialItem} disabled={guardandoReceta || !matSeleccionado} style={{ whiteSpace: "nowrap" }}>
                            {guardandoReceta ? "Guardando..." : "Agregar material"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Card 2: Editar lotes individuales (solo productos con stock) ── */}
            {editProdVal.tipo_producto === "servicio" ? (
                <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                    <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                        <Icon name="Package" size={20} color="var(--primary-mid)" /> Servicio sin inventario
                    </h2>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                        Este es un servicio: no tiene lotes ni stock. Se vende sin límite y no descuenta inventario.
                    </p>
                </div>
            ) : editProdVal.tipo_producto === "compuesto" ? (
                <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                    <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="Layers" size={20} color="var(--primary-mid)" /> Compuesto sin inventario propio
                    </h2>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                        Este producto no tiene lotes: al venderlo, el gestor descuenta automáticamente el stock de los materiales definidos en su receta (ver "Materiales" arriba).
                    </p>
                </div>
            ) : (
            <>
            <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="Package" size={20} color="var(--primary-mid)" />
                    Lotes de {prodEditar}
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "auto" }}>
                        {lotes.filter(l => l.producto === prodEditar).length} lote(s)
                    </span>
                </h2>
                <ScrollableTable>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                        <thead>
                            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>
                                {["ID", "Variación", "Etiqueta", "Costo unit.", "Precio venta", "Stock", "Margen", ""].map(h => (
                                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {lotes.filter(l => l.producto === prodEditar).map(lote => {
                                const editando = loteEditandoId === lote.id_lote
                                const margen = lote.precio_venta > 0 ? ((lote.precio_venta - lote.costo) / lote.precio_venta) * 100 : 0
                                return (
                                    <tr key={lote.id_lote} style={{ borderBottom: "1px solid var(--border-light)" }}
                                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card2)")}
                                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                                        <td style={{ padding: "8px 12px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                            #{lote.id_lote}
                                        </td>
                                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                                            {editando ? (
                                                <select
                                                    className="input-primary"
                                                    style={{ width: 130, padding: 4 }}
                                                    value={editLoteVal.variacion}
                                                    onChange={e => setEditLoteVal(l => ({ ...l, variacion: e.target.value }))}
                                                    title="Asigna a qué variación pertenece este lote ('' = stock base)"
                                                >
                                                    <option value="">Base (sin variación)</option>
                                                    {editVariaciones.map(v => (
                                                        <option key={v.id} value={v.nombre}>{v.nombre}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                lote.variacion
                                                    ? <span style={{ fontWeight: 700, color: "var(--primary-dark)" }}>{lote.variacion}</span>
                                                    : <span style={{ color: "var(--text-muted)" }}>Base</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            {editando ? (
                                                <input type="text" value={editLoteVal.etiqueta} placeholder="20cm, Premium..."
                                                    onChange={e => setEditLoteVal(l => ({ ...l, etiqueta: e.target.value }))}
                                                    className="input-primary" style={{ width: 110, padding: 4 }} />
                                            ) : (lote.etiqueta || "—")}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            {editando ? (
                                                <input type="number" min={0} step="0.01" value={editLoteVal.costo} placeholder="0.00"
                                                    onChange={e => setEditLoteVal(l => ({ ...l, costo: e.target.value === "" ? "" : Number(e.target.value) }))}
                                                    className="input-primary" style={{ width: 80, padding: 4 }} />
                                            ) : `$${lote.costo.toFixed(2)}`}
                                        </td>
                                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text-main)" }}>
                                            {editando ? (
                                                <input type="number" min={0} step="0.01" value={editLoteVal.precio_venta} placeholder="0.00"
                                                    onChange={e => setEditLoteVal(l => ({ ...l, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))}
                                                    className="input-primary" style={{ width: 80, padding: 4 }} />
                                            ) : `$${lote.precio_venta.toFixed(2)}`}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            {editando ? (
                                                <input type="number" min={0} step="0.1" value={editLoteVal.stock} placeholder="0"
                                                    onChange={e => setEditLoteVal(l => ({ ...l, stock: e.target.value === "" ? "" : Number(e.target.value) }))}
                                                    className="input-primary" style={{ width: 80, padding: 4 }} />
                                            ) : lote.stock_lote}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            <Pill color={margen > 0 ? "green" : "red"}>
                                                {lote.precio_venta > 0 ? `${margen.toFixed(0)}%` : "—"}
                                            </Pill>
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            {editando ? (
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button onClick={guardarLoteIndividual} disabled={guardando}
                                                        style={{ background: "none", border: "none", fontWeight: 800, cursor: guardando ? "not-allowed" : "pointer", padding: 4 }}>
                                                        {guardando ?
                                                            (<Icon name="Hourglass" size={16} color="var(--primary-dark)" />) :
                                                            (<Icon name="Save" size={16} color="var(--primary-dark)" />)
                                                        }
                                                    </button>
                                                    <button onClick={() => { setLoteEditandoId(null); setLoteEliminarConfirm(null) }}
                                                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)" }}>
                                                        <Icon name="X" size={16} color="var(--text-muted)" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                    <button onClick={() => {
                                                        setLoteEditandoId(lote.id_lote)
                                                        setEditLoteVal({ costo: lote.costo, precio_venta: lote.precio_venta, stock: lote.stock_lote, etiqueta: lote.etiqueta || "", variacion: lote.variacion || "" })
                                                    }}
                                                        style={{ background: "none", border: "none", color: "var(--primary-mid)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", padding: 4 }}>
                                                        Editar
                                                    </button>
                                                    <button onClick={() => setLoteEliminarConfirm(lote.id_lote)}
                                                        title={`Dar de baja lote #${lote.id_lote}`}
                                                        style={{ background: "none", border: "none", color: "#ad4955ff", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", padding: 4 }}>
                                                        <Icon name="Trash2" size={14} color="#ad4955ff" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            {lotes.filter(l => l.producto === prodEditar).length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center", padding: "24px 12px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                        No hay lotes registrados para este producto.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </ScrollableTable>
            </div>

            {/* ── Diálogo de confirmación persistente para dar de baja un lote ── */}
            {loteEliminarConfirm && (() => {
                // Determinamos si es el único lote activo del producto
                const lotesDelProducto = lotes.filter(l => l.producto === prodEditar)
                const esUltimoLote = lotesDelProducto.length <= 1
                return (
                    <div style={{
                        position: "fixed", inset: 0, zIndex: 9999,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                        padding: 24
                    }}>
                        <div className="card" style={{
                            maxWidth: 440, width: "100%", padding: 28, gap: 20,
                            display: "flex", flexDirection: "column",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                            border: "1px solid var(--border-light)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: "#ffeef0", display: "flex",
                                    alignItems: "center", justifyContent: "center", flexShrink: 0
                                }}>
                                    <Icon name="TriangleAlert" size={24} color="#ad4955ff" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                        Dar de baja lote
                                    </h3>
                                    <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                        #{loteEliminarConfirm}
                                    </p>
                                </div>
                            </div>

                            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                                ¿Estás seguro de que quieres dar de baja este lote? Esta acción marcará el lote como inactivo y pondrá su stock en 0.
                            </p>

                            {/* Advertencia adicional si es el último lote: el producto también se desactivará */}
                            {esUltimoLote && (
                                <div style={{
                                    padding: "12px 16px", borderRadius: 10,
                                    background: "#fff4e5", border: "1px solid #ffd699",
                                    display: "flex", gap: 10, alignItems: "flex-start"
                                }}>
                                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                                        <Icon name="TriangleAlert" size={20} color="#cc7a00" />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#8a5e00" }}>
                                            Último lote activo
                                        </p>
                                        <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#8a5e00", fontWeight: 500 }}>
                                            Este es el único lote activo de <strong>{prodEditar}</strong>.
                                            Al dar de baja este lote, el producto también será desactivado automáticamente.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                                <button
                                    onClick={() => setLoteEliminarConfirm(null)}
                                    disabled={guardando}
                                    style={{
                                        padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                        background: "var(--bg-card2)", color: "var(--text-main)",
                                        fontWeight: 700, fontSize: "0.82rem", cursor: guardando ? "not-allowed" : "pointer",
                                        transition: "all 0.15s"
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => eliminarLoteHandler(loteEliminarConfirm)}
                                    disabled={guardando}
                                    style={{
                                        padding: "10px 20px", borderRadius: 10, border: "none",
                                        background: guardando ? "#ccc" : "#ad4955ff",
                                        color: guardando ? "#999" : "#fff",
                                        fontWeight: 700, fontSize: "0.82rem",
                                        cursor: guardando ? "not-allowed" : "pointer",
                                        display: "flex", alignItems: "center", gap: 8,
                                        transition: "all 0.15s"
                                    }}
                                >
                                    {guardando ? (
                                        <><Icon name="Hourglass" size={16} color="#999" /> Procesando...</>
                                    ) : (
                                        <><Icon name="Trash2" size={16} color="#fff" /> Sí, dar de baja</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
            </>
            )}
        </>
    )
}
