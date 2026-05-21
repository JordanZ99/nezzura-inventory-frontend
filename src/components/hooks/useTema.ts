// hooks/useTema.ts
// ============
// ESTE HOOK está bien implementado, pero actualmente NO
// está conectado a nada — no se importa en ningún componente. 
// El sistema funciona correctamente sin él gracias al <script> del layout.tsx 
// (que es el enfoque más robusto para evitar el flash de tema incorrecto). 
// Puedes usar useTema en el futuro si necesitas leer el tema activo dentro de un componente de React, 
// pero por ahora no es necesario.

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