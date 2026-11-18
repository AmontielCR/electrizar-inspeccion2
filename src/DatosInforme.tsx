import {useState} from "react";
import {Boton,Campo} from "./Interfaz";
import {Icono} from "./PanelTrabajos";
import {useAutoguardadoFicha} from "./FichaLocal";

export const tituloDelInforme=(informe:any)=>informe.tituloInforme||informe.tituloCorto||({
  inspeccion:"Informe de Inspección Eléctrica",verificacion:"Informe de Verificación Eléctrica",ac:"Informe de Mantenimiento de Aires Acondicionados",generador:"Mantenimiento de generador",incendio:"Mantenimiento de Sistemas Contra Incendio",
} as Record<string,string>)[informe.tipo]||"Informe técnico";

export function DatosInforme({informe,datos,registro,onSave,onClose}:any){
  const [codigo,setCodigo]=useState(datos?.codigo??informe.codigo??"");
  const [titulo,setTitulo]=useState(datos?.tituloInforme??tituloDelInforme(informe));
  const [guardando,setGuardando]=useState(false),[error,setError]=useState("");
  const {estado,esperarGuardado}=useAutoguardadoFicha(registro,{codigo,tituloInforme:titulo});
  const guardar=async()=>{
    if(guardando)return;
    if(!codigo.trim()||!titulo.trim()){setError("Completa el código y el título del informe.");return;}
    setGuardando(true);setError("");
    try{await esperarGuardado();if(!await onSave({codigo:codigo.trim(),tituloInforme:titulo.trim()}))setError("No se pudieron guardar los cambios. Mantén esta ventana abierta y vuelve a intentar.");}
    catch{setError("No se pudieron guardar los cambios. Vuelve a intentar.");}
    finally{setGuardando(false);}
  };
  return <div className="app-dialog fixed inset-0 bg-black/70 z-40 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4"><div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col" style={{maxHeight:"93vh"}}>
    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0"><button aria-label="Cerrar datos del informe" onClick={onClose} disabled={guardando}><Icono nombre="cerrar"/></button><span className="font-bold text-sm">Datos del informe</span><Boton sm disabled={guardando} onClick={guardar}>{guardando?"Guardando…":"Guardar"}</Boton></div>
    <div className="overflow-y-auto p-4 space-y-4 pb-6"><p className="text-sm text-gray-600">Puedes cambiar estos datos incluso después de completar el informe. Genera nuevamente los documentos para obtener la versión actualizada.</p>
      <Campo label="Código del informe *" value={codigo} onChange={(e:any)=>setCodigo(e.target.value)} disabled={guardando}/>
      <Campo label="Título del informe *" value={titulo} onChange={(e:any)=>setTitulo(e.target.value)} disabled={guardando}/>
      {estado&&<p role="status" className="text-xs text-gray-600">{estado}</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    </div></div></div>;
}
