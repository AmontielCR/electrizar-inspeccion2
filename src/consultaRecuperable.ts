type Cancelar = () => void;
type Suscribir<T> = (recibir: (datos: T) => void, fallar: (error: Error) => void) => Cancelar;

export function consultaRecuperable<T>(
  suscribir: Suscribir<T>,
  recibir: (datos: T) => void,
  informarError: (error: Error | null) => void,
  eventos: Pick<Window, "addEventListener" | "removeEventListener">,
) {
  let cancelar: Cancelar | undefined;
  let detenida = false;
  let fallida = false;
  let generacion = 0;

  const reintentar = () => {
    if (detenida) return;
    const actual = ++generacion;
    cancelar?.();
    const errorConsulta = (error: Error) => {
      if (detenida || actual !== generacion) return;
      fallida = true;
      informarError(error);
    };
    try {
      cancelar = suscribir(datos => {
        if (detenida || actual !== generacion) return;
        fallida = false;
        recibir(datos);
        informarError(null);
      }, errorConsulta);
    } catch (error) {
      errorConsulta(error instanceof Error ? error : new Error(String(error)));
    }
  };
  const recuperar = () => { if (fallida) reintentar(); };
  eventos.addEventListener("online", recuperar);
  eventos.addEventListener("focus", recuperar);
  reintentar();

  return {
    reintentar,
    detener() {
      detenida = true;
      generacion++;
      cancelar?.();
      eventos.removeEventListener("online", recuperar);
      eventos.removeEventListener("focus", recuperar);
    },
  };
}
