import type { InputHTMLAttributes } from "react"

export default function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>
            <input {...props} className="input-primary" />
        </div>
    )
}
