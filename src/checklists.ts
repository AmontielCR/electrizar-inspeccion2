export const tareaCompleta = (el: any) => {
  if (el.estado === "Realizado") {
    if (el.opciones && !el.opciones.includes(el.lectura)) return false;
    if (el.unidad && !/^-?\d+(?:[.,]\d+)?$/.test(el.lectura?.trim() || "")) return false;
    if (el.unidad === "min" && Number(el.lectura.replace(",", ".")) <= 0) return false;
    return !el.indicacion || !!el.desc?.trim();
  }
  return (el.estado === "No realizado" || el.estado === "No aplica") && !!el.desc?.trim();
};

export const crearElementos = (tareas: { titulo: string; unidad?: string; indicacion?: string; opciones?: readonly string[] }[], grupos: string[], checklist = true) =>
  grupos.flatMap(grupo => [
    ...tareas.map(({ titulo, unidad, indicacion, opciones }) => ({
      id: crypto.randomUUID(), kind: "tarea", grupo, titulo, desc: checklist ? "" : titulo,
      fotos: [], obs: [], acc: [],
      ...(indicacion ? { indicacion } : {}),
      ...(opciones ? { opciones } : {}),
      ...(checklist ? { requerido: true, estado: "", lectura: "", unidad: unidad || "" } : {}),
    })),
    {
      id: crypto.randomUUID(), kind: "hallazgo", grupo, titulo: "Hallazgos encontrados", desc: "",
      fotos: [], obs: [""], acc: [""],
    },
  ]);

