// ==============================================================================
// src/components/gastos/TabsGastos.tsx
// Barra de tabs Movimientos | Gastos Programados (mismo patrón que Inventario).
// ==============================================================================

import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import type { TabGastos } from "@/hooks/useGastosUI"

const TABS: { id: TabGastos; label: string; icon: string }[] = [
    { id: "movimientos", label: "Movimientos", icon: "ListChecks" },
    { id: "programados", label: "Gastos Programados", icon: "CalendarClock" },
]

interface Props {
    tab: TabGastos
    setTab: Dispatch<SetStateAction<TabGastos>>
}

export default function TabsGastos({ tab, setTab }: Props) {
    return (
        <div className="card" style={{ display: "flex", padding: 6, gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
            {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flex: 1, minWidth: 80, padding: "10px 16px", gap: 8, borderRadius: 10, border: "none",
                    background: tab === t.id ? "var(--gradient-4)" : "transparent",
                    color: tab === t.id ? "#fff" : "var(--text-muted)",
                    fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s",
                }}>
                    <Icon name={t.icon as any} size={22} color={tab === t.id ? "#fff" : "var(--text-muted)"} />
                    {t.label}
                </button>
            ))}
        </div>
    )
}
