import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { Bytes } from 'firebase/firestore';
export function almacenSimulado() {
  const documentos = new Map();
  const sdk = {
    Bytes,
    doc: (...partes) => partes.filter(parte => typeof parte === 'string').join('/'),
    collection:(...partes)=>partes.filter(p=>typeof p==='string').join('/'),
    where:(campo,operador,valor)=>({campo,operador,valor}),
    query:(ref,...filtros)=>({ref,filtros}),
    getDoc:async ref=>({exists:()=>documentos.has(ref),data:()=>documentos.get(ref)}),
    orderBy:(campo,orden='asc')=>({orden,campo}),
    documentId:()=>'__name__',
    limit:cantidad=>({cantidad}),
    startAfter:(...cursor)=>({cursor}),
    getDocs:async({ref,filtros})=>{
      let rows=[...documentos].filter(([k,v])=>k.startsWith(ref+'/')&&!k.slice(ref.length+1).includes('/')&&filtros.filter(f=>f.operador).every(f=>f.operador==='=='?v[f.campo]===f.valor:f.operador==='>='?v[f.campo]>=f.valor:v[f.campo]<=f.valor));
      const ordenes=filtros.filter(f=>f.orden);
      rows.sort((a,b)=>{for(const f of ordenes){const x=f.campo==='__name__'?a[0].split('/').at(-1):a[1][f.campo],y=f.campo==='__name__'?b[0].split('/').at(-1):b[1][f.campo];const c=x<y?-1:x>y?1:0;if(c)return f.orden==='desc'?-c:c;}return 0;});
      const cursor=filtros.find(f=>f.cursor)?.cursor;
      if(cursor){const indice=rows.findIndex(([k,v])=>v.codigo===cursor[0]&&k.split('/').at(-1)===cursor[1]);rows=rows.slice(indice+1);}
      const cantidad=filtros.find(f=>f.cantidad)?.cantidad;
      if(cantidad)rows=rows.slice(0,cantidad);
      return {docs:rows.map(([k,v])=>({id:k.split('/').at(-1),data:()=>v}))};
    },
    serverTimestamp: () => ({ seconds: 1, nanoseconds: 0 }),
    runTransaction: async (_db, operar) => {
      for(let intento=0;intento<10;intento++){
      const operaciones = [];
      const leidas=new Map();
      const resultado = await operar({
        get: async referencia => {const valor=documentos.get(referencia);leidas.set(referencia,valor);return {exists:()=>valor!==undefined,data:()=>valor};},
        set: (referencia, datos) => operaciones.push(() => documentos.set(referencia, datos)),
        delete: referencia => operaciones.push(() => documentos.delete(referencia)),
      });
      if([...leidas].some(([ref,valor])=>documentos.get(ref)!==valor))continue;
      operaciones.forEach(ejecutar => ejecutar());
      return resultado;
      }
      throw new Error('Demasiadas colisiones simuladas');
    },
  };
  const fuente = readFileSync(new URL('../src/almacenRemoto.ts', import.meta.url), 'utf8');
  const javascript = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exportaciones = {};
  const require = createRequire(import.meta.url);
  const colaboracion={};
  const codigo=ts.transpileModule(readFileSync(new URL('../src/colaboracion.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  new Function('exports',codigo)(colaboracion);
  new Function('require', 'exports', javascript)(nombre => nombre === 'firebase/firestore' ? sdk : nombre==='./colaboracion.ts'?colaboracion:require(nombre), exportaciones);
  return { documentos, sdk, ...exportaciones };
}
