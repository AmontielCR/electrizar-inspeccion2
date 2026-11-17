import { useState } from "react";
import { Marca } from "./Marca";
import { Icono } from "./PanelTrabajos";
import { Boton, Campo, Tarjeta, TituloPagina } from "./Interfaz";
import { Firma } from "./Firma";
import { useAutoguardadoFicha } from "./FichaLocal";

export const sistemasIncendio: Record<string,{nombre:string;descripcion:string;icono:string}>={
  alarma:{nombre:"Sistemas de Alarma contra Incendio",descripcion:"Evidencias del mantenimiento de los sistemas de detección y alarma.",icono:"alarma"},
  bomba:{nombre:"Bomba contra Incendio",descripcion:"Evidencias del mantenimiento de la bomba y sus componentes.",icono:"agua"},
  supresion:{nombre:"Sistema de Supresión de Incendio",descripcion:"Evidencias del mantenimiento del sistema de supresión.",icono:"incendio"},
};
export type FirmaPersona={nombre:string;fecha:string;firmaUrl:string};
export type FirmasIncendio={tecnico:FirmaPersona;cliente:FirmaPersona};
export const firmasIncendioCompletas=(firmas?:FirmasIncendio)=>!!firmas && [firmas.tecnico,firmas.cliente].every(persona=>
  !!persona?.nombre?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(persona.fecha||"") && /^data:image\/png;base64,/.test(persona.firmaUrl||""));
export const descripcionIncendio=(datos:any)=>[
  sistemasIncendio[datos.sistemaIncendio]?.nombre||"Sistema contra incendio",
  "Fecha de mantenimiento: "+datos.fecha,"Cliente: "+datos.propietario,"Técnico responsable: "+datos.tecnico,
].join(" · ");

export function SelectorIncendio({onSelect,onBack,usuario}:any){
  return <div className="workspace-shell"><header className="workspace-header"><div className="workspace-header-inner"><Marca white/><span className="account-name">{usuario.nombre}</span></div></header>
    <main className="workspace-main"><button onClick={onBack} className="back-link">← Tipos de trabajo</button>
      <TituloPagina etiqueta="MANTENIMIENTO ESPECIALIZADO" titulo="Mantenimiento de Sistemas Contra Incendio" descripcion="Selecciona el sistema para registrar los trabajos, las evidencias y las firmas de cierre."/>
      <div className="service-grid mt-6">{Object.entries(sistemasIncendio).map(([clave,sistema])=><button key={clave} onClick={()=>onSelect(clave)} className="service-card service-naranja"><div className="service-card-top"><span className="service-icon"><Icono nombre={sistema.icono}/></span><Icono nombre="flecha" className="service-arrow"/></div><h3>{sistema.nombre}</h3><p>{sistema.descripcion}</p><span className="service-detail">Fotos · Trabajos realizados · Firmas de cierre</span></button>)}</div>
    </main></div>;
}

export function NuevoIncendio({sistema,onBack,onCreate,usuario,codigoSugerido}:any){
  const [datos,setDatos]=useState({codigo:codigoSugerido||"",fecha:new Date().toLocaleDateString("sv-SE"),propietario:"",direccion:"",tecnico:usuario.nombre||""});
  const [guardando,setGuardando]=useState(false);
  const [error,setError]=useState("");
  const cambiar=(clave:string)=>(e:any)=>setDatos(prev=>({...prev,[clave]:e.target.value}));
  const crear=async(event:React.FormEvent)=>{
    event.preventDefault();if(guardando)return;
    if(!datos.codigo.trim()||!datos.propietario.trim()||!datos.tecnico.trim()||!datos.fecha){setError("Completa código, cliente, fecha y nombre del técnico.");return;}
    setGuardando(true);setError("");
    try{
      const limpios=Object.fromEntries(Object.entries(datos).map(([clave,valor])=>[clave,valor.trim()]));
      const informe={...limpios,id:crypto.randomUUID(),createdAt:Date.now(),tipo:"incendio",sistemaIncendio:sistema,tituloCorto:"Mantenimiento de "+sistemasIncendio[sistema].nombre,elementos:[],resumen:[],resultado:null};
      await onCreate({...informe,descripcion:descripcionIncendio(informe)});
    }catch{setError("No se pudo crear el informe. Vuelve a intentar.");}
    finally{setGuardando(false);}
  };
  return <div className="screen-form min-h-screen"><header className="text-white px-4 py-4 sticky top-0 z-10"><div className="flex items-center gap-3 max-w-lg mx-auto"><button aria-label="Volver a sistemas contra incendio" onClick={onBack}>←</button><Marca sm white/><span>{sistemasIncendio[sistema].nombre}</span></div></header>
    <form onSubmit={crear} className="form-content max-w-2xl mx-auto p-4 space-y-4"><TituloPagina etiqueta="NUEVO INFORME" titulo={sistemasIncendio[sistema].nombre} descripcion="Completa los datos de la visita y del técnico. Después podrás agregar elementos con fotografías del mantenimiento."/>
      <Tarjeta title="Identificación del informe" accent><Campo label="Código del informe *" value={datos.codigo} onChange={cambiar("codigo")} required/><Campo label="Fecha del mantenimiento *" type="date" value={datos.fecha} onChange={cambiar("fecha")} required/></Tarjeta>
      <Tarjeta title="Datos del cliente" accent><Campo label="Cliente / Propietario *" value={datos.propietario} onChange={cambiar("propietario")} required/><Campo label="Dirección / Ubicación" value={datos.direccion} onChange={cambiar("direccion")}/></Tarjeta>
      <Tarjeta title="Técnico responsable" accent><Campo label="Nombre del técnico *" value={datos.tecnico} onChange={cambiar("tecnico")} required autoComplete="name"/><p className="text-sm text-gray-600">Al finalizar se solicitarán la firma del técnico y la de un representante del cliente.</p></Tarjeta>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={guardando} className="ui-button ui-button-full" style={{background:"#F5A800",color:"#111827"}}>{guardando?"Guardando…":"Continuar → Agregar evidencias"}</button>
    </form></div>;
}

