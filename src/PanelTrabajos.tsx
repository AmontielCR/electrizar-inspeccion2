const SERVICIOS = [
  { id: "verificacion", titulo: "Verificación Eléctrica", descripcion: "Evalúa la instalación y documenta hallazgos, resultados y plazos de mejora.", detalle: "Aprobada · Condicionada · Rechazada", icono: "check", color: "ambar" },
  { id: "inspeccion", titulo: "Inspección Eléctrica", descripcion: "Registra las condiciones de seguridad y las observaciones de la instalación.", detalle: "Aprobada · No aprobada", icono: "rayo", color: "violeta" },
  { id: "ac", titulo: "Mantenimiento de Aires", descripcion: "Documenta el mantenimiento de cada equipo con su registro fotográfico.", detalle: "Preventivo · Correctivo", icono: "aire", color: "azul" },
  { id: "operacion", titulo: "Operación de sitios", descripcion: "Completa las actividades y mediciones requeridas para cada sitio.", detalle: "El Esfuerzo · Orokay II · EBAR Las Anas", icono: "agua", color: "verde" },
  { id: "generador", titulo: "Mantenimiento de generadores", descripcion: "Sigue el plan de trabajo y registra pruebas, mediciones y evidencias.", detalle: "Plan Inspección · Plan Energía", icono: "generador", color: "naranja" },
];

export function Icono({ nombre, className = "" }: { nombre: string; className?: string }) {
  const trazos: Record<string, React.ReactNode> = {
    check: <><path d="m9 11 2 2 4-4"/><path d="M9 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-3"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M8 17h8"/></>,
    rayo: <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>,
    aire: <><path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3"/></>,
    agua: <><path d="M12 2c-2 4-7 8-7 13a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/></>,
    generador: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M7 20v2m10-2v2M6 11h5m-5 4h5m6-4-2 3h3l-2 3"/></>,
    informes: <><path d="M14 2H5v20h14V7l-5-5Z"/><path d="M14 2v5h5M8 12h8m-8 4h8"/></>,
    flecha: <path d="M5 12h14m-6-6 6 6-6 6"/>,
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
      <div className="section-heading"><h2>¿Qué vas a realizar?</h2><span>5 tipos de trabajo</span></div>
      <div className="service-grid">{SERVICIOS.map(servicio => <button key={servicio.id} className={`service-card service-${servicio.color}`} onClick={() => onSelect(servicio.id)}>
        <div className="service-card-top"><span className="service-icon"><Icono nombre={servicio.icono}/></span><Icono nombre="flecha" className="service-arrow"/></div>
        <h3>{servicio.titulo}</h3><p>{servicio.descripcion}</p><span className="service-detail">{servicio.detalle}</span>
      </button>)}
      <button className="service-card history-card" onClick={() => onSelect("home")}><div className="service-card-top"><span className="service-icon"><Icono nombre="informes"/></span><Icono nombre="flecha" className="service-arrow"/></div><h3>Ver informes existentes</h3><p>Retoma un borrador o consulta tus informes y sus documentos.</p><span className="service-detail">Abrir historial de informes</span></button></div>
      <footer className="workspace-footer"><span>Electrizar · Constructora Electromecánica</span><span>Inspeccionar. Documentar. Resolver.</span></footer>
    </main>
  </div>;
}
