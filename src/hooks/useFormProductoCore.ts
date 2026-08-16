// ==============================================================================
// src/hooks/useFormProductoCore.ts
// Sub-hook del módulo Inventario: lógica principal del formulario —
// alta de producto (con foto + compresión), restock, edición básica del
// producto (guardado unificado con variaciones pendientes), lotes individuales
// y gestión de categorías. También comparte el contexto de edición (prodEditar,
// restock) que el orquestador eleva para los otros sub-hooks.
// No toca JSX: devuelve estado, setters y handlers para el orquestador.
// ==============================================================================

import { useEffect, useRef, useState } from "react"
import { api, Producto, Variacion } from "@/lib/api"
import { comprimirImagen } from "@/lib/image-utils"
import type { FotoGaleria } from "@/components/ui/GaleriaProducto"
// Imports SOLO de tipos (se borran en compilación): no crean ciclos en runtime.
import type { NuevaVariacionAlta } from "@/hooks/useFormVariaciones"
import type { NuevoMaterialAlta } from "@/hooks/useFormRecetas"

// ── Tipos de los formularios (exportados para tipar los componentes de UI) ──

export type FormAltaProducto = {
    producto: string
    descripcion: string
    categoria: string[]
    costo: number | string
    precio_venta: number | string
    stock: number | string
    codigo_interno: string
    codigo_barras: string
    ubicacion: string
    etiqueta: string
    sufijo_precio: string
    fraccionable: boolean
    tipo_producto: string
    costo_servicio: number | string
    precio_servicio: number | string
    visible_en_catalogo: boolean
}

export type FormRestock = {
    producto: string
    costo: number | string
    precio_venta: number | string
    stock: number | string
    etiqueta: string
    variacion: string
}

export type FormEditProd = {
    descripcion: string
    estado: string
    imagen: string
    categoria: string[]
    codigo_interno: string
    codigo_barras: string
    ubicacion: string
    visible_en_catalogo: boolean
    sufijo_precio: string
    fraccionable: boolean
    tipo_producto: string
    costo_servicio: number | string
    precio_servicio: number | string
}

export type FormEditLote = {
    costo: number | string
    precio_venta: number | string
    stock: number | string
    etiqueta: string
    variacion: string
}

const FORM_ALTA_INICIAL: FormAltaProducto = {
    producto: "", descripcion: "", categoria: ["General"], costo: "", precio_venta: "",
    stock: 1, codigo_interno: "", codigo_barras: "", ubicacion: "", etiqueta: "",
    sufijo_precio: "", fraccionable: false, tipo_producto: "stock", costo_servicio: "",
    precio_servicio: "", visible_en_catalogo: true,
}

const FORM_RESTOCK_INICIAL: FormRestock = {
    producto: "", costo: "", precio_venta: "", stock: 1, etiqueta: "", variacion: "",
}

const FORM_EDIT_PROD_INICIAL: FormEditProd = {
    descripcion: "", estado: "Activo", imagen: "No hay foto", categoria: ["General"],
    codigo_interno: "", codigo_barras: "", ubicacion: "", visible_en_catalogo: true,
    sufijo_precio: "", fraccionable: false, tipo_producto: "stock", costo_servicio: "",
    precio_servicio: "",
}

interface UseFormProductoCoreArgs {
    // Datos compartidos (provienen de useInventarioData)
    inv: Producto[]
    recargar: () => Promise<void>
    cargarCategorias: () => Promise<void>
    setRestockProdSeleccionado: (p: Producto | null) => void
    mostrarMsg: (ok: boolean, texto: string) => void
    // Contexto compartido (estado elevado por el orquestador useInventarioForm)
    prodEditar: string
    setProdEditar: (p: string) => void
    restock: FormRestock
    setRestock: React.Dispatch<React.SetStateAction<FormRestock>>
    // Desde useFormVariaciones
    editVariaciones: Variacion[]
    pendientesVarRef: React.MutableRefObject<Record<number, { nombre: string; precio: number }>>
    resetEstadoVariaciones: (prod: Producto) => void
    // Desde useFormRecetas
    resetEstadoRecetas: (prod: Producto) => void
}

