"use client"
// ==============================================================================
// src/app/inventario/page.tsx  —  Rediseño Argon primary -Prueba botón de guardado
// ==============================================================================

import { useState, useEffect, useRef } from "react"
import { api, Producto, Lote, NuevoProducto, Restock, Categoria, Variacion, MaterialReceta } from "@/lib/api"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"
import GaleriaProducto, { type FotoGaleria } from "@/components/ui/GaleriaProducto"
// comprimirImagen se usa para comprimir las imágenes antes de subirlas
import { comprimirImagen } from "@/lib/image-utils"
import ScrollableTable from "@/components/ui/ScrollableTable"
import { useTenant } from "@/contexts/TenantContext"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

type Tab = "nuevo" | "restock" | "editar"

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>
            <input {...props} className="input-primary" />
        </div>
    )
}

function Pill({ children, color = "primary" }: { children: React.ReactNode; color?: "primary" | "green" | "red" | "gray" }) {
    const map = { primary: "stat-pill-primary", green: "stat-pill-green", red: "stat-pill-red", gray: "stat-pill-gray" }
    return (
        <span className={map[color]} style={{ fontSize: "0.7rem", fontWeight: 700, borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>
            {children}
        </span>
    )
}

/**
 * Selector de sufijo del precio que se muestra en el catálogo público.
 * 4 casillas: "c/u", "kg", "lt", "mt" y una libre ("Otro" → ej. "por docena").
 * El valor guardado es el texto final ("", "c/u", "kg", "lt", "mt", ...).
 */
function SelectorSufijoPrecio({ value, onChange, fraccionable, onFraccionableChange }: {
    value: string
    onChange: (v: string) => void
    fraccionable: boolean
    onFraccionableChange: (v: boolean) => void
}) {
    // Unidad en la que se vende el producto. Los presets fijan el flag
    // "fraccionable": c/u es entero; kg/lt/mt aceptan 0.5, 1.5...
    // "Otro" (libre) deja que el tenant decida con un toggle.
    const presets: { valor: string; fraccionable: boolean }[] = [
        { valor: "c/u", fraccionable: false },
        { valor: "kg", fraccionable: true },
        { valor: "lt", fraccionable: true },
        { valor: "mt", fraccionable: true },
    ]
    const esPreset = presets.some(p => p.valor === value)
    const esOtro = value !== "" && !esPreset
    // El modo "Otro" necesita estado LOCAL porque el valor puede estar vacío
    // justo al activarlo (antes de escribir); si dependiera solo de `value`,
    // al hacer click en "Otro" (que limpia el valor) el chip no se marcaría.
    const [otroActivo, setOtroActivo] = useState(esOtro)
    // Resincroniza el modo local ante cambios EXTERNOS del valor (reset del form
    // al guardar, o cambio de producto en edición), sin romper la escritura del
    // usuario: cuando `value` cambia, el modo "Otro" se deriva del nuevo valor.
    //
    // `interno` distingue los cambios que el PROPIO componente provoca (activar
    // "Otro" limpia el valor a ""; elegir un preset lo cambia) de los cambios
    // externos: sin esta ref, activar "Otro" con un preset seleccionado hacía
    // que el efecto revirtiera el chip (bug visual de parpadeo).
    const interno = useRef(false)
    const prevValue = useRef(value)
    useEffect(() => {
        if (prevValue.current !== value) {
            prevValue.current = value
            if (!interno.current) {
                setOtroActivo(esOtro)
            }
            interno.current = false
        }
    }, [value, esOtro])

    const togglePreset = (preset: string) => {
        // Al elegir un preset se sale del modo "Otro"
        interno.current = true
        setOtroActivo(false)
        if (value === preset) {
            // Deseleccionar: sin unidad → no fraccionable
            onChange("")
            onFraccionableChange(false)
        } else {
            onChange(preset)
            const def = presets.find(p => p.valor === preset)
            onFraccionableChange(def ? def.fraccionable : false)
        }
    }

    // Activar/desactivar el modo libre: el input arranca vacío (el usuario
    // escribe el sufijo, ej. "por litro"); no se inventa un default.
    const activarOtro = () => {
        interno.current = true
        if (otroActivo || esOtro) {
            // Deseleccionar: limpiar el valor persistido
            setOtroActivo(false)
            onChange("")
            onFraccionableChange(false)
        } else {
            // Activar: mostrar el input vacío y enfocado; el tenant decide con
            // el toggle si la unidad libre se vende por fracciones.
            setOtroActivo(true)
            onChange("")
        }
    }

    const chipStyle = (activo: boolean): React.CSSProperties => ({
        background: activo ? "var(--primary-mid)" : "var(--bg-card2)",
        color: activo ? "#fff" : "var(--text-main)",
        border: "none", borderRadius: 12,
        padding: "8px 14px", fontSize: "0.78rem", fontWeight: 700,
        cursor: "pointer", transition: "all 0.15s",
    })

    // Visible cuando el modo está activo localmente O cuando el valor persistido
    // es un sufijo libre (caso: editar un producto que ya tiene "por litro").
    const modoOtroVisible = otroActivo || esOtro

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {presets.map(p => (
                    <button key={p.valor} onClick={() => togglePreset(p.valor)} style={chipStyle(value === p.valor)}>
                        {p.valor} {value === p.valor ? "✓" : ""}
                    </button>
                ))}
                <button onClick={activarOtro} style={chipStyle(modoOtroVisible)}>
                    Otro {modoOtroVisible ? "✓" : ""}
                </button>
            </div>
            {modoOtroVisible && (
                <>
                    <input
                        type="text"
                        placeholder="Ej: por litro, por docena..."
                        // Controlado directo con `value`: cada tecla escribe al padre,
                        // así el texto del input siempre coincide con el valor guardado.
                        value={value}
                        autoFocus
                        onChange={e => onChange(e.target.value)}
                        className="input-primary"
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", color: "var(--text-main)", cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={fraccionable}
                            onChange={e => onFraccionableChange(e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: "var(--primary-mid)" }}
                        />
                        ¿Se vende por fracciones? (0.5, 1.25…)
                    </label>
                </>
            )}
            {!modoOtroVisible && (
                <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: 0 }}>
                    Se mostrará en el catálogo como: "$35.00 {value ? `Por ${value}` : "…"}".
                </p>
            )}
        </div>
    )
}

/**
 * Alta de variaciones (crear producto): lista simple de nombre + precio.
 * Se persisten en la MISMA transacción que el producto (crear_producto_completo).
 */
