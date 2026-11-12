import { useEffect, useRef, useState, type ReactNode } from "react";
import { escribirFicha, leerFicha } from "./borradores";

type Registro = { cuenta: string; clave: string };

export function FichaLocal({ cuenta, clave, cerrar, children }: Registro & {
  cerrar: () => void;
  children: (datos: any, registro: Registro) => ReactNode;
}) {
  const [lectura, setLectura] = useState<{ datos?: unknown; error?: boolean }>();
  useEffect(() => {
    let vigente = true;
    leerFicha(cuenta, clave).then(datos => {
      if (vigente) setLectura({ datos });
    }, () => {
      if (vigente) setLectura({ error: true });
    });
    return () => { vigente = false; };
  }, [cuenta, clave]);

  if (lectura && !lectura.error) return children(lectura.datos, { cuenta, clave });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
    <div role="status" className="bg-white p-4 rounded-xl space-y-2">
      <p>{lectura?.error ? "No se pudo recuperar el borrador de la ficha." : "Abriendo ficha…"}</p>
      <button onClick={cerrar} className="font-bold">Volver</button>
    </div>
  </div>;
}

export function useAutoguardadoFicha({ cuenta, clave }: Registro, datos: unknown) {
  const [estado, setEstado] = useState("");
  const anterior = useRef(JSON.stringify(datos));
  const escritura = useRef<Promise<unknown>>(Promise.resolve());
  const serializado = JSON.stringify(datos);
  useEffect(() => {
    if (anterior.current === serializado) return;
    anterior.current = serializado;
    setEstado("Guardando borrador de la ficha…");
    let vigente = true;
    const guardar = () => escribirFicha(cuenta, clave, JSON.parse(serializado));
    const actual = escritura.current.then(guardar, guardar);
    escritura.current = actual;
    void actual.then(() => {
      if (vigente) setEstado("Borrador de la ficha guardado en este dispositivo");
    }, () => {
      if (vigente) setEstado("No se pudo guardar la ficha. Mantén la ficha abierta y vuelve a intentar.");
    });
    return () => { vigente = false; };
  }, [cuenta, clave, serializado]);
  return { estado, esperarGuardado: () => escritura.current.catch(() => {}) };
}
