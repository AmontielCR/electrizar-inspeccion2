let vistaAbierta: (() => void) | undefined;

/** Keep the mounted report and its draft intact while displaying printable HTML. */
export function abrirVistaPDF(html: string) {
  if (vistaAbierta) { vistaAbierta(); return; }
  const anterior = document.activeElement as HTMLElement | null;
  const app = document.getElementById("root");
  const inerteAnterior = app?.inert ?? false;
  const scrollAnterior = document.body.style.overflow;
  const vista = document.createElement("div");
  vista.className = "pdf-viewer";
  vista.setAttribute("role", "dialog");
  vista.setAttribute("aria-modal", "true");
  vista.setAttribute("aria-label", "Vista previa del informe");
  const barra = document.createElement("div");
  barra.className = "pdf-toolbar";
  const volver = document.createElement("button");
  volver.type = "button";
  volver.textContent = "← Volver al informe";
  volver.className = "pdf-back";
  const imprimir = document.createElement("button");
  imprimir.type = "button";
  imprimir.textContent = "Cargando documento…";
  imprimir.disabled = true;
  imprimir.className = "pdf-print";
  barra.append(volver, imprimir);
  const ayuda = document.createElement("p");
  ayuda.className = "pdf-help";
  ayuda.setAttribute("role", "status");
  ayuda.textContent = "Vista previa. Usa Imprimir / guardar PDF para abrir las opciones del dispositivo.";
  const marco = document.createElement("iframe");
  marco.title = "Documento del informe";
  marco.setAttribute("sandbox", "allow-same-origin allow-modals");
  // Fit the landscape report to a phone while retaining the printable page size.
  marco.srcdoc = html.replace("<head>", '<head><meta name="viewport" content="width=1100"/>');
  let cerrado = false;
  let entradaHistorial = false;
  const cerrar = (retroceder: boolean) => {
    if (cerrado) return;
    cerrado = true;
    window.removeEventListener("popstate", atras);
    window.removeEventListener("keydown", teclado);
    vista.remove();
    if (app) app.inert = inerteAnterior;
    document.body.style.overflow = scrollAnterior;
    vistaAbierta = undefined;
    anterior?.focus();
    if (retroceder && entradaHistorial) window.history.back();
  };
  const atras = () => cerrar(false);
  const teclado = (evento: KeyboardEvent) => {
    if (evento.key === "Escape") cerrar(true);
  };
  volver.onclick = () => cerrar(true);
  imprimir.onclick = () => {
    try { marco.contentWindow?.focus(); marco.contentWindow?.print(); }
    catch { ayuda.textContent = "No se pudo abrir la impresión. Vuelve al informe y vuelve a generar el documento."; }
  };
  marco.onload = () => {
    imprimir.disabled = false;
    imprimir.textContent = "Imprimir / guardar PDF";
  };
  vista.append(barra, ayuda, marco);
  document.body.append(vista);
  document.body.style.overflow = "hidden";
  if (app) app.inert = true;
  try {
    window.history.pushState({ ...window.history.state, electrizarVistaPDF: true }, "");
    entradaHistorial = true;
  } catch { /* The explicit return button also works without history access. */ }
  window.addEventListener("popstate", atras);
  window.addEventListener("keydown", teclado);
  vistaAbierta = () => volver.focus();
  volver.focus();
}
