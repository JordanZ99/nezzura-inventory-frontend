// ==============================================================================
// src/types/mesas.ts
// Mesas del preset restaurante (Fase 2, migración 037). La orden abierta es
// implícita: mesa Ocupada/Cuenta ⇒ tiene items en mesa_items.
// ==============================================================================

// Renglón de la orden abierta (pre-cobro). Se convierte en venta al cobrar.
export interface ItemMesa {
    id: string;
    mesa_id: string;
    producto: string;
    // Texto libre de la venta libre ("Cereal"); null en renglones normales
    descripcion?: string | null;
    variacion?: string | null;
    cantidad: number;
    precio_unitario: number;
    // Solo venta libre; null = el costo lo resuelve PEPS al cobrar
    costo?: number | null;
    notas?: string | null;
    creado_en: string;
}

export interface Mesa {
    id: string;
    nombre: string;
    capacidad?: number | null;
    // Posición en la parrilla (drag & drop)
    orden: number;
    estado: "Libre" | "Ocupada" | "Cuenta";
    // Instante en que se abrió la orden (null = Libre)
    abierta_en?: string | null;
    creada_en: string;
    num_items: number;
    total: number;
    items: ItemMesa[];
}
