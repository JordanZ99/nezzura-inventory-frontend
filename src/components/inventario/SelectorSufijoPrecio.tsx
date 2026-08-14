import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"

/**
 * Selector de sufijo del precio que se muestra en el catálogo público.
 * 4 casillas: "c/u", "kg", "lt", "mt" y una libre ("Otro" → ej. "por docena").
 * El valor guardado es el texto final ("", "c/u", "kg", "lt", "mt", ...).
 */
export default function SelectorSufijoPrecio({ value, onChange, fraccionable, onFraccionableChange }: {
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

    const chipStyle = (activo: boolean): CSSProperties => ({
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
