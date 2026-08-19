import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

db_url = "postgresql://postgres:txt0812car0@db.edlgdcmxrgrcudyinrck.supabase.co:5432/postgres"
tenant_id = "d7e1e747-1881-43c0-a8bf-f698c0d88be3"

try:
    conn = psycopg2.connect(db_url)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Let's run the exact query from products.py
        cur.execute("""
            SELECT
                p.Producto                                               AS producto,
                p.Descripcion                                            AS descripcion,
                p.Imagen                                                 AS imagen,
                p.Estado                                                 AS estado,
                p.codigo_interno,
                p.codigo_barras,
                p.ubicacion,
                p.visible_en_catalogo                                    AS visible_en_catalogo,
                p.sufijo_precio                                          AS sufijo_precio,
                p.fraccionable                                           AS fraccionable,
                p.tipo_producto                                          AS tipo_producto,
                p.costo_servicio                                         AS costo_servicio,
                p.precio_servicio                                        AS precio_servicio,
                p.post_override                                          AS post_override,
                COALESCE(SUM(l.Stock_Lote), 0)                           AS stock_total
            FROM productos p
            LEFT JOIN lotes l ON l.Producto = p.Producto AND l.Tenant_ID = p.Tenant_ID AND l.Estado = 'Activo'
            WHERE p.Tenant_ID = %s AND p.Estado = 'Activo' AND p.Producto = 'Psyduck peluche'
            GROUP BY p.Producto, p.Descripcion, p.Imagen, p.Estado, p.id, p.codigo_interno, p.codigo_barras, p.ubicacion, p.visible_en_catalogo, p.sufijo_precio, p.fraccionable, p.tipo_producto, p.costo_servicio, p.precio_servicio, p.post_override
        """, (tenant_id,))
        res = cur.fetchall()
        print("SQL RESULT:")
        print(res)
        
except Exception as e:
    print("Error:", e)
