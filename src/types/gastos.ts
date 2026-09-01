export interface Gasto {
    id: number;
    fecha: string;
    categoria: string;
    descripcion: string;
    monto: number;
    estado?: string;
    gasto_programado_id?: string;
}

export interface GastoProgramado {
    id: string;
    tenant_id: string;
    nombre: string;
    tipo: string;          // "fijo" | "porcentaje"
    valor: number;
    frecuencia: string;    // "semanal" | "mensual" | "anual"
    proxima_fecha: string;
    created_at?: string;
    ultimo_monto?: number | null;  // monto del último gasto generado por esta regla
}