export function useFormProductoCore({
    inv,
    recargar,
    cargarCategorias,
    setRestockProdSeleccionado,
    mostrarMsg,
    prodEditar,
    setProdEditar,
    restock,
    setRestock,
    editVariaciones,
    pendientesVarRef,
    resetEstadoVariaciones,
    resetEstadoRecetas,
}: UseFormProductoCoreArgs) {
    const [form, setForm] = useState<FormAltaProducto>(FORM_ALTA_INICIAL)
    // Variaciones y materiales pendientes del ALTA (se guardan en la misma
    // transacción que el producto, vía crear_producto_completo)
    const [nuevasVariaciones, setNuevasVariaciones] = useState<NuevaVariacionAlta[]>([])
    // Alta: toggle "¿tiene variaciones?" — si está ON, se oculta la cantidad
    // general (el stock vive por variación) y se despliega la config de variaciones.
    const [altaConVariaciones, setAltaConVariaciones] = useState(false)
    const [nuevosMateriales, setNuevosMateriales] = useState<NuevoMaterialAlta[]>([])
    const [nuevasFotos, setNuevasFotos] = useState<FotoGaleria[]>([])
    const [editFotos, setEditFotos] = useState<FotoGaleria[]>([])
    const [editProdNombre, setEditProdNombre] = useState("")
    const [editProdVal, setEditProdVal] = useState<FormEditProd>(FORM_EDIT_PROD_INICIAL)

    // Estado para editar lotes individuales dentro del formulario Editar Prod.
    const [loteEditandoId, setLoteEditandoId] = useState<string | null>(null)
    const [editLoteVal, setEditLoteVal] = useState<FormEditLote>({ costo: "", precio_venta: "", stock: "", etiqueta: "", variacion: "" })
    // Estado para el diálogo de confirmación persistente al dar de baja un lote
    // Contiene el id del lote pendiente de confirmación; no se cierra hasta eliminar o recargar
    const [loteEliminarConfirm, setLoteEliminarConfirm] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [nuevaCategoria, setNuevaCategoria] = useState("")

    // Estado para la gestión de categorías
    const [nuevaCatNombre, setNuevaCatNombre] = useState("")
    const [catEditandoId, setCatEditandoId] = useState<string | null>(null)
    const [catEditandoNombre, setCatEditandoNombre] = useState("")
    const [confirmEliminarCat, setConfirmEliminarCat] = useState<string | null>(null)

    // ── Restauración de posición al volver del formulario "Editar Prod." ──
    // Guarda el scroll Y del grid de productos en el momento exacto en que se
    // abre el formulario de edición (ANTES de que la vista cambie, porque el
    // formulario es más corto que el grid y el navegador "sujeta" el scroll).
    // Al volver (o al guardar), se restaura esa posición para que el usuario
    // regrese exactamente donde estaba, conservando su contexto visual.
    const scrollGridEditarRef = useRef<number | null>(null)

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

    function agregarCategoria() {
        const cat = nuevaCategoria.trim()
        if (!cat) return
        if (form.categoria.includes(cat)) return
        setForm(f => ({ ...f, categoria: [...f.categoria, cat] }))
        setNuevaCategoria("")
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
    function iniciarEditarCategoria(cat: { id: string; nombre: string }) {
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
            setAltaConVariaciones(false)
            setForm(FORM_ALTA_INICIAL)
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
            setRestock(FORM_RESTOCK_INICIAL)
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function guardarProducto() {
        if (!prodEditar || guardando) return
        setGuardando(true)
        // Si la edición falla tras subir una foto principal nueva, se borra de
        // Cloudinary para no dejar imágenes huérfanas (misma lógica que en el alta).
        let imagenSubidaEdit = ""
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
                imagenSubidaEdit = r.ruta
            } else if (editFotos.length === 0 && editProdVal.imagen !== "No hay foto") {
                // Se eliminaron todas las fotos → quitar foto principal
                nuevaImagen = "No hay foto"
            } else if (principalEdit && !principalEdit.file && principalEdit.url !== editProdVal.imagen) {
                // La principal cambió SIN subir un archivo nuevo (se reordenó o
                // se eliminó del carrusel): la nueva principal es la primera
                // foto restante, que ya existe en Cloudinary (solo cambia la
                // referencia en productos.imagen).
                nuevaImagen = principalEdit.url
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
            }
            await api.editarProducto(prodEditar, payload)

            // El producto pudo renombrarse en este PATCH: todas las llamadas
            // posteriores a la galería deben usar el nombre FINAL (el nuevo si
            // cambió), no el nombre viejo con el que abrimos el formulario — el
            // viejo ya no existe en la DB y el backend respondería 404. Espejo
            // de la lógica del backend: si el nuevo nombre quedó vacío o es
            // igual al actual, el producto conserva su nombre original.
            const nombreEfectivo = (editProdNombre || "").trim() || prodEditar
            // La foto principal recién subida ya quedó referenciada en la DB
            // (el PATCH guardó payload.imagen): si un paso posterior falla, ya
            // no debe borrarse de Cloudinary (la borraría y dejaría la imagen
            // rota en el producto).
            imagenSubidaEdit = ""

            // ── Guardar variaciones pendientes (guardado unificado) ──
            // Nombre/precio editados en las filas se persisten aquí, junto con
            // el resto del producto (ya no hay guardado individual por fila).
            const pendientes = pendientesVarRef.current
            for (const v of editVariaciones) {
                const pend = pendientes[v.id]
                if (!pend) continue
                const res = await api.editarVariacion(v.id, pend.nombre.trim(), pend.precio)
                if (!res.ok) {
                    throw new Error((res as { mensaje?: string }).mensaje ?? `No se pudo guardar la variación '${pend.nombre}'`)
                }
            }
            pendientesVarRef.current = {}

            // ── Sincronizar fotos extras (índices 1+) ──
            // Eliminar fotos que ya no están en el array. La fila que representa
            // a la foto principal (posición 0) NUNCA se elimina por no tener id:
            // se identifica por URL (tanto la actual como la recién guardada) y
            // se conserva aunque la posición 0 del array no traiga id.
            const fotosActuales = await api.getImagenesProducto(nombreEfectivo)
            const urlPrincipalActual = editFotos[0]?.url
            const urlPrincipalGuardada = payload.imagen && payload.imagen !== "No hay foto" ? payload.imagen : undefined
            for (const existente of fotosActuales) {
                const esPrincipal = (!!urlPrincipalActual && existente.url === urlPrincipalActual)
                    || (!!urlPrincipalGuardada && existente.url === urlPrincipalGuardada)
                const sigueEnArray = editFotos.some(f => f.id === existente.id) || esPrincipal
                if (!sigueEnArray) {
                    try { await api.eliminarImagenExtra(existente.id) }
                    catch { /* ignorar error al eliminar */ }
                }
            }
            // Subir nuevas fotos extras + reemplazadas
            // Para cada foto del array que tenga file (es nueva/cambiada):
            //   - Si tiene orden, reemplazar en ese orden (el backend sube primero
            //     y borra la vieja de Cloudinary después)
            //   - Si no tiene orden, inserción nueva
            const nuevosExtras = editFotos.slice(1).filter(f => f.file)
            for (const extra of nuevosExtras) {
                if (!extra.file) continue
                try {
                    let imgAEnviar = extra.file
                    try { imgAEnviar = await comprimirImagen(extra.file) }
                    catch { /* enviar original */ }
                    await api.subirImagenExtra(nombreEfectivo, imgAEnviar, extra.orden)
                } catch {
                    console.warn("Error subiendo imagen extra para", prodEditar)
                }
            }

            // ── Reordenar imágenes existentes si el orden cambió ──
            // Se mapea cada posición del array a su fila REAL de la galería por
            // URL (usando el estado fresco que ya incluye la principal sincronizada
            // por el backend). Así el reordenamiento nunca pisa la foto principal
            // con una URL vieja, y se omite si el orden ya es el correcto.
            const idsEnOrden = editFotos
                .map(f => fotosActuales.find(g => g.url === f.url)?.id)
                .filter((id): id is number => id !== undefined)
            if (idsEnOrden.length >= 2) {
                const ordenActual = fotosActuales
                    .filter(g => idsEnOrden.includes(g.id))
                    .sort((a, b) => a.orden - b.orden)
                    .map(g => g.id)
                const cambia = idsEnOrden.length !== ordenActual.length
                    || idsEnOrden.some((id, i) => id !== ordenActual[i])
                if (cambia) {
                    try {
                        await api.reordenarImagenes(nombreEfectivo, idsEnOrden)
                    } catch (err) {
                        console.warn("Error reordenando imágenes:", err)
                    }
                }
            }

            mostrarMsg(true, "Producto actualizado")
            setProdEditar(""); setEditProdNombre(""); setEditFotos([]); recargar()
        } catch (e: unknown) {
            // El guardado falló tras subir una foto principal nueva: limpiarla
            // de Cloudinary para no dejar huérfanas (igual que en el alta).
            if (imagenSubidaEdit) api.borrarImagen(imagenSubidaEdit).catch(() => {})
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`)
        }
        finally { setGuardando(false) }
    }

    // ── Cargar producto en el formulario de edición ──
    // Se usa desde la grilla de la pestaña Editar y al volver a ella con un
    // producto abierto (refresca el stock de las variaciones tras un restock).
    function cargarProductoEdicion(prod: Producto) {
        // Si hay cambios de variación sin guardar y cambiamos de producto, advertir.
        const pendientes = Object.keys(pendientesVarRef.current).length
        if (pendientes > 0 && prodEditar && prod.producto !== prodEditar &&
            !confirm(`Tienes ${pendientes} variación(es) con cambios sin guardar. Se descartarán al cambiar de producto.`)) {
            return
        }
        pendientesVarRef.current = {}
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
        })
        // Reset de los sub-hooks de variaciones y recetas para el nuevo producto
        resetEstadoVariaciones(prod)
        resetEstadoRecetas(prod)
        // Cargar todas las fotos del producto (principal + extras) en editFotos.
        // La principal vive en productos.imagen y (plan Plus) también en
        // producto_imagenes con orden 1: se deduplican por URL y se prefiere
        // la versión con id (la fila de la galería) para que el reordenamiento
        // la trate como una foto normal y no la pise con una URL vieja.
        const fotos: FotoGaleria[] = []
        api.getImagenesProducto(prod.producto)
            .then(extras => {
                const tienePrincipal = !!(prod.imagen && prod.imagen !== "No hay foto")
                const filaPrincipal = tienePrincipal
                    ? extras.find(e => e.url === prod.imagen)
                    : undefined
                if (tienePrincipal) {
                    if (filaPrincipal) {
                        fotos.push({ url: prod.imagen, id: filaPrincipal.id, orden: 1 })
                    } else {
                        fotos.push({ url: prod.imagen, orden: 1 })
                    }
                }
                for (const e of extras) {
                    if (tienePrincipal && e.url === prod.imagen) continue // ya agregada como principal
                    fotos.push({ url: e.url, id: e.id, orden: e.orden })
                }
                // Ordenar según el orden del backend (la principal primero)
                fotos.sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99))
                setEditFotos(fotos)
            })
            .catch(() => {
                if (prod.imagen && prod.imagen !== "No hay foto") {
                    setEditFotos([{ url: prod.imagen, orden: 1 }])
                } else {
                    setEditFotos([])
                }
            })
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

    return {
        // Alta de producto
        form, setForm,
        nuevasVariaciones, setNuevasVariaciones,
        altaConVariaciones, setAltaConVariaciones,
        nuevosMateriales, setNuevosMateriales,
        nuevasFotos, setNuevasFotos,
        nuevaCategoria, setNuevaCategoria,
        agregarCategoria,
        guardarNuevo,
        guardando,
        // Restock
        guardarRestock,
        // Edición de producto
        editProdNombre, setEditProdNombre,
        editProdVal, setEditProdVal,
        editFotos, setEditFotos,
        guardarProducto,
        cargarProductoEdicion,
        // Lotes en edición
        loteEditandoId, setLoteEditandoId,
        editLoteVal, setEditLoteVal,
        loteEliminarConfirm, setLoteEliminarConfirm,
        guardarLoteIndividual,
        eliminarLoteHandler,
        // Gestión de categorías
        nuevaCatNombre, setNuevaCatNombre,
        catEditandoId, setCatEditandoId,
        catEditandoNombre, setCatEditandoNombre,
        confirmEliminarCat, setConfirmEliminarCat,
        guardarNuevaCategoria,
        iniciarEditarCategoria,
        guardarEditarCategoria,
        cancelarEditarCategoria,
        confirmarEliminarCategoria,
    }
}
