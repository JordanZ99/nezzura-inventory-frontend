// ==============================================================================
// src/components/pos/BotonCarritoFlotante.tsx
// Botón flotante del carrito (móvil): abre el DrawerCarritoMovil.
// ==============================================================================

import Icon from "@/components/ui/Icon"

interface Props {
    totalItems: number
    totalCarrito: number
    onClick: () => void
}

export function BotonCarritoFlotante({ totalItems, totalCarrito, onClick }: Props) {
    return (
        <button className="flex md:hidden btn-primary" style={{
            position: "fixed", bottom: 76, right: 16,
            borderRadius: "50px", gap: 8, zIndex: 150,
            padding: "12px 20px", fontSize: "0.9rem",
            boxShadow: "0 6px 25px var(--primary-glow)",
        }} onClick={onClick}>
            <Icon name="ShoppingCart" size={20} color="var(--white)" /> {totalItems} · ${totalCarrito.toFixed(2)}
        </button>
    )
}
