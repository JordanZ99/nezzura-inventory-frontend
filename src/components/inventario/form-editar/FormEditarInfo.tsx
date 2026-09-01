import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import GaleriaProducto from "@/components/ui/GaleriaProducto"
import type { FotoGaleria } from "@/components/ui/GaleriaProducto"
import type { FormEditProd } from "@/hooks/useInventarioForm"
import Input from "../Input"
import SelectorSufijoPrecio from "../SelectorSufijoPrecio"

export interface FormEditarInfoProps {
    prodEditar: string
    onVolver: () => void
    onCrearPost: () => void
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
}

export default function FormEditarInfo({
    prodEditar,
    onVolver,
    onCrearPost,
    editProdNombre,
    setEditProdNombre,
    editProdVal,
    setEditProdVal,
    categoriasExistentes,
    editFotos,
    setEditFotos,
    guardando,
    planLocked,
    relacionImagen,
    guardarProducto,
}: FormEditarInfoProps) {
    return (
        <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <button
                    onClick={onVolver}
                    style={{
                        background: "var(--bg-card2)",
                        border: "none",
                        borderRadius: 10,
                        padding: "6px 10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "var(--text-main)",
                    }}
                >
                    <Icon name="ArrowLeft" size={18} color="var(--text-main)" /> Volver
                </button>
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                    Editando: <strong style={{ color: "var(--text-main)" }}>{prodEditar}</strong>
                </span>
                <button
                    onClick={onCrearPost}
                    title="Genera una tarjeta lista para Instagram/WhatsApp con la foto, el nombre y el precio"
                    style={{
                        marginLeft: "auto",
                        background: "var(--gradient-1)",
                        border: "none",
                        borderRadius: 10,
                        padding: "7px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.76rem",
                        fontWeight: 800,
                        color: "#fff",
                        transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "0.9"
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "1"
                    }}
                >
                    <Icon name="ImagePlus" size={16} color="#fff" /> Crear post
                </button>
            </div>

            <Input label="Nombre del producto" value={editProdNombre} onChange={(e) => setEditProdNombre(e.target.value)} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Input
                    label="Código interno"
                    value={editProdVal.codigo_interno}
                    onChange={(e) => setEditProdVal((p) => ({ ...p, codigo_interno: e.target.value }))}
                />
                <Input
                    label="Código de barras"
                    value={editProdVal.codigo_barras}
                    onChange={(e) => setEditProdVal((p) => ({ ...p, codigo_barras: e.target.value }))}
                />
                <Input
                    label="Ubicación"
                    value={editProdVal.ubicacion}
                    onChange={(e) => setEditProdVal((p) => ({ ...p, ubicacion: e.target.value }))}
                />
            </div>

            <div>
                <label
                    style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        display: "block",
                        marginBottom: 8,
                    }}
                >
                    Categorías
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {categoriasExistentes.map((cat) => {
                        const activa = editProdVal.categoria.includes(cat)
                        return (
                            <button
                                key={cat}
                                onClick={() =>
                                    setEditProdVal((p) => ({
                                        ...p,
                                        categoria: activa ? p.categoria.filter((c) => c !== cat) : [...p.categoria, cat],
                                    }))
                                }
                                style={{
                                    background: activa ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: activa ? "#fff" : "var(--text-main)",
                                    border: "none",
                                    borderRadius: 12,
                                    padding: "6px 14px",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                }}
                            >
                                {cat} {activa ? "✓" : "+"}
                            </button>
                        )
                    })}
                </div>
                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
                    Selecciona las categorías que aplican a este producto
                </p>
            </div>

            <Input
                label="Descripción"
                value={editProdVal.descripcion}
                onChange={(e) => setEditProdVal((p) => ({ ...p, descripcion: e.target.value }))}
            />

            <GaleriaProducto
                fotos={editFotos}
                onChange={setEditFotos}
                maxFotos={5}
                disabled={guardando}
                label="Fotos del producto"
                planLocked={planLocked}
                aspectRatio={relacionImagen === "4 / 5" ? 4 / 5 : 1}
            />

            <div
                style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: editProdVal.tipo_producto !== "stock" ? "rgba(156,39,176,0.08)" : "var(--bg-card2)",
                    border: `1px solid ${
                        editProdVal.tipo_producto !== "stock" ? "rgba(156,39,176,0.3)" : "var(--border-light)"
                    }`,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                {editProdVal.tipo_producto === "servicio" ? (
                    <>
                        <Icon name="Scissors" size={16} /> Servicio (sin stock)
                    </>
                ) : editProdVal.tipo_producto === "compuesto" ? (
                    <>
                        <Icon name="Hamburger" size={16} /> Compuesto (receta)
                    </>
                ) : (
                    <>
                        <Icon name="Package" size={16} /> Producto con stock
                    </>
                )}
            </div>

            {editProdVal.tipo_producto !== "stock" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {editProdVal.tipo_producto === "servicio" && (
                        <Input
                            label="Costo del servicio"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            value={editProdVal.costo_servicio}
                            onChange={(e) =>
                                setEditProdVal((p) => ({
                                    ...p,
                                    costo_servicio: e.target.value === "" ? "" : Number(e.target.value),
                                }))
                            }
                        />
                    )}
                    <Input
                        label={editProdVal.tipo_producto === "compuesto" ? "Precio de venta" : "Precio de venta"}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={editProdVal.precio_servicio}
                        onChange={(e) =>
                            setEditProdVal((p) => ({
                                ...p,
                                precio_servicio: e.target.value === "" ? "" : Number(e.target.value),
                            }))
                        }
                    />
                </div>
            )}
            {editProdVal.tipo_producto === "compuesto" && (
                <p
                    style={{
                        fontSize: "0.68rem",
                        color: "var(--text-muted)",
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <Icon name="Lightbulb" size={14} /> El costo real se calcula en vivo al vender, según el costo de los
                    materiales de la receta (ver "Materiales" abajo).
                </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label
                    style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                    }}
                >
                    Unidad de venta
                </label>
                <SelectorSufijoPrecio
                    value={editProdVal.sufijo_precio}
                    onChange={(v) => setEditProdVal((p) => ({ ...p, sufijo_precio: v }))}
                    fraccionable={editProdVal.fraccionable}
                    onFraccionableChange={(v) => setEditProdVal((p) => ({ ...p, fraccionable: v }))}
                />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label
                        style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                        }}
                    >
                        Estado
                    </label>
                    <select
                        className="input-primary"
                        value={editProdVal.estado}
                        onChange={(e) => setEditProdVal((p) => ({ ...p, estado: e.target.value }))}
                    >
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                    </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label
                        style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                        }}
                    >
                        Visible en catálogo
                    </label>
                    <select
                        className="input-primary"
                        value={editProdVal.visible_en_catalogo ? "true" : "false"}
                        onChange={(e) => setEditProdVal((p) => ({ ...p, visible_en_catalogo: e.target.value === "true" }))}
                        title={
                            editProdVal.visible_en_catalogo
                                ? "Este producto se muestra en tu catálogo público"
                                : "Este producto está oculto en tu catálogo público"
                        }
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
    )
}
