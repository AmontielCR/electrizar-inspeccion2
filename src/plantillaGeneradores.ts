export type TareaGenerador = {
  titulo: string;
  indicacion?: string;
  unidad?: string;
  opciones?: readonly string[];
};

export const planesGenerador = {
  inspeccion: "Plan Inspección",
  energia: "Plan Energía",
} as const;

export type PlanGenerador = keyof typeof planesGenerador;

const estadoInicial: TareaGenerador = {
  titulo: "Estado inicial del generador",
  indicacion: "Registra la condición visual, el modo del controlador y las alarmas observadas.",
};
const bateria: TareaGenerador = {
  titulo: "Batería y cargador",
  indicacion: "Indica el resultado de la prueba de batería, la lectura si está disponible y el estado del cargador.",
};
const combustible: TareaGenerador = {
  titulo: "Nivel y sistema de combustible",
  indicacion: "Anota el nivel, el estado del medidor y la condición del tapón.",
};
const refrigeracion: TareaGenerador = {
  titulo: "Refrigerante, radiador y tapón",
  indicacion: "Registra el nivel de refrigerante y la condición del radiador y de su tapón.",
};
const limpieza: TareaGenerador[] = [
  { titulo: "Limpieza interna del generador" },
  { titulo: "Limpieza externa del generador" },
];
const modoFinal: TareaGenerador = {
  titulo: "Modo final del equipo",
  opciones: ["Automático", "Manual", "Fuera de servicio", "Otro"],
  indicacion: "Indica la condición en que quedó el equipo y cualquier restricción de operación.",
};

export const tareasGenerador: Record<PlanGenerador, TareaGenerador[]> = {
  inspeccion: [
    estadoInicial,
    bateria,
    combustible,
    refrigeracion,
    { titulo: "Nivel de aceite", indicacion: "Anota el nivel observado." },
    { titulo: "Fijaciones y torque estructural", indicacion: "Indica qué fijaciones se revisaron y su condición." },
    ...limpieza,
    { titulo: "Arranque controlado", indicacion: "Registra el resultado de la prueba y cualquier alarma." },
    modoFinal,
  ],
  energia: [
    estadoInicial,
    { titulo: "Cambio de filtros", indicacion: "Identifica los filtros sustituidos, por ejemplo aceite y diésel, e indica las referencias disponibles." },
    { titulo: "Cambio y nivel final de aceite", indicacion: "Registra el aceite utilizado, su viscosidad y el nivel final." },
    combustible,
    refrigeracion,
    { titulo: "Filtro de aire y faja", indicacion: "Registra el estado de cada componente y si fue limpiado o sustituido." },
    { titulo: "Medición de voltaje", indicacion: "Anota las lecturas en V e identifica los bornes o fases de cada medición." },
    bateria,
    ...limpieza,
    { titulo: "Prueba de funcionamiento", unidad: "min", indicacion: "Registra la duración real y el resultado de la prueba, incluidas las alarmas observadas." },
    { titulo: "Prueba de transferencia automática", indicacion: "Indica el resultado de la prueba de transferencia y retorno, cuando aplique." },
    { titulo: "Etiquetado de mantenimiento y filtros" },
    modoFinal,
  ],
};
