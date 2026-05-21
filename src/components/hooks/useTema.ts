// hooks/useTema.ts
import { useState, useEffect } from 'react';

const TEMAS_DISPONIBLES = ['strawberry', 'cozy-yellow', 'slate-professional', 'midnight-slate'];

export function useTema() {
    const [tema, setTema] = useState<string>(() => {
        // Lee localStorage en el estado inicial — sin useEffect, sin delay
        if (typeof window !== 'undefined') {
            return localStorage.getItem('tema') || 'strawberry';
        }
        return 'strawberry';
    });

    const cambiarTema = (nuevoTema: string) => {
        setTema(nuevoTema);
        localStorage.setItem('tema', nuevoTema);
        document.documentElement.setAttribute('data-theme', nuevoTema);
    };

    useEffect(() => {
        // Solo sincroniza el atributo por si acaso, no causa flash
        document.documentElement.setAttribute('data-theme', tema);
    }, [tema]);

    return { tema, cambiarTema, temas: TEMAS_DISPONIBLES };
}