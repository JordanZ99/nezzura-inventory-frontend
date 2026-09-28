// src/hooks/useTema.ts
// ====================
// Hook para gestión y persistencia del tema visual activo.

import { useState, useEffect } from 'react';
import { TEMAS_GESTOR, obtenerTemaGestor } from '@/lib/temas';

export function useTema() {
    const [tema, setTema] = useState<string>(() => obtenerTemaGestor());

    const cambiarTema = (nuevoTema: string) => {
        setTema(nuevoTema);
        localStorage.setItem('tema', nuevoTema);
        document.documentElement.setAttribute('data-theme', nuevoTema);
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', tema);
    }, [tema]);

    return { tema, cambiarTema, temas: TEMAS_GESTOR };
}
