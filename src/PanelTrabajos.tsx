const SERVICIOS = [
  { id: "incendio", titulo: "Mantenimiento de Sistemas Contra Incendio", descripcion: "Registra evidencias del mantenimiento de alarmas, bombas y sistemas de supresión.", detalle: "Alarma · Bomba · Supresión", icono: "incendio", color: "naranja" },
  { id: "verificacion", titulo: "Verificación Eléctrica", descripcion: "Evalúa la instalación y documenta hallazgos, resultados y plazos de mejora.", detalle: "Aprobada · Condicionada · Rechazada", icono: "check", color: "ambar" },
  { id: "inspeccion", titulo: "Inspección Eléctrica", descripcion: "Registra las condiciones de seguridad y las observaciones de la instalación.", detalle: "Aprobada · No aprobada", icono: "rayo", color: "violeta" },
  { id: "ac", titulo: "Mantenimiento de Aires", descripcion: "Documenta el mantenimiento de cada equipo con su registro fotográfico.", detalle: "Preventivo · Correctivo", icono: "aire", color: "azul" },
  { id: "operacion", titulo: "Operación de sitios", descripcion: "Completa las actividades y mediciones requeridas para cada sitio.", detalle: "El Esfuerzo · Orokay II · EBAR Las Anas", icono: "agua", color: "verde" },
  { id: "generador", titulo: "Mantenimiento de generadores", descripcion: "Sigue el plan de trabajo y registra pruebas, mediciones y evidencias.", detalle: "Plan Inspección · Plan Energía", icono: "generador", color: "naranja" },
];

export function Icono({ nombre, className = "" }: { nombre: string; className?: string }) {
  const trazos: Record<string, React.ReactNode> = {
    incendio: <><path d="M12 2c2 4 0 5 3 8l2-3c3 4 4 7 2 11a8 8 0 0 1-14-1c-2-5 2-9 7-15Z"/><path d="M12 12c-4 4-4 7 0 9 4-2 4-5 0-9Z"/></>,
    alarma: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4M3 6l2-2m14 0 2 2M12 2v2"/></>,
    check: <><path d="m9 11 2 2 4-4"/><path d="M9 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-3"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M8 17h8"/></>,
    rayo: <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>,
    aire: <><path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3"/></>,
    agua: <><path d="M12 2c-2 4-7 8-7 13a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/></>,
    generador: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M7 20v2m10-2v2M6 11h5m-5 4h5m6-4-2 3h3l-2 3"/></>,
    informes: <><path d="M14 2H5v20h14V7l-5-5Z"/><path d="M14 2v5h5M8 12h8m-8 4h8"/></>,
    flecha: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    camara: <><path d="M8 5 9 3h6l1 2h4v15H4V5Z"/><circle cx="12" cy="12" r="4"/></>,
    foto: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></>,
    editar: <><path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/></>,
    eliminar: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></>,
    guardar: <><path d="M4 3h13l4 4v14H3V3h1Zm3 0v6h10V3M7 21v-8h10v8"/></>,
    listo: <path d="m5 12 4 4L19 6"/>,
    cerrar: <path d="m6 6 12 12M6 18 18 6"/>,
    calendario: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/></>,
    buscar: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    copiar: <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
    imprimir: <><path d="M7 7V2h10v5M7 17H3V7h18v10h-4M7 14h10v8H7zM17 10h1"/></>,
    compartir: <><path d="M12 16V2m-5 5 5-5 5 5M7 11H3v11h18V11h-4"/></>,
    conectar: <><path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0"/><circle cx="12" cy="20" r="1"/></>,
    alerta: <><path d="m12 2 10 19H2L12 2ZM12 8v5m0 4v.2"/></>,
    reloj: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>,
    firma: <><path d="M3 21h18M4 16l4-1L20 3l-3-2L5 13l-1 3Zm8-8 3 3"/></>,
    archivo: <><path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M10 10h2m-2 3h2m-2 3h2m-2 3h2"/></>,
  };
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{trazos[nombre] || trazos.informes}</svg>;
}

export function PanelTrabajos({ onSelect, usuario, onLogout, marca }: any) {
  return <div className="workspace-shell">
    <header className="workspace-header"><div className="workspace-header-inner">
      {marca}
      <div className="workspace-account"><span className="account-avatar" aria-hidden="true">{(usuario.nombre || "E").slice(0, 1).toUpperCase()}</span><div><span className="account-name">{usuario.nombre}</span><button onClick={onLogout} className="account-logout">Cerrar sesión</button></div></div>
    </div></header>
    <main className="workspace-main">
      <div className="workspace-intro"><div><p className="eyebrow">CENTRO DE TRABAJO</p><h1>Todo listo para tu próxima visita.</h1><p className="intro-description">Selecciona el trabajo y comienza a documentar cada detalle.</p></div><span className="workspace-label">Informes técnicos</span></div>
      <div className="section-heading"><h2>¿Qué vas a realizar?</h2><span>{SERVICIOS.length} tipos de trabajo</span></div>
      <div className="service-grid">{SERVICIOS.map(servicio => <button key={servicio.id} className={`service-card service-${servicio.color}`} onClick={() => onSelect(servicio.id)}>
        <div className="service-card-top"><span className="service-icon"><Icono nombre={servicio.icono}/></span><Icono nombre="flecha" className="service-arrow"/></div>
        <h3>{servicio.titulo}</h3><p>{servicio.descripcion}</p><span className="service-detail">{servicio.detalle}</span>
      </button>)}
      <button className="service-card history-card" onClick={() => onSelect("home")}><div className="service-card-top"><span className="service-icon"><Icono nombre="informes"/></span><Icono nombre="flecha" className="service-arrow"/></div><h3>Ver informes existentes</h3><p>Retoma un borrador o consulta tus informes y sus documentos.</p><span className="service-detail">Abrir historial de informes</span></button></div>
      <footer className="workspace-footer"><span>Electrizar · Constructora Electromecánica</span><span>Inspeccionar. Documentar. Resolver.</span></footer>
    </main>
  </div>;
}
