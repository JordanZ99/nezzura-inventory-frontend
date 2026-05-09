import { icons } from 'lucide-react';

interface IconProps {
    name: keyof typeof icons;
    color?: string;
    size?: number;
    className?: string;
}

const Icon = ({ name, color, size = 20, className }: IconProps) => {
    const LucideIcon = icons[name];

    if (!LucideIcon) {
        return null; // Por si escribes mal un nombre
    }

    return <LucideIcon color={color} size={size} className={className} />;
};

export default Icon;