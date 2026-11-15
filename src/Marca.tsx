const TRAZOS = '<rect x="2" y="2" width="18" height="3"/><rect x="2" y="8.5" width="11" height="3"/><rect x="2" y="15" width="18" height="3"/><polygon points="14,8.5 18,8.5 15,12.5 19,12.5 12,20 13,13.5 9,13.5"/>';
export const SIMBOLO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="15" fill="#F5A800"/><g transform="translate(13 12) scale(1.75)" fill="white">${TRAZOS}</g></svg>`;
export const MARCA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="72" viewBox="0 0 340 72"><rect x="1" y="5" width="62" height="62" rx="15" fill="#F5A800"/><g transform="translate(13 16) scale(1.75)" fill="white">${TRAZOS}</g><text x="80" y="38" font-family="Arial,Helvetica,sans-serif" font-size="29" font-weight="700" letter-spacing="-.8" fill="#111827">Electrizar</text><text x="81" y="57" font-family="Arial,Helvetica,sans-serif" font-size="11" letter-spacing=".9" fill="#785000">CONSTRUCTORA ELECTROMECÁNICA</text></svg>`;
export const simboloURI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SIMBOLO_SVG)}`;
export const marcaURI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(MARCA_SVG)}`;

export function Marca({ sm, white }: { sm?: boolean; white?: boolean }) {
  return <div className={`electrizar-brand${sm ? " brand-small" : ""}${white ? " brand-light" : ""}`} aria-label="Electrizar, Constructora Electromecánica">
    <img src={simboloURI} alt="" className="brand-symbol"/>
    <div className="brand-lockup"><span className="brand-name">Electrizar</span><span className="brand-descriptor">Constructora Electromecánica</span></div>
  </div>;
}
