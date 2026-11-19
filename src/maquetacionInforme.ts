export const normalizarSaltos=(texto:unknown)=>String(texto??"").replace(/\r\n?/g,"\n");
export const escaparMultilinea=(texto:unknown)=>normalizarSaltos(texto)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")
  .replace(/\n/g,"<br/>");

/** Pack evidence in reading order, at most two per landscape sheet. Reserve
 * more room for long descriptions so paragraphs are never clipped to a box. */
export function agruparEvidencias(elementos:any[],detalle:(el:any)=>string){
  const paginas:{elemento:any;indice:number}[][]=[];
  let actual:{elemento:any;indice:number}[]=[],altoActual=0;
  const lineas=(texto:unknown)=>normalizarSaltos(texto).split("\n").reduce((total,linea)=>total+Math.max(1,Math.ceil(linea.length/82)),0);
  elementos.forEach((elemento,indice)=>{
    const hallazgo=elemento.kind==="hallazgo";
    const bloques=hallazgo?[...(elemento.obs||[]),...(elemento.acc||[])]:[detalle(elemento)];
    const lineasTexto=bloques.reduce((n:number,texto:any)=>n+lineas(texto),0);
    const alto=Math.max(elemento.fotos?.length?220:80,42+lineas(elemento.titulo)*18+lineasTexto*19+(hallazgo?70:0)+(elemento.grupo?32:0));
    if(actual.length&&(actual.length===2||altoActual+alto+20>570)){
      paginas.push(actual);actual=[];altoActual=0;
    }
    actual.push({elemento,indice});altoActual+=alto+(actual.length>1?20:0);
  });
  if(actual.length)paginas.push(actual);
  return paginas;
}