export function CierreIncendio({informe,datos,registro,onSave,onClose}:any){
  const hoy=new Date().toLocaleDateString("sv-SE");
  const [firmas,setFirmas]=useState<FirmasIncendio>(datos??informe.firmasIncendio??{
    tecnico:{nombre:informe.tecnico||"",fecha:hoy,firmaUrl:""},cliente:{nombre:"",fecha:hoy,firmaUrl:""},
  });
  const [persona,setPersona]=useState<"tecnico"|"cliente"|null>(null);
  const [guardando,setGuardando]=useState(false);
  const [error,setError]=useState("");
  const {estado,esperarGuardado}=useAutoguardadoFicha(registro,firmas);
  const cambiar=(quien:"tecnico"|"cliente",campo:keyof FirmaPersona,valor:string)=>setFirmas(prev=>({...prev,[quien]:{...prev[quien],[campo]:valor}}));
  const guardar=async()=>{
    if(guardando)return;
    if(!firmasIncendioCompletas(firmas)){setError("Completa nombre, fecha y firma tanto del técnico como del representante del cliente.");return;}
    setError("");setGuardando(true);
    try{await esperarGuardado();if(!await onSave({tecnico:{...firmas.tecnico,nombre:firmas.tecnico.nombre.trim()},cliente:{...firmas.cliente,nombre:firmas.cliente.nombre.trim()}}))setError("No se pudieron guardar las firmas. Mantén esta ventana abierta y vuelve a intentar.");}
    catch{setError("No se pudieron guardar las firmas. Vuelve a intentar.");}
    finally{setGuardando(false);}
  };
  return <div className="app-dialog fixed inset-0 bg-black/70 z-40 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4"><div className="bg-white w-full rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col" style={{maxHeight:"93vh"}}>
    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0"><button aria-label="Cerrar firmas" onClick={onClose} disabled={guardando}><Icono nombre="cerrar"/></button><span className="font-bold text-sm">Firmas de cierre</span><Boton sm disabled={guardando} onClick={guardar}>{guardando?"Guardando…":"Finalizar"}</Boton></div>
    <div className="overflow-y-auto p-4 space-y-5 pb-6"><p className="text-sm text-gray-600">Se requieren las dos firmas para finalizar y generar los documentos del mantenimiento.</p>
      {(["tecnico","cliente"] as const).map(quien=><Tarjeta key={quien} title={quien==="tecnico"?"Técnico responsable":"Representante del cliente"} accent>
        <Campo label="Nombre completo *" value={firmas[quien].nombre} disabled={guardando} onChange={(e:any)=>cambiar(quien,"nombre",e.target.value)} autoComplete="name"/>
        <Campo label="Fecha de la firma *" type="date" value={firmas[quien].fecha} disabled={guardando} onChange={(e:any)=>cambiar(quien,"fecha",e.target.value)}/>
        {firmas[quien].firmaUrl&&<img className="w-full max-h-28 object-contain border rounded-xl bg-white" src={firmas[quien].firmaUrl} alt={quien==="tecnico"?"Firma del técnico":"Firma del cliente"}/>}
        <Boton disabled={guardando} onClick={()=>setPersona(quien)}><Icono className="ui-icon" nombre="firma"/>{firmas[quien].firmaUrl?"Volver a firmar":"Firmar en pantalla"}</Boton>
      </Tarjeta>)}
      {estado&&<p role="status" className="text-xs text-gray-600">{estado}</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    </div></div>
    {persona&&<Firma titulo={persona==="tecnico"?"Firma del técnico":"Firma del cliente"} onClose={()=>setPersona(null)} onConfirm={(url:string)=>{cambiar(persona,"firmaUrl",url);setPersona(null);}}/>}
  </div>;
}
