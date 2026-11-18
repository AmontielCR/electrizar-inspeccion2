import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** Render one report sheet at a time to bound memory use on phones. Nothing is
 * uploaded: HTML, photographs and signatures stay in the browser. */
export async function crearArchivoPDF(documento:Document,progreso:(pagina:number,total:number)=>void,signal?:AbortSignal):Promise<Blob>{
  const comprobar=()=>{if(signal?.aborted)throw new DOMException("Generación cancelada","AbortError");};
  comprobar();
  await documento.fonts?.ready;
  await Promise.all(Array.from(documento.images).map(imagen=>{
    if(imagen.complete){if(!imagen.naturalWidth)throw new Error("No se pudo cargar una imagen del informe.");return;}
    return new Promise<void>((resolve,reject)=>{
      const fin=()=>{clearTimeout(tiempo);imagen.removeEventListener("load",cargada);imagen.removeEventListener("error",error);};
      const cargada=()=>{fin();resolve();};
      const error=()=>{fin();reject(new Error("No se pudo cargar una imagen del informe."));};
      const tiempo=setTimeout(error,15000);
      imagen.addEventListener("load",cargada,{once:true});imagen.addEventListener("error",error,{once:true});
    });
  }));
  const paginas=Array.from(documento.querySelectorAll<HTMLElement>(".pg"));
  if(!paginas.length)throw new Error("El informe no contiene páginas para generar el PDF.");
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"letter",compress:true});
  pdf.setProperties({title:documento.title||"Informe Electrizar",creator:"Electrizar"});
  for(let i=0;i<paginas.length;i++){
    comprobar();progreso(i+1,paginas.length);
    const pagina=paginas[i],anterior=pagina.style.minHeight;
    pagina.style.minHeight="816px";
    let lienzo:HTMLCanvasElement|undefined;
    try{
      const ancho=Math.ceil(pagina.getBoundingClientRect().width)||1056;
      const alto=Math.max(pagina.scrollHeight,pagina.offsetHeight,816);
      const escala=Math.min(1.5,Math.sqrt(2_400_000/(ancho*alto)),4096/Math.max(ancho,alto));
      lienzo=await html2canvas(pagina,{backgroundColor:"#ffffff",scale:escala,width:ancho,height:alto,windowWidth:1100,windowHeight:Math.max(alto,816),scrollX:0,scrollY:0,logging:false,useCORS:true,removeContainer:true});
      comprobar();
      if(i)pdf.addPage("letter","landscape");
      const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight();
      const factor=Math.min(w/lienzo.width,h/lienzo.height);
      const iw=lienzo.width*factor,ih=lienzo.height*factor;
      pdf.addImage(lienzo.toDataURL("image/jpeg",.94),"JPEG",(w-iw)/2,0,iw,ih,undefined,"FAST");
    }finally{
      pagina.style.minHeight=anterior;
      if(lienzo){lienzo.width=1;lienzo.height=1;}
    }
  }
  comprobar();return pdf.output("blob");
}