function AltaVariaciones({ lista, tipoStock = false, disabled = false, onAgregar, onQuitar, datosBase }: {
    lista: { nombre: string; precio: number; stock_inicial?: number; costo?: number }[]
    tipoStock?: boolean  // si el producto es tipo 'stock', muestra stock inicial + costo por variación
    disabled?: boolean
    onAgregar: (nombre: string, precio: number, stockInicial?: number, costo?: number) => void
    onQuitar: (i: number) => void
    // Datos del producto base (para el botón "Añadir producto base"): se
    // pre-cargan en los inputs para que el usuario confirme y presione Añadir.
    datosBase?: { nombre: string; precio: number | string; stock: number | string; costo: number | string }
}) {
    const [nombre, setNombre] = useState("")
    const [precio, setPrecio] = useState("")
    // Stock inicial con default 1: cada variación de stock crea su propio lote.
    // El usuario puede poner 0 si la quiere agotada desde el inicio.
    const [stockInicial, setStockInicial] = useState("1")
    const [costo, setCosto] = useState("")
    const puede = nombre.trim() !== "" && precio !== "" && Number(precio) > 0

    const agregar = () => {
        if (!puede) return
        onAgregar(
            nombre.trim(),
            Number(precio),
            stockInicial === "" ? undefined : Number(stockInicial),
            costo === "" ? undefined : Number(costo),
        )
        setNombre(""); setPrecio(""); setStockInicial("1"); setCosto("")
    }

    // "Añadir producto base": solo con tipo stock y cuando ya hay al menos una
    // variación (si no hay variaciones, el producto base ya se vende solo).
    // Pre-carga los datos del producto en los inputs para confirmar y añadir.
    const baseVisible = tipoStock && lista.length > 0
    const basePrecioOk = datosBase !== undefined && datosBase.precio !== "" && Number(datosBase.precio) > 0
    const baseStockOk = datosBase !== undefined && datosBase.stock !== ""
    const baseBloqueada = !basePrecioOk || !baseStockOk
    const cargarBase = () => {
        if (!datosBase || baseBloqueada) return
        setNombre(datosBase.nombre.trim() || "Producto base")
        setPrecio(String(datosBase.precio))
        // Si la cantidad del producto está vacía, el stock de la base arranca en 1.
        setStockInicial(datosBase.stock === "" ? "1" : String(datosBase.stock))
        setCosto(String(datosBase.costo))
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Variaciones (opcional)
            </label>
            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>
                Presentaciones con precio propio (ej. S/M/L, Sencilla/Doble). Se crean junto al producto y aparecen en el catálogo como "desde $X".
            </p>
            {tipoStock && (
                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>
                    Cada variación lleva su <strong>propio lote</strong> (stock, costo y precio). El stock inicial arranca en 1; pon <strong>0</strong> si la quieres agotada desde el inicio.
                </p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                    className="input-primary"
                    style={{ flex: 1, minWidth: 140 }}
                    placeholder="Nombre (ej. Doble)"
                    value={nombre}
                    disabled={disabled}
                    onChange={e => setNombre(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") agregar() }}
                />
                {tipoStock && (
                    <input
                        className="input-primary"
                        style={{ width: 92 }}
                        type="number" min="0" step="0.01"
                        placeholder="Cantidad"
                        title="Stock inicial de esta variación (crea su propio lote)"
                        value={stockInicial}
                        disabled={disabled}
                        onChange={e => setStockInicial(e.target.value)}
                    />
                )}
                {tipoStock && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>$</span>
                        <input
                            className="input-primary"
                            style={{ width: 90 }}
                            type="number" min="0" step="0.01"
                            placeholder="Costo"
                            title="Costo del lote inicial (opcional; usa el del producto si se omite)"
                            value={costo}
                            disabled={disabled}
                            onChange={e => setCosto(e.target.value)}
                        />
                    </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>$</span>
                    <input
                        className="input-primary"
                        style={{ width: 90 }}
                        type="number" min="0" step="0.01"
                        placeholder="Precio"
                        value={precio}
                        disabled={disabled}
                        onChange={e => setPrecio(e.target.value)}
                    />
                </div>
                <button
                    onClick={agregar}
                    disabled={disabled || !puede}
                    style={{
                        background: !disabled && puede ? "var(--primary-mid)" : "var(--bg-card2)",
                        color: !disabled && puede ? "#fff" : "var(--text-muted)",
                        border: "none", borderRadius: 10, padding: "8px 14px",
                        fontWeight: 700, fontSize: "0.75rem", cursor: !disabled && puede ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                    }}
                >
                    <Icon name="Plus" size={14} /> Añadir
                </button>
            </div>
            {baseVisible && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button
                        onClick={cargarBase}
                        disabled={disabled || baseBloqueada}
                        title={baseBloqueada
                            ? "Llena primero el precio y la cantidad del producto"
                            : "Carga los datos del producto como una variación más (para venderlo tal cual además de sus variaciones)"}
                        style={{
                            alignSelf: "flex-start",
                            background: "var(--bg-card2)",
                            color: !disabled && !baseBloqueada ? "var(--primary-mid)" : "var(--text-muted)",
                            border: "1px dashed " + (!disabled && !baseBloqueada ? "var(--primary-mid)" : "var(--border-primary)"),
                            borderRadius: 10, padding: "6px 12px",
                            fontWeight: 700, fontSize: "0.72rem",
                            cursor: !disabled && !baseBloqueada ? "pointer" : "not-allowed",
                            transition: "all 0.15s",
                            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                        }}
                    >
                        <Icon name="PackagePlus" size={14} /> Añadir producto base
                    </button>
                    {baseBloqueada && (
                        <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>
                            Llena primero el precio y la cantidad del producto para usar esta opción.
                        </span>
                    )}
                </div>
            )}
            {lista.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {lista.map((v, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card2)", borderRadius: 10, padding: "6px 10px" }}>
                            <span style={{ flex: 1, fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)" }}>{v.nombre}</span>
                            {tipoStock && typeof v.stock_inicial === "number" && v.stock_inicial > 0 && (
                                <span style={{ fontWeight: 700, fontSize: "0.72rem", color: "#2e7d32" }}>{v.stock_inicial} uds</span>
                            )}
                            <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--primary-dark)" }}>${v.precio.toFixed(2)}</span>
                            <button onClick={() => onQuitar(i)} title="Quitar" style={{ background: "none", border: "none", cursor: "pointer", color: "#e53935", padding: 4 }}>
                                <Icon name="Trash" size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * Alta de ingredientes del compuesto (crear producto): buscador de productos
 * de stock + cantidad (permite fracciones: 0.5, 150, 0.25...).
 * Se persisten en la MISMA transacción que el producto (crear_producto_completo).
 */
function AltaMateriales({ inv, lista, disabled = false, onAgregar, onQuitar }: {
    inv: Producto[]
    lista: { material: string; cantidad: number }[]
    disabled?: boolean
    onAgregar: (material: string, cantidad: number) => void
    onQuitar: (i: number) => void
}) {
    const [buscador, setBuscador] = useState("")
    const [seleccionado, setSeleccionado] = useState("")
    const [cantidad, setCantidad] = useState("")
    const q = buscador.trim().toLowerCase()
    const sugerencias = q ? inv.filter(p => p.tipo_producto === "stock" && p.producto.toLowerCase().includes(q)).slice(0, 6) : []
    const puede = seleccionado !== "" && cantidad !== "" && Number(cantidad) > 0

    const agregar = () => {
        if (!puede) return
        onAgregar(seleccionado, Number(cantidad))
        setBuscador(""); setSeleccionado(""); setCantidad("")
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Añadir ingredientes (receta)
            </label>
            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>
                Al vender 1 unidad de este compuesto se descuenta la cantidad indicada de cada material (se permiten fracciones: 0.5, 150, 0.25...).
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 4 }}>
                    <input
                        className="input-primary"
                        placeholder="Buscar producto de stock..."
                        value={buscador}
                        disabled={disabled}
                        onChange={e => { setBuscador(e.target.value); setSeleccionado("") }}
                    />
                    {sugerencias.length > 0 && buscador.trim() && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {sugerencias.map(s => (
                                <button
                                    key={s.producto}
                                    type="button"
                                    onClick={() => { setSeleccionado(s.producto); setBuscador(s.producto) }}
                                    style={{
                                        background: s.producto === seleccionado ? "var(--primary-mid)" : "var(--bg-card2)",
                                        color: s.producto === seleccionado ? "#fff" : "var(--text-main)",
                                        border: "none", borderRadius: 10, padding: "5px 10px",
                                        fontSize: "0.7rem", fontWeight: 700, cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 4,
                                    }}
                                >
                                    {s.producto === seleccionado && <Icon name="Check" size={12} />} {s.producto}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    className="input-primary"
                    style={{ width: 90 }}
                    type="number" min="0" step="any"
                    placeholder="Cant."
                    value={cantidad}
                    disabled={disabled}
                    onChange={e => setCantidad(e.target.value)}
                />
                <button
                    onClick={agregar}
                    disabled={disabled || !puede}
                    style={{
                        background: !disabled && puede ? "var(--primary-mid)" : "var(--bg-card2)",
                        color: !disabled && puede ? "#fff" : "var(--text-muted)",
                        border: "none", borderRadius: 10, padding: "8px 14px",
                        fontWeight: 700, fontSize: "0.75rem", cursor: !disabled && puede ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                    }}
                >
                    <Icon name="Plus" size={14} /> Añadir
                </button>
            </div>
            {lista.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {lista.map((m, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card2)", borderRadius: 10, padding: "6px 10px" }}>
                            <span style={{ flex: 1, fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)" }}>{m.material}</span>
                            <span style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--text-muted)" }}>×{m.cantidad}</span>
                            <button onClick={() => onQuitar(i)} title="Quitar" style={{ background: "none", border: "none", cursor: "pointer", color: "#e53935", padding: 4 }}>
                                <Icon name="Trash" size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * Fila editable de una variación: nombre + precio propios, con botones
 * Guardar (persiste el cambio) y Eliminar.
 */
function VariacionRow({ variacion, disabled, stockVisible = false, onGuardar, onEliminar, onCambiarFoto, onQuitarFoto }: {
    variacion: Variacion
    disabled: boolean
    // Fase 6: muestra el stock propio de la variación (solo si el producto
    // maneja stock por variación)
    stockVisible?: boolean
    onGuardar: (nombre: string, precio: number) => void
    onEliminar: () => void
    onCambiarFoto: (file: File) => void
    onQuitarFoto: () => void
}) {
    const [nombre, setNombre] = useState(variacion.nombre)
    const [precio, setPrecio] = useState(variacion.precio.toString())
    const inputFotoRef = useRef<HTMLInputElement>(null)

    // Al cambiar de producto (o recargar), sincronizar con la variación recibida
    useEffect(() => {
        setNombre(variacion.nombre)
        setPrecio(variacion.precio.toString())
    }, [variacion])

    const tieneFoto = !!variacion.foto && variacion.foto !== "No hay foto"

    return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Foto de la variación: miniatura clicable para subir/reemplazar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                    onClick={() => { if (!disabled) inputFotoRef.current?.click() }}
                    title={tieneFoto ? "Cambiar foto de esta variación" : "Subir foto de esta variación"}
                    style={{
                        width: 44, height: 44, borderRadius: 10, cursor: disabled ? "default" : "pointer",
                        background: "var(--bg-card2)", border: "1px dashed var(--border-color, #d0d5dd)",
                        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                    }}
                >
                    {tieneFoto ? (
                        <img src={variacion.foto} alt={variacion.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                        <Icon name="Image" size={18} color="var(--text-muted)" />
                    )}
                </div>
                {tieneFoto && (
                    <button
                        onClick={onQuitarFoto}
                        disabled={disabled}
                        title="Quitar foto"
                        style={{
                            position: "absolute", top: -6, right: -6,
                            width: 18, height: 18, borderRadius: "50%", border: "none", cursor: disabled ? "default" : "pointer",
                            background: "#e53935", color: "#fff", fontSize: "0.6rem", lineHeight: 1,
                            display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                        }}
                    >
                        ✕
                    </button>
                )}
                <input
                    ref={inputFotoRef}
                    type="file" accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) onCambiarFoto(f)
                        e.target.value = ""
                    }}
                />
            </div>
            <input
                className="input-primary"
                style={{ flex: 1, minWidth: 120 }}
                value={nombre}
                placeholder="Nombre"
                onChange={e => setNombre(e.target.value)}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>$</span>
                <input
                    className="input-primary"
                    style={{ width: 90 }}
                    type="number" min="0" step="0.01"
                    value={precio}
                    placeholder="0.00"
                    onChange={e => setPrecio(e.target.value)}
                />
            </div>
            {stockVisible && (typeof variacion.stock === "number" ? (
                variacion.stock > 0 ? (
                    <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#2e7d32", whiteSpace: "nowrap" }}>{variacion.stock} uds</span>
                ) : (
                    <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#ad4955ff", whiteSpace: "nowrap" }}>Agotado</span>
                )
            ) : (
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>0 uds</span>
            ))}
            <button
                className="btn-primary"
                disabled={disabled}
                onClick={() => onGuardar(nombre.trim(), Number(precio === "" ? 0 : precio))}
                title="Guardar cambios de esta variación"
            >
                <Icon name="Check" size={14} />
            </button>
            <button
                onClick={onEliminar}
                disabled={disabled}
                title="Eliminar variación"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#e53935", fontSize: "1rem", padding: 6 }}
            >
                <Icon name="Trash" size={16} />
            </button>
        </div>
    )
}

/**
 * Fila editable de un material de la receta: nombre (fijo) + cantidad editable
 * (permite fracciones: 0.5, 150, 0.25...) con botones Guardar y Eliminar.
 */
function MaterialRecetaRow({ material, disabled, onGuardar, onEliminar }: {
    material: MaterialReceta
    disabled: boolean
    onGuardar: (cantidad: number) => void
    onEliminar: () => void
}) {
    const [cantidad, setCantidad] = useState(material.cantidad.toString())

    // Al cambiar de producto (o recargar), sincronizar con el material recibido
    useEffect(() => {
        setCantidad(material.cantidad.toString())
    }, [material])

    return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 120, fontWeight: 700, fontSize: "0.82rem", color: "var(--text-main)" }}>
                {material.material}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                    className="input-primary"
                    style={{ width: 90 }}
                    type="number" min="0" step="any"
                    value={cantidad}
                    placeholder="1"
                    onChange={e => setCantidad(e.target.value)}
                />
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>por unidad</span>
            </div>
            <button
                className="btn-primary"
                disabled={disabled}
                onClick={() => onGuardar(Number(cantidad === "" ? 0 : cantidad))}
                title="Guardar cantidad"
            >
                <Icon name="Check" size={14} />
            </button>
            <button
                onClick={onEliminar}
                disabled={disabled}
                title="Quitar material"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#e53935", fontSize: "1rem", padding: 6 }}
            >
                <Icon name="Trash" size={16} />
            </button>
        </div>
    )
}

export default function Inventario() {
    const { tenant } = useTenant()

    const [lotes, setLotes] = useState<Lote[]>([])
    const [inv, setInv] = useState<Producto[]>([])
    const [tab, setTab] = useState<Tab>("nuevo")

    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const [form, setForm] = useState({ producto: "", descripcion: "", categoria: ["General"] as string[], costo: "" as number | string, precio_venta: "" as number | string, stock: 1 as number | string, codigo_interno: "", codigo_barras: "", ubicacion: "", etiqueta: "", sufijo_precio: "", fraccionable: false as boolean, tipo_producto: "stock" as string, costo_servicio: "" as number | string, precio_servicio: "" as number | string, visible_en_catalogo: true as boolean })
    // Variaciones y materiales pendientes del ALTA (se guardan en la misma
    // transacción que el producto, vía crear_producto_completo)
    const [nuevasVariaciones, setNuevasVariaciones] = useState<{ nombre: string; precio: number; stock_inicial?: number; costo?: number }[]>([])
    const [nuevosMateriales, setNuevosMateriales] = useState<{ material: string; cantidad: number }[]>([])
    const [restock, setRestock] = useState({ producto: "", costo: "" as number | string, precio_venta: "" as number | string, stock: 1 as number | string, etiqueta: "", variacion: "" })
    const [nuevasFotos, setNuevasFotos] = useState<FotoGaleria[]>([])
    const [editFotos, setEditFotos] = useState<FotoGaleria[]>([])

    const [prodEditar, setProdEditar] = useState<string>("")
    const [editProdNombre, setEditProdNombre] = useState("")
    const [editProdVal, setEditProdVal] = useState({ descripcion: "", estado: "Activo", imagen: "No hay foto", categoria: ["General"] as string[], codigo_interno: "", codigo_barras: "", ubicacion: "", visible_en_catalogo: true, sufijo_precio: "", fraccionable: false as boolean, tipo_producto: "stock", costo_servicio: "" as number | string, precio_servicio: "" as number | string, stock_por_variacion: false })

    // ── Variaciones del producto en edición (Fase 2) ──
    // Cada variación es una presentación con su PROPIO precio (ej. Sencilla/Doble, S/M/L).
    const [editVariaciones, setEditVariaciones] = useState<Variacion[]>([])
    const [nuevaVarNombre, setNuevaVarNombre] = useState("")
    const [nuevaVarPrecio, setNuevaVarPrecio] = useState("" as number | string)
    const [guardandoVar, setGuardandoVar] = useState(false)

    // ── Materiales de la receta del compuesto en edición (Fases 3 y 4) ──
    const [editRecetas, setEditRecetas] = useState<MaterialReceta[]>([])
    const [matBuscador, setMatBuscador] = useState("")
    const [matSeleccionado, setMatSeleccionado] = useState("")
    const [matCantidad, setMatCantidad] = useState("" as number | string)
    const [guardandoReceta, setGuardandoReceta] = useState(false)
    // Contexto de la receta que se edita: null = receta base, id = variación
    const [matVariacionSel, setMatVariacionSel] = useState<number | null>(null)

    // ── Galería unificada de fotos (principal + extras) ──
    // Ahora la foto principal es simplemente la primera del array (índice 0).
    // El componente GaleriaProducto maneja el carrusel, subida, reemplazo y eliminación.

    // Estado para editar lotes individuales dentro del formulario Editar Prod.
    const [loteEditandoId, setLoteEditandoId] = useState<string | null>(null)
    const [editLoteVal, setEditLoteVal] = useState({ costo: "" as number | string, precio_venta: "" as number | string, stock: "" as number | string, etiqueta: "", variacion: "" })
    // Estado para el diálogo de confirmación persistente al dar de baja un lote
    // Contiene el id del lote pendiente de confirmación; no se cierra hasta eliminar o recargar
    const [loteEliminarConfirm, setLoteEliminarConfirm] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [nuevaCategoria, setNuevaCategoria] = useState("")
    const [buscadorEditar, setBuscadorEditar] = useState("")
    const [catSelecEditar, setCatSelecEditar] = useState("Todas")

    // ── Estados para el Restock con buscador (como Editar Prod.) ──
    const [restockBuscador, setRestockBuscador] = useState("")
    const [restockCatSelec, setRestockCatSelec] = useState("Todas")
    const [restockProdSeleccionado, setRestockProdSeleccionado] = useState<Producto | null>(null)
    // ── Ordenamiento del grid de Restock (default: menor stock primero) ──
    const [restockOrdenamiento, setRestockOrdenamiento] = useState("stock-desc")
    // ── Ordenamiento del grid de "Editar Prod." (default: alfabético, igual que el backend) ──
    const [editarOrdenamiento, setEditarOrdenamiento] = useState("alfabetico")
    // ── Debounce del buscador: retrasa el filtrado 300ms para no recalcular en cada tecla ──
    const [restockBuscadorDebounced, setRestockBuscadorDebounced] = useState("")
    useEffect(() => {
        const timer = setTimeout(() => setRestockBuscadorDebounced(restockBuscador), 300)
        return () => clearTimeout(timer)
    }, [restockBuscador])

    // Estado para la gestión de categorías
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [nuevaCatNombre, setNuevaCatNombre] = useState("")
    const [catEditandoId, setCatEditandoId] = useState<string | null>(null)
    const [catEditandoNombre, setCatEditandoNombre] = useState("")
    const [cargandoCats, setCargandoCats] = useState(false)
    const [confirmEliminarCat, setConfirmEliminarCat] = useState<string | null>(null)
    // ── Estado para la explicación de cada KPI (popup informativo) ──
    const [kpiExplicacion, setKpiExplicacion] = useState<string | null>(null)

    // ── Restauración de posición al volver del formulario "Editar Prod." ──
    // Guarda el scroll Y del grid de productos en el momento exacto en que se
    // abre el formulario de edición (ANTES de que la vista cambie, porque el
    // formulario es más corto que el grid y el navegador "sujeta" el scroll).
    // Al volver (o al guardar), se restaura esa posición para que el usuario
    // regrese exactamente donde estaba, conservando su contexto visual.
    const scrollGridEditarRef = useRef<number | null>(null)

    // ── Explicaciones de cada KPI en lenguaje entendible ──
    const explicacionesKPI: Record<string, { descripcion: string; formula: string }> = {
        "Productos activos": {
            descripcion: "Son los productos que actualmente tienen existencia en tu inventario, es decir, su stock es mayor a 0. No importa si tienen poco o mucho, mientras tengan al menos 1 unidad cuentan como activos.",
            formula: "Productos con stock > 0"
        },
        "Valor del inventario": {
            descripcion: "Es el valor total de todo tu inventario si vendieras cada producto a su precio actual. Se calcula sumando el precio de venta de cada unidad que tienes en existencia.",
            formula: "Suma de (stock actual × precio de venta) de cada producto"
        },
        "Ganancia potencial": {
            descripcion: "Es la ganancia que obtendrías si lograras vender todo tu inventario actual al precio de venta. No considera gastos operativos, solo la diferencia entre lo que pagaste por los productos (costo promedio) y lo que los vendes.",
            formula: "Suma de [stock × (precio de venta − costo promedio)]"
        },
        "Stock descuadrado": {
            descripcion: "Son los productos que tienen stock en 0 o incluso negativo. Stock negativo significa que se vendieron más unidades de las que había registradas. Revisa estos productos para corregir su inventario.",
            formula: "Productos con stock ≤ 0"
        }
    }

    function agregarCategoria() {
        const cat = nuevaCategoria.trim()
        if (!cat) return
        if (form.categoria.includes(cat)) return
        setForm(f => ({ ...f, categoria: [...f.categoria, cat] }))
        setNuevaCategoria("")
    }


    async function recargar() {
        try {
            const [l, i] = await Promise.all([api.getLotes(), api.getInventario()])
            setLotes(l); setInv(i)
        } catch {
            // Tables might not exist — force creation and retry
            try {
                await api.initDB()
                const [l, i] = await Promise.all([api.getLotes(), api.getInventario()])
                setLotes(l); setInv(i)
            } catch {
                // DB is empty, keep empty state
            }
        }
    }
    /**
     * Carga la lista de categorías desde la API
     * (tabla 'categorias' con conteo de productos asociados)
     */
    async function cargarCategorias() {
        setCargandoCats(true)
        try {
            const cats = await api.getCategorias()
            setCategorias(cats)
        } catch {
            // Si falla, ignoramos silenciosamente
        } finally {
            setCargandoCats(false)
        }
    }

    /**
     * Crea una categoría nueva en la base de datos (tabla 'categorias')
     * y actualiza la lista visual inmediatamente
     */
    async function guardarNuevaCategoria() {
        const nombre = nuevaCatNombre.trim()
        if (!nombre || guardando) return
        setGuardando(true)
        try {
            await api.crearCategoria(nombre)
            setNuevaCatNombre("")
            await Promise.all([cargarCategorias(), recargar()])
            mostrarMsg(true, `Categoría "${nombre}" creada`)
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`)
        } finally {
            setGuardando(false)
        }
    }

    /**
     * Inicia el modo de edición inline para una categoría
     */
    function iniciarEditarCategoria(cat: Categoria) {
        setCatEditandoId(cat.id)
        setCatEditandoNombre(cat.nombre)
    }

    /**
     * Guarda el cambio de nombre de una categoría
     */
    async function guardarEditarCategoria(viejoNombre: string) {
        const nuevo = catEditandoNombre.trim()
        if (!nuevo || nuevo === viejoNombre || guardando) {
            setCatEditandoId(null)
            return
        }
        setGuardando(true)
        try {
            await api.editarCategoria(viejoNombre, nuevo)
            setCatEditandoId(null)
            await Promise.all([cargarCategorias(), recargar()])
            mostrarMsg(true, `Categoría renombrada a "${nuevo}"`)
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`)
        } finally {
            setGuardando(false)
        }
    }

    /**
     * Cancela la edición inline de una categoría
     */
    function cancelarEditarCategoria() {
        setCatEditandoId(null)
        setCatEditandoNombre("")
    }

    useEffect(() => { recargar() }, [])

    // Cuando se cierra el formulario de edición (prodEditar pasa a ""),
    // restauramos el scroll Y guardado del grid de productos para que el
    // usuario vuelva exactamente donde estaba al entrar a editar.
    // Usamos doble requestAnimationFrame para esperar a que el grid se monte
    // y el navegador recalcule la altura del documento antes de hacer scroll.
    useEffect(() => {
        if (!prodEditar && scrollGridEditarRef.current !== null) {
            const pos = scrollGridEditarRef.current
            scrollGridEditarRef.current = null
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    window.scrollTo({ top: pos, behavior: "auto" })
                })
            })
        }
    }, [prodEditar])

    // Al cambiar al tab "nuevo", cargamos las categorías si no están
    useEffect(() => {
        if (tab === "nuevo") {
            cargarCategorias()
        }
    }, [tab])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    const productos = Array.from(new Set(lotes.map(l => l.producto))).sort()

    async function guardarNuevo() {
        if (guardando) return
        setGuardando(true)
        // Si la creación falla tras subir la foto, la borramos para no dejar
        // imágenes huérfanas en Cloudinary (la creación es todo-o-nada).
        let imagenSubida = ""
        try {
            // Ensure tables exist before creating a product
            await api.initDB()

            // ── Foto principal: la primera del array (índice 0) ──
            let imagen = "No hay foto"
            const principal = nuevasFotos[0]
            if (principal?.file) {
                const sizeMB = principal.file.size / (1024 * 1024)
                if (sizeMB > 10) {
                    mostrarMsg(false, `La imagen pesa ${sizeMB.toFixed(1)} MB. El máximo es 10 MB.`)
                    setGuardando(false)
                    return
                }
                let imgAEnviar = principal.file
                try {
                    imgAEnviar = await comprimirImagen(principal.file)
                } catch (err) {
                    console.warn("Fallo al comprimir foto principal nueva:", err)
                }
                const r = await api.subirFoto(form.producto, imgAEnviar)
                imagen = r.ruta
                imagenSubida = imagen
            }

            // Crear el producto con la foto principal.
            // Servicios y compuestos NO tienen inventario: el stock se envía en 0
            // y el costo/precio propios se guardan en costo_servicio/precio_servicio.
            // (Para un compuesto el COSTO real se calcula en vivo con su receta;
            //  el precio de venta sí es fijo y se guarda aquí.)
            const esSinStock = form.tipo_producto !== "stock"
            await api.crearProducto({
                ...form,
                costo: esSinStock ? 0 : Number(form.costo),
                precio_venta: esSinStock ? 0 : Number(form.precio_venta),
                stock: esSinStock ? 0 : Number(form.stock),
                imagen,
                codigo_interno: form.codigo_interno || undefined,
                codigo_barras: form.codigo_barras || undefined,
                ubicacion: form.ubicacion || undefined,
                costo_servicio: esSinStock ? Number(form.costo_servicio === "" ? form.costo : form.costo_servicio) : undefined,
                precio_servicio: esSinStock ? Number(form.precio_servicio === "" ? form.precio_venta : form.precio_servicio) : undefined,
                visible_en_catalogo: form.visible_en_catalogo,
                // Se crean junto al producto en una sola transacción
                variaciones: nuevasVariaciones.length > 0 ? nuevasVariaciones : undefined,
                recetas: form.tipo_producto === "compuesto" && nuevosMateriales.length > 0 ? nuevosMateriales : undefined,
            })
            mostrarMsg(true, `${form.producto} registrado${nuevasVariaciones.length > 0 ? ` con ${nuevasVariaciones.length} variación(es)` : ""}${nuevosMateriales.length > 0 ? ` y ${nuevosMateriales.length} ingrediente(s)` : ""}`)

            // ── Subir fotos adicionales (índices 1+) si hay ──
            const extras = nuevasFotos.slice(1)
            for (const extra of extras) {
                if (!extra.file) continue
                try {
                    let imgAEnviar = extra.file
                    try { imgAEnviar = await comprimirImagen(extra.file) }
                    catch { /* enviar original si falla */ }
                    await api.subirImagenExtra(form.producto, imgAEnviar)
                } catch {
                    console.warn("Error subiendo imagen extra para", form.producto)
                }
            }

            setNuevasFotos([])
            setNuevasVariaciones([])
            setNuevosMateriales([])
            setForm({ producto: "", descripcion: "", categoria: ["General"], costo: "", precio_venta: "", stock: 1, codigo_interno: "", codigo_barras: "", ubicacion: "", etiqueta: "", sufijo_precio: "", fraccionable: false, tipo_producto: "stock", costo_servicio: "", precio_servicio: "", visible_en_catalogo: true })
            recargar()
        } catch (e: unknown) {
            // La creación falló (variación duplicada, material inexistente, etc.):
            // limpiar la foto principal que ya se subió para no dejar huérfanos.
            if (imagenSubida) api.borrarImagen(imagenSubida).catch(() => {})
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`)
        }
        finally { setGuardando(false) }
    }

    async function guardarRestock() {
        if (guardando) return
        setGuardando(true)
        try {
            const prodActual = inv.find(p => p.producto === restock.producto)
            const precio = restock.precio_venta === "" ? (prodActual?.precio_venta || 0) : Number(restock.precio_venta)
            await api.restockear({ ...restock, costo: Number(restock.costo), stock: Number(restock.stock), precio_venta: precio })
            mostrarMsg(true, `+${Number(restock.stock)} a ${restock.producto}${restock.variacion ? ` (${restock.variacion})` : ""}`)
            recargar()
            setRestockProdSeleccionado(null)
            setRestock({ producto: "", costo: "", precio_venta: "", stock: 1, etiqueta: "", variacion: "" })
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function guardarProducto() {
        if (!prodEditar || guardando) return
        setGuardando(true)
        try {
            // ── Foto principal: la primera del array editFotos ──
            let nuevaImagen: string | undefined = undefined
            const principalEdit = editFotos[0]
            if (principalEdit?.file) {
                // Reemplazo de foto principal → subir nueva
                const sizeMB = principalEdit.file.size / (1024 * 1024)
                if (sizeMB > 10) {
                    mostrarMsg(false, `La imagen pesa ${sizeMB.toFixed(1)} MB. El máximo es 10 MB.`)
                    setGuardando(false)
                    return
                }
                let imgAEnviar = principalEdit.file
                try {
                    imgAEnviar = await comprimirImagen(principalEdit.file)
                } catch (err) {
                    console.warn("Fallo al comprimir foto principal editada:", err)
                }
                const r = await api.subirFoto(prodEditar, imgAEnviar)
                nuevaImagen = r.ruta
            } else if (editFotos.length === 0 && editProdVal.imagen !== "No hay foto") {
                // Se eliminaron todas las fotos → quitar foto principal
                nuevaImagen = "No hay foto"
            }

            const payload: Parameters<typeof api.editarProducto>[1] = {
                descripcion: editProdVal.descripcion,
                imagen: nuevaImagen || editProdVal.imagen,
                estado: editProdVal.estado,
                categoria: editProdVal.categoria,
                producto: editProdNombre,
                codigo_interno: editProdVal.codigo_interno || undefined,
                codigo_barras: editProdVal.codigo_barras || undefined,
                ubicacion: editProdVal.ubicacion || undefined,
                visible_en_catalogo: editProdVal.visible_en_catalogo,
                // Se envía SIEMPRE (incluso "") para que el backend pueda LIMPIAR el
                // sufijo si el tenant lo deselecciona (COALESCE trata '' como valor válido).
                sufijo_precio: editProdVal.sufijo_precio,
                // Se envía SIEMPRE: el tenant puede desmarcar "fraccionable" y
                // volver el producto a unidades enteras (COALESCE respeta false).
                fraccionable: editProdVal.fraccionable,
                // Tipo + campos de servicio (si aplica) para guardar en productos
                tipo_producto: editProdVal.tipo_producto,
                costo_servicio: editProdVal.tipo_producto === "servicio" ? Number(editProdVal.costo_servicio === "" ? 0 : editProdVal.costo_servicio) : undefined,
                // Servicios y compuestos guardan su precio propio en precio_servicio
                precio_servicio: editProdVal.tipo_producto !== "stock" ? Number(editProdVal.precio_servicio === "" ? 0 : editProdVal.precio_servicio) : undefined,
                // Fase 6: stock por variación (solo tiene sentido en tipo stock)
                stock_por_variacion: editProdVal.tipo_producto === "stock" ? editProdVal.stock_por_variacion : undefined,
            }
            await api.editarProducto(prodEditar, payload)

            // ── Sincronizar fotos extras (índices 1+) ──
            // Eliminar fotos que ya no están en el array
            const fotosActuales = await api.getImagenesProducto(prodEditar)
            for (const existente of fotosActuales) {
                const sigueEnArray = editFotos.some(f => f.id === existente.id)
                if (!sigueEnArray) {
                    try { await api.eliminarImagenExtra(existente.id) }
                    catch { /* ignorar error al eliminar */ }
                }
            }                        // Subir nuevas fotos extras + reemplazadas
                        // Para cada foto del array que tenga file (es nueva/cambiada):
                        //   - Si tiene orden, reemplazar en ese orden (backend borra la vieja)
                        //   - Si no tiene orden, insercion nueva
                        const nuevosExtras = editFotos.slice(1).filter(f => f.file)
                        for (const extra of nuevosExtras) {
                            if (!extra.file) continue
                            try {
                                let imgAEnviar = extra.file
                                try { imgAEnviar = await comprimirImagen(extra.file) }
                                catch { /* enviar original */ }
                                await api.subirImagenExtra(prodEditar, imgAEnviar, extra.orden)
                            } catch {
                                console.warn("Error subiendo imagen extra para", prodEditar)
                            }
                        }

                        // ── Reordenar imágenes existentes si el orden cambió ──
                        const idsEnOrden = editFotos.map(f => f.id).filter((id): id is number => id !== undefined)
                        if (idsEnOrden.length >= 2) {
                            try {
                                await api.reordenarImagenes(prodEditar, idsEnOrden)
                            } catch (err) {
                                console.warn("Error reordenando imágenes:", err)
                            }
                        }

            mostrarMsg(true, "Producto actualizado")
            setProdEditar(""); setEditProdNombre(""); setEditFotos([]); recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    // ── CRUD de variaciones (Fase 2) ──
    // Cada variación es una presentación con su PROPIO precio para el mismo
    // producto (ej. hamburguesa Sencilla/Doble, remera S/M/L).
    async function agregarVariacion() {
        if (!prodEditar || guardandoVar) return
        const nombre = nuevaVarNombre.trim()
        if (!nombre) { mostrarMsg(false, "Escribe un nombre para la variación"); return }
        setGuardandoVar(true)
        try {
            const res = await api.crearVariacion(prodEditar, nombre, Number(nuevaVarPrecio === "" ? 0 : nuevaVarPrecio))
            if (res.ok) {
                setEditVariaciones(prev => [...prev, res.variacion])
                setNuevaVarNombre(""); setNuevaVarPrecio("")
                mostrarMsg(true, `Variación '${res.variacion.nombre}' agregada`)
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al agregar la variación")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoVar(false) }
    }

    async function editarVariacionItem(id: number, nombre: string, precio: number) {
        if (guardandoVar) return
        if (!nombre.trim()) { mostrarMsg(false, "El nombre de la variación es obligatorio"); return }
        setGuardandoVar(true)
        try {
            const res = await api.editarVariacion(id, nombre.trim(), precio)
            if (res.ok) {
                setEditVariaciones(prev => prev.map(v => v.id === id ? res.variacion : v))
                mostrarMsg(true, "Variación actualizada")
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al actualizar")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoVar(false) }
    }

    async function eliminarVariacionItem(id: number) {
        if (guardandoVar) return
        if (!confirm("¿Eliminar esta variación? Los productos con esta variación en ventas históricas conservarán el texto.")) return
        setGuardandoVar(true)
        try {
            const res = await api.eliminarVariacion(id)
            if (res.ok) {
                setEditVariaciones(prev => prev.filter(v => v.id !== id))
                mostrarMsg(true, "Variación eliminada")
            } else if ("requiere_confirmacion" in res && res.requiere_confirmacion) {
                // La variación tiene stock: advertir y ofrecer eliminar de todos modos
                setGuardandoVar(false)
                const ok = window.confirm(
                    `${res.mensaje}\n\nUnidades en stock: ${res.unidades} (${res.lotes} lote(s)).\n\nSi la eliminas, su stock desaparecerá del inventario.`
                )
                if (!ok) return
                setGuardandoVar(true)
                const res2 = await api.eliminarVariacion(id, true)
                if (res2.ok) {
                    setEditVariaciones(prev => prev.filter(v => v.id !== id))
                    mostrarMsg(true, "Variación eliminada")
                } else {
                    mostrarMsg(false, (res2 as { mensaje?: string }).mensaje ?? "Error al eliminar")
                }
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al eliminar")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoVar(false) }
    }

    // ── Foto por variación (Fase 5) ──
    // La foto de la variación se muestra en el catálogo al elegir esa
    // presentación (ej. la foto de la Hamburguesa Doble). Se sube comprimida
    // a Cloudinary (mismo flujo que las fotos de producto).
    async function subirFotoVariacionItem(v: Variacion, file: File) {
        if (!prodEditar || guardandoVar) return
        setGuardandoVar(true)
        try {
            const comp = await comprimirImagen(file)
            const res = await api.subirFotoVariacion(v.id, comp)
            setEditVariaciones(prev => prev.map(x => x.id === v.id ? { ...x, foto: res.url } : x))
            setInv(prev => prev.map(p => p.producto === prodEditar
                ? { ...p, variaciones: (p.variaciones || []).map(x => x.id === v.id ? { ...x, foto: res.url } : x) }
                : p))
            mostrarMsg(true, "Foto de la variación guardada")
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoVar(false) }
    }

    async function quitarFotoVariacionItem(v: Variacion) {
        if (!prodEditar || guardandoVar) return
        setGuardandoVar(true)
        try {
            if (v.foto && v.foto !== "No hay foto") api.borrarImagen(v.foto).catch(() => {})
            const res = await api.editarVariacion(v.id, v.nombre, v.precio, "")
            if (res.ok) {
                setEditVariaciones(prev => prev.map(x => x.id === v.id ? res.variacion : x))
                setInv(prev => prev.map(p => p.producto === prodEditar
                    ? { ...p, variaciones: (p.variaciones || []).map(x => x.id === v.id ? { ...x, foto: "" } : x) }
                    : p))
                mostrarMsg(true, "Foto de la variación eliminada")
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al quitar la foto")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoVar(false) }
    }

    // ── CRUD de materiales de la receta (Fase 3) ──
    // El buscador sugiere SOLO productos de stock (los que tienen inventario).
    const matSugerencias = (() => {
        if (!matBuscador.trim()) return []
        const q = matBuscador.toLowerCase()
        return inv
            .filter(p => p.tipo_producto === "stock" && p.producto.toLowerCase().includes(q) && p.producto !== prodEditar)
            .slice(0, 6)
    })()

    async function agregarMaterialItem() {
        if (!prodEditar || guardandoReceta || !matSeleccionado) return
        const cant = Number(matCantidad === "" ? 1 : matCantidad)
        if (!(cant > 0)) { mostrarMsg(false, "La cantidad debe ser mayor a 0"); return }
        setGuardandoReceta(true)
        try {
            // variacion_id: el contexto de receta seleccionado (null = base)
            const res = await api.agregarMaterial(prodEditar, matSeleccionado, cant, matVariacionSel)
            if (res.ok) {
                // Recargar la receta completa (para reflejar el id y orden)
                const recetas = await api.getRecetas(prodEditar)
                setEditRecetas(recetas)
                setMatBuscador(""); setMatSeleccionado(""); setMatCantidad("")
                mostrarMsg(true, `Material '${matSeleccionado}' agregado a la receta`)
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al agregar el material")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoReceta(false) }
    }

    async function editarMaterialItem(id: number, cantidad: number) {
        if (guardandoReceta) return
        setGuardandoReceta(true)
        try {
            const res = await api.editarMaterial(id, cantidad)
            if (res.ok) {
                setEditRecetas(prev => prev.map(r => r.id === id ? { ...r, cantidad: res.cantidad } : r))
                mostrarMsg(true, "Cantidad actualizada")
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al actualizar")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoReceta(false) }
    }

    async function eliminarMaterialItem(id: number) {
        if (guardandoReceta) return
        if (!confirm("¿Quitar este material de la receta?")) return
        setGuardandoReceta(true)
        try {
            const res = await api.eliminarMaterial(id)
            if (res.ok) {
                setEditRecetas(prev => prev.filter(r => r.id !== id))
                mostrarMsg(true, "Material eliminado de la receta")
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al eliminar")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoReceta(false) }
    }

    /** Guarda los cambios de un lote individual desde el formulario Editar Prod. */
    async function guardarLoteIndividual() {
        if (loteEditandoId === null || guardando) return
        setGuardando(true)
        try {
            await api.editarLote(loteEditandoId, { costo: Number(editLoteVal.costo), precio_venta: Number(editLoteVal.precio_venta), stock: Number(editLoteVal.stock), etiqueta: editLoteVal.etiqueta, variacion: editLoteVal.variacion })
            mostrarMsg(true, "Lote actualizado")
            setLoteEditandoId(null)
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    /**
     * Da de baja un lote individual desde el formulario Editar Prod.
     * Muestra un diálogo de confirmación persistente que no desaparece
     * hasta que se completa la eliminación, para evitar errores accidentales.
     * Si es el último lote activo, también desactiva el producto automáticamente.
     */
    async function eliminarLoteHandler(id_lote: string) {
        setGuardando(true)
        try {
            const res = await api.eliminarLote(id_lote)
            setLoteEliminarConfirm(null)
            if (res.producto_desactivado) {
                mostrarMsg(true, `Lote #${id_lote} eliminado. El producto "${res.producto}" también fue desactivado por ser el único lote.`)
            } else {
                mostrarMsg(true, `Lote #${id_lote} eliminado`)
            }
            recargar()
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error al eliminar lote"}`)
        } finally {
            setGuardando(false)
        }
    }

    function confirmarEliminarCategoria() {
        const cat = confirmEliminarCat
        if (!cat) return
        setConfirmEliminarCat(null)
        eliminarCategoria(cat)
    }

    async function eliminarCategoria(cat: string) {
        try {
            const res = await api.eliminarCategoria(cat) as { productos_actualizados: number }
            mostrarMsg(true, `Categoría "${cat}" eliminada de ${res.productos_actualizados} producto(s)`)
            await Promise.all([recargar(), cargarCategorias()])
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: "nuevo", label: "Nuevo", icon: "ClipboardPlus" },
        { id: "restock", label: "Restock", icon: "PackagePlus" },
        { id: "editar", label: "Editar Prod.", icon: "Pencil" },
    ]

    const totalActivos = inv.filter(p => p.stock_total > 0).length
    const valorInv = inv.reduce((a, p) => a + p.stock_total * p.precio_venta, 0)
    const ganPotencial = inv.reduce((a, p) => a + p.stock_total * (p.precio_venta - p.costo_promedio), 0)
    const stockDesc = inv.filter(p => p.stock_total <= 0).length
    // Categorías disponibles: combina las que están en uso por productos + las de la tabla 'categorias'
    // Al unir ambas fuentes, las categorías recién creadas aparecen como chips cliqueables inmediatamente
    const categoriasExistentes = Array.from(new Set([
        ...inv.flatMap(p => (p.categoria || ["General"]).map(c => c.trim())),
        ...categorias.map(c => c.nombre)
    ])).sort()
    const productosEditar = inv.filter(p => {
        const b = buscadorEditar.toLowerCase()
        const porBusqueda = !b || p.producto.toLowerCase().includes(b) ||
            p.descripcion?.toLowerCase().includes(b) ||
            (p.categoria || ["General"]).join(" ").toLowerCase().includes(b)
        const porCategoria = catSelecEditar === "Todas" || (p.categoria || ["General"]).includes(catSelecEditar)
        return porBusqueda && porCategoria
    }).sort((a, b) => {
        // Ordenamiento seleccionado por el usuario (mismo control que Punto de Venta y Restock).
        // Se manejan explícitamente los 6 valores posibles para que cada opción ordene
        // correctamente en ambas direcciones (asc y desc).
        switch (editarOrdenamiento) {
            case "precio-desc":
                return b.precio_venta - a.precio_venta
            case "precio-asc":
                return a.precio_venta - b.precio_venta
            case "stock-desc":
                return b.stock_total - a.stock_total
            case "stock-asc":
                return a.stock_total - b.stock_total
            case "alfabetico":
                return a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
            case "alfabetico-desc":
                return b.producto.localeCompare(a.producto, "es", { sensitivity: "base" })
            default:
                return a.stock_total - b.stock_total
        }
    })
    // Productos filtrados y ordenados para el Restock
    // Los servicios (sin stock) no se pueden restockear → se excluyen.
    const productosRestock = inv.filter(p => {
        if (p.tipo_producto === "servicio") return false
        const b = restockBuscadorDebounced.toLowerCase()
        const porBusqueda = !b || p.producto.toLowerCase().includes(b) ||
            p.descripcion?.toLowerCase().includes(b) ||
            p.codigo_interno?.toLowerCase().includes(b) ||
            p.codigo_barras?.toLowerCase().includes(b) ||
            (p.categoria || ["General"]).join(" ").toLowerCase().includes(b)
        const porCategoria = restockCatSelec === "Todas" || (p.categoria || ["General"]).includes(restockCatSelec)
        return porBusqueda && porCategoria
    }).sort((a, b) => {
        switch (restockOrdenamiento) {
            case "precio-desc":
                return b.precio_venta - a.precio_venta
            case "precio-asc":
                return a.precio_venta - b.precio_venta
            case "stock-desc":
                return b.stock_total - a.stock_total
            case "stock-asc":
                return a.stock_total - b.stock_total
            case "alfabetico":
                return a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
            case "alfabetico-desc":
                return b.producto.localeCompare(a.producto, "es", { sensitivity: "base" })
            default:
                return a.stock_total - b.stock_total
        }
    })

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero con Antigravity ── */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--gradient-2)", padding: "32px 24px 90px" }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                    <Antigravity
                        count={400}
                        magnetRadius={12}
                        ringRadius={8}
                        waveSpeed={0.5}
                        waveAmplitude={1.2}
                        particleSize={1.5}
                        lerpSpeed={0.08}
                        color="var(--ag-color-2)"
                        autoAnimate={true}
                        particleVariance={0.8}
                        rotationSpeed={0.3}
                        depthFactor={0.5}
                        pulseSpeed={2}
                        particleShape="capsule"
                        fieldStrength={8}
                    />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    <p style={{ color: "var(--primary-darkGray)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>GESTIÓN</p>
                    <h1 style={{ color: "var(--primary-dark)", fontSize: "1.7rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "12px" }}>
                        <Icon name="Package" size={32} color="var(--primary-dark)" />
                        <span>Inventario</span>
                    </h1>
                </div>
            </div>

            <div style={{ padding: "0 24px", marginTop: -60, overflowX: "hidden" }}>
                {/* Stat cards — clickeables para ver explicación */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }} className="md:grid-cols-4">
                    {[
                        { label: "Productos activos", valor: totalActivos, icon: "PackagePlus" },
                        { label: "Valor del inventario", valor: `$${valorInv.toFixed(0)}`, icon: "PiggyBank" },
                        { label: "Ganancia potencial", valor: `$${ganPotencial.toFixed(0)}`, icon: "Banknote" },
                        { label: "Stock descuadrado", valor: stockDesc, icon: "TriangleAlert" },
                    ].map(m => (
                        <div
                            key={m.label}
                            className="card fade-up"
                            onClick={() => setKpiExplicacion(m.label)}
                            style={{
                                padding: "14px 16px",
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                cursor: "pointer",
                                transition: "all 0.15s",
                                border: kpiExplicacion === m.label ? "2px solid var(--primary-mid)" : "2px solid transparent"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 16px var(--primary-glow)" }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}
                        >
                            <div style={{ background: "var(--gradient-1)", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.1rem" }}>
                                <Icon name={m.icon as any} size={24} color="var(--primary-soft)" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{m.label}</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>{m.valor}</p>
                            </div>                        </div>
                    ))}
                </div>

                {/* Mensaje */}
                {msg && (
                    <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 12, borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#f44336"}`, color: msg.ok ? "#2e7d32" : "#b71c1c", fontSize: "0.875rem", fontWeight: 600 }}>
                        {msg.texto}
                    </div>
                )}

                {/* Tabs */}
                <div className="card" style={{ display: "flex", padding: 6, gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flex: 1, minWidth: 80, padding: "8px 12px", gap: 8, borderRadius: 10, border: "none",
                            background: tab === t.id ? "var(--gradient-1)" : "transparent",
                            color: tab === t.id ? "#fff" : "var(--text-muted)",
                            fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", transition: "all 0.2s",
                        }}>
                            <Icon name={t.icon as any} size={22} color={tab === t.id ? "#fff" : "var(--text-muted)"} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Nuevo producto + Gestión de categorías */}
                {tab === "nuevo" && (
                    <div style={{ display: "flex", gap: 16, width: "100%" }} className="flex-col md:flex-row md:items-stretch">
                        {/* ── Card: Dar de alta producto ── */}
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
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
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
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
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
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
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
                                planLocked={tenant?.plan === "basico"}
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

                        {/* ── Card: Gestionar Categorías ── */}
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
                                                            color: "var(--text-secondary)",
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
                    </div>
                )}

                {/* ── Restock: buscador + grid (como Editar Prod.) ── */}
                {tab === "restock" && !restockProdSeleccionado && (
                    <>
                        {/* Categorías */}
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
                            {["Todas", ...categoriasExistentes].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setRestockCatSelec(cat)}
                                    style={{
                                        padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                                        background: restockCatSelec === cat ? "var(--gradient-1)" : "var(--bg-card2)",
                                        color: restockCatSelec === cat ? "#fff" : "var(--primary-dark)",
                                        boxShadow: restockCatSelec === cat ? "0 2px 6px var(--primary-glow)" : "none"
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 200 }}>
                                <Icon name="Search" size={20} color="var(--text-muted)" />
                                <input
                                    className="input-primary"
                                    style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                                    placeholder="Buscar por nombre, código o categoría..."
                                    value={restockBuscador}
                                    onChange={e => setRestockBuscador(e.target.value)}
                                />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid var(--border-primary)", paddingLeft: 12 }}>
                                <button
                                    onClick={() => {
                                        setRestockOrdenamiento(prev => {
                                            if (prev === "alfabetico") return "alfabetico-desc"
                                            if (prev === "alfabetico-desc") return "alfabetico"
                                            if (prev.endsWith("-asc")) return prev.replace("-asc", "-desc")
                                            if (prev.endsWith("-desc")) return prev.replace("-desc", "-asc")
                                            return prev
                                        })
                                    }}
                                    title="Invertir orden"
                                    style={{
                                        background: "none", border: "none",
                                        cursor: "pointer", padding: 4,
                                        borderRadius: 6, display: "flex", alignItems: "center",
                                        transition: "all 0.15s"
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card2)" }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "none" }}
                                >
                                    <Icon name="ArrowUpDown" size={20} color="var(--text-muted)" />
                                </button>
                                <select
                                    className="input-primary"
                                    style={{ border: "none", padding: "4px 8px", fontSize: "0.85rem", background: "transparent", cursor: "pointer", fontWeight: 700, color: "var(--primary-dark)" }}
                                    value={restockOrdenamiento}
                                    onChange={e => setRestockOrdenamiento(e.target.value)}
                                >
                                    <option value="stock-desc">Mayor stock</option>
                                    <option value="stock-asc">Menor stock</option>
                                    <option value="precio-desc">Mayor precio</option>
                                    <option value="precio-asc">Menor precio</option>
                                    <option value="alfabetico">Alfabético A-Z</option>
                                    <option value="alfabetico-desc">Alfabético Z-A</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                            {productosRestock.length === 0 ? (
                                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                                    <span style={{ fontSize: "4rem", display: "block", marginBottom: 16, opacity: 0.3 }}>—</span>
                                    <h2 style={{ fontSize: "1.5rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 8px" }}>Sin resultados</h2>
                                    <p style={{ fontSize: "1rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>Intenta con otra búsqueda o categoría</p>
                                </div>
                            ) : (
                                productosRestock.map(prod => (
                                    <div
                                        key={prod.producto}
                                        className="card fade-up"
                                        style={{ padding: 12, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                                        onClick={() => {
                                            setRestockProdSeleccionado(prod)
                                            setRestock(r => ({
                                                ...r,
                                                producto: prod.producto,
                                                costo: Number(prod.costo_promedio ?? 0).toFixed(2),
                                                precio_venta: Number(prod.precio_venta ?? 0).toFixed(2),
                                                variacion: ""
                                            }))
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.transform = "translateY(-3px)"
                                            e.currentTarget.style.boxShadow = "0 8px 30px var(--primary-glow)"
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.transform = ""
                                            e.currentTarget.style.boxShadow = ""
                                        }}
                                    >
                                        <div style={{ aspectRatio: "1", borderRadius: 12, background: "var(--gradient-bg-login)", marginBottom: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {prod.imagen && prod.imagen !== "No hay foto" ? (
                                                <img src={prod.imagen.startsWith("http") ? prod.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${prod.imagen}`}
                                                    alt={prod.producto}
                                                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }}
                                                    onError={(e) => { e.currentTarget.style.display = "none" }}
                                                    loading="lazy" />
                                            ) : (
                                                <Icon name="PackagePlus" size={32} color="var(--primary-mid)" />
                                            )}
                                        </div>
                                        <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.producto}</p>
                                        <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>${prod.precio_venta.toFixed(2)}</p>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px" }}>{(prod.categoria || ["General"]).join(", ")}</span>
                                            <span style={{
                                                fontSize: "0.62rem", fontWeight: 700,
                                                color: prod.stock_total <= 0 ? "#b71c1c" : "#2e7d32",
                                                background: prod.stock_total <= 0 ? "#ffeef0" : "#e8f5e9",
                                                borderRadius: 6, padding: "2px 6px"
                                            }}>Stock: {prod.stock_total}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}

                {/* ── Restock: formulario para el producto seleccionado ── */}
                {tab === "restock" && restockProdSeleccionado && (
                    <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <button
                                onClick={() => {
                                    setRestockProdSeleccionado(null)
                                    setRestockBuscador("")
                                    setRestockBuscadorDebounced("")
                                    setRestockCatSelec("Todas")
                                    setRestock({ producto: "", costo: "", precio_venta: "", stock: 1, etiqueta: "", variacion: "" })
                                }}
                                style={{ background: "var(--bg-card2)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}
                            >
                                <Icon name="ArrowLeft" size={18} color="var(--text-main)" /> Volver
                            </button>
                            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                                Añadir stock a: <strong style={{ color: "var(--text-main)" }}>{restockProdSeleccionado.producto}</strong>
                            </span>
                        </div>

                        {/* Resumen del producto */}
                        <div style={{
                            padding: "12px 16px",
                            borderRadius: 12,
                            background: "var(--bg-card2)",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8
                        }}>
                            <div>
                                <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Stock actual</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>{restockProdSeleccionado.stock_total}</p>
                            </div>
                            <div>
                                <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Precio venta</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)" }}>${restockProdSeleccionado.precio_venta.toFixed(2)}</p>
                            </div>
                            <div>
                                <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Costo promedio</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>${(restockProdSeleccionado.costo_promedio ?? 0).toFixed(2)}</p>
                            </div>
                            <div>
                                <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Margen</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: restockProdSeleccionado.precio_venta > (restockProdSeleccionado.costo_promedio ?? 0) ? "#2e7d32" : "#b71c1c" }}>
                                    {restockProdSeleccionado.precio_venta > 0
                                        ? `${(((restockProdSeleccionado.precio_venta - (restockProdSeleccionado.costo_promedio ?? 0)) / restockProdSeleccionado.precio_venta) * 100).toFixed(1)}%`
                                        : "—"}
                                </p>
                            </div>
                        </div>

                        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                            Costo y precio prellenados según el producto. Ajústalos si este nuevo lote tiene valores diferentes.
                        </p>
                        {restockProdSeleccionado?.stock_por_variacion && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                                    ¿A qué variación llegó el stock? *
                                </label>
                                <select
                                    className="input-primary"
                                    value={restock.variacion}
                                    onChange={e => setRestock(r => ({ ...r, variacion: e.target.value }))}
                                    style={{ width: "100%" }}
                                >
                                    <option value="">Selecciona la variación...</option>
                                    {(restockProdSeleccionado.variaciones || []).map(v => (
                                        <option key={v.id} value={v.nombre}>{v.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <Input label="Cantidad" type="number" min={0} step="0.1" placeholder="1" value={restock.stock} onChange={e => setRestock(r => ({ ...r, stock: e.target.value === "" ? "" : Number(e.target.value) }))} />
                            <Input label="Costo" type="number" min={0} step="0.01" placeholder="0.00" value={restock.costo} onChange={e => setRestock(r => ({ ...r, costo: e.target.value === "" ? "" : Number(e.target.value) }))} />
                            <Input label="Precio" type="number" min={0} step="0.01" placeholder="0.00" value={restock.precio_venta} onChange={e => setRestock(r => ({ ...r, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))} />
                        </div>
                        <Input label="Etiqueta del lote (opcional)" placeholder="Ej: 20cm, Premium, Oferta" value={restock.etiqueta} onChange={e => setRestock(r => ({ ...r, etiqueta: e.target.value }))} />
                        <button className="btn-primary" onClick={guardarRestock} disabled={guardando || !restock.producto || !restock.stock || Number(restock.stock) <= 0 || (!!restockProdSeleccionado?.stock_por_variacion && !restock.variacion)}>
                            {guardando ? "Procesando..." : "Añadir Stock"}
                        </button>
                    </div>
                )}

                {/* Editar producto — buscador */}
                {tab === "editar" && !prodEditar && (
                    <>
                        {/* Categorías */}
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
                            {["Todas", ...categoriasExistentes].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCatSelecEditar(cat)}
                                    style={{
                                        padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                                        background: catSelecEditar === cat ? "var(--primary-mid)" : "var(--bg-card2)",
                                        color: catSelecEditar === cat ? "#fff" : "var(--primary-dark)",
                                        boxShadow: catSelecEditar === cat ? "0 2px 6px var(--primary-glow)" : "none"
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 200 }}>
                                <Icon name="Search" size={20} color="var(--text-muted)" />
                                <input
                                    className="input-primary"
                                    style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                                    placeholder="Buscar producto por nombre, código o categoría..."
                                    value={buscadorEditar}
                                    onChange={e => setBuscadorEditar(e.target.value)}
                                />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid var(--border-primary)", paddingLeft: 12 }}>
                                <button
                                    onClick={() => {
                                        setEditarOrdenamiento(prev => {
                                            if (prev === "alfabetico") return "alfabetico-desc"
                                            if (prev === "alfabetico-desc") return "alfabetico"
                                            if (prev.endsWith("-asc")) return prev.replace("-asc", "-desc")
                                            if (prev.endsWith("-desc")) return prev.replace("-desc", "-asc")
                                            return prev
                                        })
                                    }}
                                    title="Invertir orden"
                                    style={{
                                        background: "none", border: "none",
                                        cursor: "pointer", padding: 4,
                                        borderRadius: 6, display: "flex", alignItems: "center",
                                        transition: "all 0.15s"
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card2)" }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "none" }}
                                >
                                    <Icon name="ArrowUpDown" size={20} color="var(--text-muted)" />
                                </button>
                                <select
                                    className="input-primary"
                                    style={{ border: "none", padding: "4px 8px", fontSize: "0.85rem", background: "transparent", cursor: "pointer", fontWeight: 700, color: "var(--primary-dark)" }}
                                    value={editarOrdenamiento}
                                    onChange={e => setEditarOrdenamiento(e.target.value)}
                                >
                                    <option value="stock-desc">Mayor stock</option>
                                    <option value="stock-asc">Menor stock</option>
                                    <option value="precio-desc">Mayor precio</option>
                                    <option value="precio-asc">Menor precio</option>
                                    <option value="alfabetico">Alfabético A-Z</option>
                                    <option value="alfabetico-desc">Alfabético Z-A</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                                {productosEditar.length === 0 ? (
                                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                                        <span style={{ fontSize: "4rem", display: "block", marginBottom: 16, opacity: 0.3 }}>—</span>
                                        <h2 style={{ fontSize: "1.5rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 8px" }}>Sin resultados</h2>
                                        <p style={{ fontSize: "1rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>Intenta con otra búsqueda o categoría</p>
                                    </div>
                                ) : (
                                    productosEditar.map(prod => (
                                        <div
                                            key={prod.producto}
                                            className="card fade-up"
                                            style={{ padding: 12, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                                            onClick={() => {
                                                // Guardar la posición de scroll Y antes de abrir el formulario,
                                                // para restaurarla al volver o guardar.
                                                scrollGridEditarRef.current = window.scrollY
                                                setProdEditar(prod.producto)
                                                setEditProdNombre(prod.producto)
                                                setLoteEditandoId(null)
                                                setEditFotos([]) // reset al cambiar de producto
                                                setEditProdVal({
                                                    descripcion: prod.descripcion ?? "",
                                                    estado: prod.estado ?? "Activo",
                                                    imagen: prod.imagen ?? "No hay foto",
                                                    categoria: prod.categoria ?? ["General"],
                                                    codigo_interno: prod.codigo_interno ?? "",
                                                    codigo_barras: prod.codigo_barras ?? "",
                                                    ubicacion: prod.ubicacion ?? "",
                                                    visible_en_catalogo: prod.visible_en_catalogo ?? true,
                                                    sufijo_precio: prod.sufijo_precio ?? "",
                                                    fraccionable: prod.fraccionable ?? false,
                                                    tipo_producto: prod.tipo_producto ?? "stock",
                                                    costo_servicio: prod.costo_servicio ?? "",
                                                    precio_servicio: prod.precio_servicio ?? "",
                                                    stock_por_variacion: prod.stock_por_variacion ?? false,
                                                })
                                                // Cargar las variaciones del producto (nombre + precio propio)
                                                setEditVariaciones(prod.variaciones ?? [])
                                                setNuevaVarNombre(""); setNuevaVarPrecio("")
                                                // Cargar los materiales de la receta (si es compuesto)
                                                setEditRecetas(prod.recetas ?? [])
                                                setMatBuscador(""); setMatSeleccionado(""); setMatCantidad(""); setMatVariacionSel(null)
                                                // Cargar todas las fotos del producto (principal + extras) en editFotos
                                                const fotos: FotoGaleria[] = []
                                                if (prod.imagen && prod.imagen !== "No hay foto") {
                                                    fotos.push({ url: prod.imagen, orden: 1 }) // principal = orden 1
                                                }
                                                api.getImagenesProducto(prod.producto)
                                                    .then(extras => {
                                                        const todas = [...fotos, ...extras.map(e => ({ url: e.url, id: e.id, orden: e.orden }))]
                                                        setEditFotos(todas)
                                                    })
                                                    .catch(() => setEditFotos(fotos))
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.transform = "translateY(-3px)"
                                                e.currentTarget.style.boxShadow = "0 8px 30px var(--primary-glow)"
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = ""
                                                e.currentTarget.style.boxShadow = ""
                                            }}
                                        >
                                            <div style={{ aspectRatio: "1", borderRadius: 12, background: "var(--gradient-bg-login)", marginBottom: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {prod.imagen && prod.imagen !== "No hay foto" ? (
                                                    <img src={prod.imagen.startsWith("http") ? prod.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${prod.imagen}`}
                                                        alt={prod.producto}
                                                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }}
                                                        onError={(e) => { e.currentTarget.style.display = "none" }}
                                                        loading="lazy" />
                                                ) : (
                                                    <Icon name="Package" size={32} color="var(--text-muted)" />
                                                )}
                                            </div>
                                            <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.producto}</p>
                                            <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>${prod.precio_venta.toFixed(2)}</p>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px" }}>{(prod.categoria || ["General"]).join(", ")}</span>
                                                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: prod.stock_total <= 0 ? "#b71c1c" : "#2e7d32", background: prod.stock_total <= 0 ? "#ffeef0" : "#e8f5e9", borderRadius: 6, padding: "2px 6px" }}>Stock: {prod.stock_total}</span>
                                            </div>
                                        </div>
                                    )))}
                            </div>
                    </>
                )}

                {/* Editar producto — formulario + lotes */}
                {tab === "editar" && prodEditar && (
                    <>
                        {/* ── Card 1: Información del producto ── */}
                        <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <button
                                    // Al volver: se conserva el buscador y el filtro de categorías
                                    // (ya NO se limpian) y el scroll se restaura vía useEffect.
                                    onClick={() => { setProdEditar(""); setLoteEditandoId(null); setEditFotos([]) }}
                                    style={{ background: "var(--bg-card2)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}
                                >
                                    <Icon name="ArrowLeft" size={18} color="var(--text-main)" /> Volver
                                </button>
                                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-muted)" }}>Editando: <strong style={{ color: "var(--text-main)" }}>{prodEditar}</strong></span>
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
                                planLocked={tenant?.plan === "basico"}
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

                            {/* Fase 6: stock separado por variación (solo tipo stock) */}
                            {editProdVal.tipo_producto === "stock" && (
                                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card2)", borderRadius: 12, padding: "10px 14px", flexWrap: "wrap" }}>
                                    <Icon name="Boxes" size={18} color={editProdVal.stock_por_variacion ? "var(--primary-mid)" : "var(--text-muted)"} />
                                    <div style={{ flex: 1, minWidth: 180 }}>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)" }}>Stock separado por variación</p>
                                        <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                            Cada variación lleva su propio inventario (ej. llavero Corazones: Blanco 3, Rojo 5, Azul 0) y se marca "Agotado" en el catálogo cuando se acaba. El restock pide la variación y la tabla de lotes muestra a cuál pertenece cada lote.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nuevo = !editProdVal.stock_por_variacion
                                            if (nuevo) {
                                                // Advertencia si hay lotes base con stock sin variación asignada
                                                const sinAsignar = lotes.filter(l => l.producto === prodEditar && !l.variacion && (l.stock_lote || 0) !== 0)
                                                if (sinAsignar.length > 0 && !confirm(`Este producto tiene ${sinAsignar.length} lote(s) con stock sin variación asignada. Aparecerán en "Sin asignar" en la tabla de lotes para que los asignes manualmente.`)) return
                                            }
                                            setEditProdVal(p => ({ ...p, stock_por_variacion: nuevo }))
                                        }}
                                        style={{
                                            padding: "6px 16px", borderRadius: 14, border: "none", cursor: "pointer",
                                            fontWeight: 700, fontSize: "0.75rem", transition: "all 0.15s",
                                            background: editProdVal.stock_por_variacion ? "var(--primary-mid)" : "var(--bg-card)",
                                            color: editProdVal.stock_por_variacion ? "#fff" : "var(--text-main)",
                                            boxShadow: editProdVal.stock_por_variacion ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                                        }}
                                    >
                                        {editProdVal.stock_por_variacion ? "Activado" : "Desactivado"}
                                    </button>
                                </div>
                            )}

                            {/* Lista de variaciones existentes */}
                            {editVariaciones.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {editVariaciones.map(v => (
                                        <VariacionRow
                                            key={v.id}
                                            variacion={v}
                                            disabled={guardandoVar}
                                            stockVisible={editProdVal.stock_por_variacion && editProdVal.tipo_producto === "stock"}
                                            onGuardar={(nombre, precio) => editarVariacionItem(v.id, nombre, precio)}
                                            onEliminar={() => eliminarVariacionItem(v.id)}
                                            onCambiarFoto={(file) => subirFotoVariacionItem(v, file)}
                                            onQuitarFoto={() => quitarFotoVariacionItem(v)}
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
                                        value={nuevaVarNombre}
                                        onChange={e => setNuevaVarNombre(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") agregarVariacion() }}
                                    />
                                </div>
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
                )}

                {/* ── Modal: Confirmar eliminar categoría ── */}
                {confirmEliminarCat !== null && (
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
                                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                    Eliminar categoría
                                </h3>
                            </div>

                            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                                ¿Estás seguro de eliminar la categoría <strong>"{confirmEliminarCat}"</strong>? Se eliminará de todos los productos.
                            </p>

                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                                <button onClick={() => setConfirmEliminarCat(null)}
                                    style={{
                                        padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                        background: "var(--bg-card2)", color: "var(--text-main)",
                                        fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                                        transition: "all 0.15s"
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button onClick={confirmarEliminarCategoria}
                                    style={{
                                        padding: "10px 20px", borderRadius: 10, border: "none",
                                        background: "#ad4955ff",
                                        color: "#fff",
                                        fontWeight: 700, fontSize: "0.82rem",
                                        cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 8,
                                        transition: "all 0.15s"
                                    }}
                                >
                                    <Icon name="Trash2" size={16} color="#fff" /> Sí, eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Popup de explicación de KPI ── */}
                {kpiExplicacion && (() => {
                    const info = explicacionesKPI[kpiExplicacion]
                    if (!info) return null
                    // Mapa de íconos para cada KPI
                    const iconosKPI: Record<string, string> = {
                        "Productos activos": "PackagePlus",
                        "Valor del inventario": "PiggyBank",
                        "Ganancia potencial": "Banknote",
                        "Stock descuadrado": "TriangleAlert",
                    }
                    const iconoKPI = iconosKPI[kpiExplicacion] || "Info"
                    return (
                        <div
                            style={{
                                position: "fixed", inset: 0, zIndex: 9999,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                                padding: 24
                            }}
                            onClick={() => setKpiExplicacion(null)}
                        >
                            <div
                                className="fade-up"
                                onClick={e => e.stopPropagation()}
                                style={{
                                    maxWidth: 480,
                                    width: "100%",
                                    padding: 28,
                                    borderRadius: 20,
                                    background: "var(--bg-card)",
                                    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                                    border: "1px solid var(--border-primary)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 16
                                }}
                            >
                                {/* Header */}
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: "var(--gradient-1)",
                                        display: "flex",
                                        alignItems: "center", justifyContent: "center", flexShrink: 0
                                    }}>
                                        <Icon name={iconoKPI as any} size={24} color="var(--primary-soft)" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                            ¿Qué significa?
                                        </h3>
                                        <p style={{ margin: "2px 0 0", fontSize: "0.85rem", fontWeight: 700, color: "var(--primary-mid)" }}>
                                            {kpiExplicacion}
                                        </p>
                                    </div>
                                </div>

                                {/* Descripción */}
                                <div style={{
                                    padding: "16px 20px",
                                    borderRadius: 12,
                                    background: "var(--bg-card2)",
                                    lineHeight: 1.6,
                                    fontSize: "0.88rem",
                                    color: "var(--text-main)",
                                    fontWeight: 500
                                }}>
                                    {info.descripcion}
                                </div>

                                {/* Fórmula */}
                                <div style={{
                                    padding: "12px 16px",
                                    borderRadius: 10,
                                    background: "var(--primary-bg)",
                                    border: "1px solid var(--border-primary)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10
                                }}>
                                    <Icon name="Calculator" size={18} color="var(--primary-mid)" />
                                    <span style={{
                                        fontSize: "0.82rem",
                                        fontWeight: 700,
                                        color: "var(--primary-dark)",
                                        fontFamily: "monospace"
                                    }}>
                                        {info.formula}
                                    </span>
                                </div>

                                {/* Botón cerrar */}
                                <button
                                    onClick={() => setKpiExplicacion(null)}
                                    style={{
                                        alignSelf: "flex-end",
                                        padding: "10px 24px",
                                        borderRadius: 10,
                                        border: "none",
                                        background: "var(--gradient-1)",
                                        color: "#fff",
                                        fontWeight: 700,
                                        fontSize: "0.85rem",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        transition: "all 0.15s"
                                    }}
                                >
                                    Entendido
                                </button>
                            </div>
                        </div>
                    )
                })()}

                <div style={{ height: 20 }} />
            </div>
        </div>
    )
}
