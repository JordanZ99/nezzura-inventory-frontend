# Por refactorizar

## Centralizar queries de inventario

`usePosDatos.ts` y `useInventarioData.ts` repiten la configuracion de las
queries de productos, lotes y configuracion del catalogo. Podria extraerse un
hook compartido, por ejemplo `useInventarioQueries`, para reducir duplicacion y
evitar que ambos modulos tengan configuraciones distintas en el futuro.

## Centralizar invalidacion de cache

Las mutaciones de inventario llaman a `recargar()` desde varios sub-hooks y
otras mutaciones invalidan categorias o configuracion directamente. Podria
crearse un modulo de comandos o mutation hooks para concentrar las
invalidaciones y hacer mas dificil olvidar una query relacionada.

## Control de concurrencia para ediciones

Cuando se habiliten varios empleados por negocio, conviene agregar al backend
un `updated_at` o numero de version en productos y lotes. Asi una edicion
basada en datos viejos puede rechazarse en lugar de sobrescribir cambios de
otro empleado.

## Migrar Estadisticas y otros modulos

`useEstadisticasDatos.ts` todavia administra sus propias peticiones y estado
local. Si se necesita que Estadisticas comparta exactamente la misma cache de
productos, ventas o gastos, conviene migrarlo a queries de TanStack Query en
una segunda etapa.
