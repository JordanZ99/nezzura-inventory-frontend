import { productosApi } from "./productos"
import { ventasApi } from "./ventas"
import { gastosApi } from "./gastos"
import { catalogoApi } from "./catalogo"
import { turnosApi } from "./turnos"
import { terminalesApi } from "./terminales"
import { statsApi } from "./stats"
import { mesasApi } from "./mesas"

export * from "./client"
export * from "./productos"
export * from "./ventas"
export * from "./gastos"
export * from "./catalogo"
export * from "./turnos"
export * from "./terminales"
export * from "./stats"
export * from "./mesas"

export const api = {
    ...productosApi,
    ...ventasApi,
    ...gastosApi,
    ...catalogoApi,
    ...turnosApi,
    ...terminalesApi,
    ...statsApi,
    ...mesasApi,
}
