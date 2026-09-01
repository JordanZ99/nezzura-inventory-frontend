import type { Dispatch, SetStateAction } from "react"
import type { FotoGaleria } from "@/components/ui/GaleriaProducto"
import type { Lote, MaterialReceta, Producto, Variacion } from "@/types"
import type { FormEditProd, FormEditLote } from "@/hooks/useInventarioForm"
import FormEditarInfo from "./form-editar/FormEditarInfo"
import FormEditarVariaciones from "./form-editar/FormEditarVariaciones"
import FormEditarRecetas from "./form-editar/FormEditarRecetas"
import FormEditarLotes from "./form-editar/FormEditarLotes"

export interface FormEditarProps {
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
    onCrearPost: () => void
}

/** Formulario modular de edición de producto (info + variaciones + recetas + lotes). */
export default function FormEditar({
    prodEditar,
    onVolver,
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
    editVariaciones,
    guardandoVar,
    registrarCambioVariacion,
    eliminarVariacionItem,
    solicitarFotoVariacion,
    quitarFotoVariacionItem,
    ajustarStockVariacion,
    nuevaVarNombre,
    setNuevaVarNombre,
    nuevaVarPrecio,
    setNuevaVarPrecio,
    nuevaVarStock,
    setNuevaVarStock,
    agregarVariacion,
    lotes,
    matVariacionSel,
    setMatVariacionSel,
    editRecetas,
    guardandoReceta,
    editarMaterialItem,
    eliminarMaterialItem,
    matBuscador,
    setMatBuscador,
    matSeleccionado,
    setMatSeleccionado,
    matCantidad,
    setMatCantidad,
    matSugerencias,
    agregarMaterialItem,
    loteEditandoId,
    setLoteEditandoId,
    editLoteVal,
    setEditLoteVal,
    loteEliminarConfirm,
    setLoteEliminarConfirm,
    guardarLoteIndividual,
    eliminarLoteHandler,
    onCrearPost,
}: FormEditarProps) {
    return (
        <>
            {/* ── Card 1: Información del producto ── */}
            <FormEditarInfo
                prodEditar={prodEditar}
                onVolver={onVolver}
                onCrearPost={onCrearPost}
                editProdNombre={editProdNombre}
                setEditProdNombre={setEditProdNombre}
                editProdVal={editProdVal}
                setEditProdVal={setEditProdVal}
                categoriasExistentes={categoriasExistentes}
                editFotos={editFotos}
                setEditFotos={setEditFotos}
                guardando={guardando}
                planLocked={planLocked}
                relacionImagen={relacionImagen}
                guardarProducto={guardarProducto}
            />

            {/* ── Card 2: Variaciones (aplica a cualquier tipo de producto) ── */}
            <FormEditarVariaciones
                tipoProducto={editProdVal.tipo_producto}
                editVariaciones={editVariaciones}
                guardando={guardando}
                guardandoVar={guardandoVar}
                registrarCambioVariacion={registrarCambioVariacion}
                eliminarVariacionItem={eliminarVariacionItem}
                solicitarFotoVariacion={solicitarFotoVariacion}
                quitarFotoVariacionItem={quitarFotoVariacionItem}
                ajustarStockVariacion={ajustarStockVariacion}
                nuevaVarNombre={nuevaVarNombre}
                setNuevaVarNombre={setNuevaVarNombre}
                nuevaVarPrecio={nuevaVarPrecio}
                setNuevaVarPrecio={setNuevaVarPrecio}
                nuevaVarStock={nuevaVarStock}
                setNuevaVarStock={setNuevaVarStock}
                agregarVariacion={agregarVariacion}
            />

            {/* ── Card 3: Materiales de la receta (solo compuestos) ── */}
            {editProdVal.tipo_producto === "compuesto" && (
                <FormEditarRecetas
                    prodEditar={prodEditar}
                    editVariaciones={editVariaciones}
                    editRecetas={editRecetas}
                    matVariacionSel={matVariacionSel}
                    setMatVariacionSel={setMatVariacionSel}
                    guardandoReceta={guardandoReceta}
                    editarMaterialItem={editarMaterialItem}
                    eliminarMaterialItem={eliminarMaterialItem}
                    matBuscador={matBuscador}
                    setMatBuscador={setMatBuscador}
                    matSeleccionado={matSeleccionado}
                    setMatSeleccionado={setMatSeleccionado}
                    matCantidad={matCantidad}
                    setMatCantidad={setMatCantidad}
                    matSugerencias={matSugerencias}
                    agregarMaterialItem={agregarMaterialItem}
                />
            )}

            {/* ── Card 4: Editar lotes individuales (solo productos con stock) ── */}
            <FormEditarLotes
                prodEditar={prodEditar}
                tipoProducto={editProdVal.tipo_producto}
                lotes={lotes}
                editVariaciones={editVariaciones}
                guardando={guardando}
                loteEditandoId={loteEditandoId}
                setLoteEditandoId={setLoteEditandoId}
                editLoteVal={editLoteVal}
                setEditLoteVal={setEditLoteVal}
                loteEliminarConfirm={loteEliminarConfirm}
                setLoteEliminarConfirm={setLoteEliminarConfirm}
                guardarLoteIndividual={guardarLoteIndividual}
                eliminarLoteHandler={eliminarLoteHandler}
            />
        </>
    )
}
