import type { ReactNode } from "react";

export function Boton({children,onClick,sm,disabled,full,color="#F5A800",className=""}:any){
  const hexadecimal = color.replace("#", "").slice(0,6);
  const rgb = hexadecimal.length===6 ? [0,2,4].map(i=>parseInt(hexadecimal.slice(i,i+2),16)/255) : [0,0,0];
  const luminancia = rgb.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
  return <button type="button" onClick={onClick} disabled={disabled} className={`ui-button ${sm?"ui-button-small":""} ${full?"ui-button-full":""} ${className}`} style={{background:color,color:luminancia>.179?"#111827":"#fff"}}>{children}</button>;
}

export function Tarjeta({title,children,accent}: {title?:string; children:ReactNode; accent?:boolean}){
  return <section className={`ui-card${accent?" ui-card-accent":""}`}>
    {title&&<div className="ui-card-heading"><h2>{title}</h2></div>}
    <div className="ui-card-body">{children}</div>
  </section>;
}

export function Campo({label,value,onChange,...rest}:any){
  return <label className="ui-field"><span>{label}</span><input value={value} onChange={onChange} {...rest}/></label>;
}

export function TituloPagina({etiqueta,titulo,descripcion}: {etiqueta:string; titulo:ReactNode; descripcion:string}){
  return <div className="page-heading"><p className="eyebrow">{etiqueta}</p><h1>{titulo}</h1><p>{descripcion}</p></div>;
}
