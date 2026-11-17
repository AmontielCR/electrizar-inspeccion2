type Datos = Record<string, any>;
const igual = (a:any,b:any):boolean => {
  if(a===b)return true;
  if(!a||!b||typeof a!=="object"||typeof b!=="object")return false;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((valor,i)=>igual(valor,b[i]));
  const clavesA=Object.keys(a).filter(k=>a[k]!==undefined).sort(),clavesB=Object.keys(b).filter(k=>b[k]!==undefined).sort();
  return clavesA.length===clavesB.length&&clavesA.every((k,i)=>k===clavesB[i]&&igual(a[k],b[k]));
};
function huella(valor:any){
  const texto=JSON.stringify(valor,(_clave,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)??"";let a=2166136261,b=5381;
  for(let i=0;i<texto.length;i++){a=Math.imul(a^texto.charCodeAt(i),16777619);b=Math.imul(b,33)^texto.charCodeAt(i);}
  return (a>>>0).toString(36)+(b>>>0).toString(36)+texto.length.toString(36);
}
export function identificarElementos(informe:Datos):Datos{
  const copia={...informe};
  for(const clave of ["elementos","equipos"]){
    if(Array.isArray(copia[clave]))copia[clave]=copia[clave].map((el:any,i:number)=>el.id?el:{...el,id:"anterior-"+clave+"-"+huella([el.num??i,el.titulo??el.nombre??"",el.grupo??""])});
  }
  return copia;
}
const limpiar=(informe:Datos)=>Object.fromEntries(Object.entries(informe).filter(([k])=>!["versionRemota","revisionElectrizar","updatedAt","partesElectrizar","cantidadElementos","revisionesAplicadas"].includes(k)));

/** Three-way merge. Different fields and additions combine; conflicting evidence
 * gets a separate visible copy instead of discarding either person's work. */
export function fusionarInformes(base:Datos|undefined,local:Datos,remoto:Datos):Datos{
  const incidencias:Datos[]=[];
  const mezclar=(b:any,l:any,r:any,ruta:string):any=>{
    if(igual(l,r))return r;
    if(base && igual(l,b))return r;
    if(base && igual(r,b))return l;
    if(Array.isArray(l)&&Array.isArray(r)){
      const anteriores=Array.isArray(b)?b:[];
      const clave=(v:any)=>v&&typeof v==="object"?(v.id?"id:"+v.id:v.url?"foto:"+v.url:"dato:"+huella(v)):"valor:"+JSON.stringify(v);
      const bm=new Map(anteriores.map(v=>[clave(v),v])),lm=new Map(l.map(v=>[clave(v),v])),rm=new Map(r.map(v=>[clave(v),v]));
      const claves=Array.from(new Set([...bm.keys(),...rm.keys(),...lm.keys()]));
      const resultado:any[]=[];
      for(const id of claves){
        const bv=bm.get(id),lv=lm.get(id),rv=rm.get(id);
        if(!lm.has(id)&&!rm.has(id))continue;
        if(!lm.has(id)){
          if(base&&bm.has(id)&&igual(rv,bv))continue;
          if(base&&bm.has(id))incidencias.push({id:huella([ruta,id,"eliminado-local"]),campo:ruta,motivo:"Se conservó un elemento modificado mientras otra persona lo eliminaba."});
          resultado.push(rv);continue;
        }
        if(!rm.has(id)){
          if(base&&bm.has(id)&&igual(lv,bv))continue;
          if(base&&bm.has(id))incidencias.push({id:huella([ruta,id,"eliminado-remoto"]),campo:ruta,motivo:"Se conservó un elemento modificado mientras otra persona lo eliminaba."});
          resultado.push(lv);continue;
        }
        // For report elements, keep whole conflicting versions together. This
        // also avoids pairing one person's caption with another person's image.
        if((ruta==="elementos"||ruta==="equipos")&&!igual(lv,rv)&&(!base||(!igual(lv,bv)&&!igual(rv,bv)))){
          const conflictosAntes=incidencias.length;
          const combinado=mezclar(bv,lv,rv,ruta+"."+id);
          resultado.push(combinado);
          if(incidencias.length>conflictosAntes){
            const copia={...lv,id:String(lv.id)+"-recuperada-"+huella(lv),revisionRecuperada:true};
            if(copia.titulo)copia.titulo+=" · Versión conservada para revisar";
            if(copia.nombre)copia.nombre+=" · Versión conservada para revisar";
            if(!resultado.some(el=>el.id===copia.id)&&!r.some(el=>el.id===copia.id))resultado.push(copia);
          }
        }else resultado.push(mezclar(bv,lv,rv,ruta+"."+id));
      }
      return resultado;
    }
    if(l&&r&&typeof l==="object"&&typeof r==="object"&&!Array.isArray(l)&&!Array.isArray(r)){
      const resultado:Datos={};
      for(const k of new Set([...Object.keys(b||{}),...Object.keys(r),...Object.keys(l)])){
        const valor=mezclar(b?.[k],l[k],r[k],ruta?ruta+"."+k:k);
        if(valor!==undefined)resultado[k]=valor;
      }
      return resultado;
    }
    // With no baseline (older local drafts), absence cannot prove deletion.
    if(!base && l===undefined)return r;
    if(!base && r===undefined)return l;
    incidencias.push({id:huella([ruta,l,r]),campo:ruta,valorLocal:l??null,valorRemoto:r??null});
    return r===undefined?l:r;
  };
  const b=base?limpiar(identificarElementos(base)):undefined;
  const l=limpiar(identificarElementos(local)),r=limpiar(identificarElementos(remoto));
  // Logs are combined independently, never recursively used as merge inputs.
  const previas=[...(l.revisionesColaboracion||[]),...(r.revisionesColaboracion||[])];
  delete l.revisionesColaboracion;delete r.revisionesColaboracion;if(b)delete b.revisionesColaboracion;
  const resultado=mezclar(b,l,r,"");
  const todas=new Map([...previas,...incidencias].map(incidencia=>[incidencia.id,incidencia]));
  if(todas.size)resultado.revisionesColaboracion=Array.from(todas.values());
  if(resultado.elementos)resultado.elementos=resultado.elementos.map((el:any,i:number)=>({...el,...(el.num!==undefined?{num:i+1}:{})}));
  if(resultado.equipos)resultado.equipos=resultado.equipos.map((el:any,i:number)=>({...el,num:i+1}));
  return resultado;
}

/** A form may stay open while other devices update the report. Merge its edits
 * against the element as it was when opened, not against its current index. */
export function aplicarEdicion(informe:Datos,coleccion:"elementos"|"equipos",original:Datos|null,modificado:Datos):Datos{
  const actuales=informe[coleccion]||[];
  if(!original)return {...informe,[coleccion]:[...actuales,modificado]};
  const previos=actuales.some((el:any)=>el.id===original.id)?actuales.map((el:any)=>el.id===original.id?original:el):[...actuales,original];
  const editados=previos.map((el:any)=>el.id===original.id?modificado:el);
  return {...fusionarInformes({...informe,[coleccion]:previos},{...informe,[coleccion]:editados},informe),versionRemota:informe.versionRemota};
}

export function integrarPublicacion(pendiente:Datos,vigente:Datos,publicado:Datos){
  const posterior=vigente.revision!==pendiente.revision;
  const informe=posterior?{...fusionarInformes(pendiente.informe,vigente.informe,publicado),versionRemota:publicado.versionRemota}:identificarElementos(publicado);
  return {...vigente,informe,original:posterior?publicado:undefined,base:publicado.versionRemota,pendiente:posterior};
}
