import React from 'react';

const asset = (path) => `${import.meta.env.BASE_URL}${path}`;

// The header uses the logo's own lettering (cup, EMPOWERING, BREW in one row) so it matches the printed logo.
export const Brand = () => <div className="brand"><img className="brand-lockup" src={asset('brand/header-lockup.png')} alt="Empowering Brew" /></div>;
export const LogoFull = ({ className = '' }) => <img className={className} src={asset('brand/empowering-brew-logo.png')} alt="Empowering Brew" />;

export const CONTACT_EMAIL = 'jennifer.burnes@usd497.org';
export const Credit = () => <p className="credit">Created by Jennifer Burnes. Questions or problems? Reach out: <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Empowering Brew app')}`}>{CONTACT_EMAIL}</a></p>;

export const todayLabel = () => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
export const timeLabel = (iso) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
export const dayLabel = (date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
export const oneLine = (name) => name.replace(/\n/g, ' ');
export const prettyTemperature = (value) => value === 'hot' ? 'Hot' : value === 'iced' ? 'Iced' : 'No temperature';

export const menuItemFor = (state, product) => state.menuItems.find((entry) => entry.id === product.menuItemId);
export const productName = (state, product) => oneLine(menuItemFor(state, product)?.name || product.sourceName);
export const productLabel = (state, product) => `${productName(state, product)}${product.temperature === 'none' ? '' : ` · ${prettyTemperature(product.temperature)}`}`;

export function Modal({ title, children, onClose, wide = false }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>
      {children}
    </section>
  </div>;
}

export function SectionHeading({ title, description, action }) {
  return <div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div>{action && <div className="heading-actions">{action}</div>}</div>;
}
