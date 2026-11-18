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
  const preparar = document.createElement("button");
  preparar.type="button";preparar.textContent="Cargando documento…";preparar.disabled=true;preparar.className="pdf-print";
  const descargar=document.createElement("a");
  descargar.textContent="Guardar PDF";descargar.className="pdf-print";descargar.hidden=true;
  descargar.target="_blank";descargar.rel="noopener";
  const compartir=document.createElement("button");
  compartir.type="button";compartir.textContent="Compartir PDF";compartir.className="pdf-back";compartir.hidden=true;
  const imprimir = document.createElement("button");
  imprimir.type = "button";
  imprimir.textContent = "Imprimir en PC";
  imprimir.disabled = true;
  imprimir.className = "pdf-back";
  imprimir.hidden=typeof navigator!=="undefined"&&navigator.maxTouchPoints>0;
  barra.append(volver, preparar, descargar, compartir, imprimir);
  const ayuda = document.createElement("p");
  ayuda.className = "pdf-help";
  ayuda.setAttribute("role", "status");
  ayuda.textContent = "Pulsa Crear PDF. Cuando esté listo podrás guardarlo o compartirlo desde este dispositivo.";
  const marco = document.createElement("iframe");
  marco.title = "Documento del informe";
  marco.setAttribute("sandbox", "allow-same-origin allow-modals");
  // Fit the landscape report to a phone while retaining the printable page size.
  marco.srcdoc = html.replace("<head>", '<head><meta name="viewport" content="width=1100"/>');
  let cerrado = false;
  let entradaHistorial = false;
  let urlPDF="";
  let archivo:File|undefined;
  const cancelacion=new AbortController();
  const cerrar = (retroceder: boolean) => {
    if (cerrado) return;
    cerrado = true;
    cancelacion.abort();
    if(urlPDF)URL.revokeObjectURL(urlPDF);
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
  preparar.onclick=async()=>{
    if(preparar.disabled)return;
    preparar.disabled=true;preparar.textContent="Preparando PDF…";
    try{
      const documento=marco.contentDocument;
      if(!documento)throw new Error("No se pudo abrir el contenido del informe.");
      const {crearArchivoPDF}=await import("./pdfArchivo");
      const blob=await crearArchivoPDF(documento,(pagina,total)=>{
        if(!cerrado){preparar.textContent="Página "+pagina+" de "+total;ayuda.textContent="Preparando el archivo PDF. Mantén esta vista abierta.";}
      },cancelacion.signal);
      if(cerrado)return;
      const nombre=(documento.title||"Informe-Electrizar").replace(/[<>:"/\\|?*\u0000-\u001f]/g,"_").replace(/\.pdf$/i,"").slice(0,100)+".pdf";
      archivo=new File([blob],nombre,{type:"application/pdf"});
      urlPDF=URL.createObjectURL(blob);descargar.href=urlPDF;descargar.download=nombre;descargar.hidden=false;preparar.hidden=true;
      let puedeCompartir=false;
      try{puedeCompartir=!!(typeof navigator!=="undefined"&&navigator.canShare?.({files:[archivo]}));}catch{ /* Download remains available when file sharing is unsupported. */ }
      compartir.hidden=!puedeCompartir;
      ayuda.textContent="PDF listo. Pulsa Guardar PDF o Compartir PDF. Para imprimirlo, abre el archivo guardado o usa las opciones de compartir del dispositivo.";
    }catch(error:any){
      if(!cerrado){ayuda.textContent="No se pudo crear el PDF. "+(error?.message||"Vuelve a intentar.");preparar.textContent="Reintentar PDF";preparar.disabled=false;}
    }
  };
  compartir.onclick=async()=>{
    if(!archivo||compartir.disabled)return;
    compartir.disabled=true;
    try{await navigator.share({files:[archivo],title:archivo.name});}
    catch(error:any){if(error?.name!=="AbortError")ayuda.textContent="No se pudo compartir. Usa Guardar PDF y abre el archivo desde tus descargas.";}
    finally{compartir.disabled=false;}
  };
  imprimir.onclick = () => {
    try { marco.contentWindow?.focus(); marco.contentWindow?.print(); }
    catch { ayuda.textContent = "La impresión del navegador no está disponible. Usa Crear PDF y guarda o comparte el archivo."; }
  };
  marco.onload = () => {
    preparar.disabled=false;preparar.textContent="Crear PDF";
    imprimir.disabled = false;
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
