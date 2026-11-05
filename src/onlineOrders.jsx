import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACTIVE_STATUSES, POLL_SECONDS, STATUS_LABELS, callLink, inOrderWindow, linkReady, minutesUntil, orderDetails, orderSaleParts, orderSettings, orderingMenu, saleForOrder, sortOrders } from './orders';
import { Modal, timeLabel } from './ui';
import { PauseIcon, PlayIcon } from './icons';

/* ---------- Sound ---------- */

// Safari only plays sound after someone has tapped the page, so the first tap of the day
// (usually the first sale) turns the chime on.
let audio = null;
function unlockSound() {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* no sound on this browser */ }
}
function chime() {
  if (!audio || audio.state !== 'running') return;
  [[880, 0], [1175, 0.18]].forEach(([frequency, delay]) => {
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audio.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + delay + 0.45);
    tone.connect(gain).connect(audio.destination);
    tone.start(audio.currentTime + delay);
    tone.stop(audio.currentTime + delay + 0.5);
  });
}

/* ---------- Checking the order sheet ---------- */

// Orders are held in memory only; the sheet is the record until a sale is recorded.
export function useOnlineOrders(state, setState) {
  const settings = orderSettings(state);
  const ready = linkReady(settings);
  const [orders, setOrders] = useState([]);
  const [alertIds, setAlertIds] = useState([]);
  const [shop, setShop] = useState(null);
  const [error, setError] = useState('');
  const [lastContact, setLastContact] = useState(null);
  const [inWindow, setInWindow] = useState(() => inOrderWindow());
  const seen = useRef(new Set());
  const published = useRef('');
  const menu = useMemo(() => JSON.stringify(orderingMenu(state)), [state.menuItems, state.products, state.recipes, state.inventory, state.settings?.monthlySpecial]);
  const latest = useRef({});
  latest.current = { settings, menu, sales: state.sales };

  useEffect(() => {
    document.addEventListener('pointerdown', unlockSound);
    return () => document.removeEventListener('pointerdown', unlockSound);
  }, []);
  useEffect(() => { const timer = setInterval(() => setInWindow(inOrderWindow()), 30000); return () => clearInterval(timer); }, []);

  const poll = useCallback(async () => {
    const { settings: link, menu: currentMenu, sales } = latest.current;
    if (!linkReady(link)) return;
    try {
      const sendMenu = published.current !== currentMenu;
      const result = await callLink(link, 'poll', { paused: !!link.paused, ...(sendMenu ? { menu: JSON.parse(currentMenu) } : {}) });
      if (sendMenu) published.current = currentMenu;
      const incoming = result.orders || [];
      const fresh = incoming.filter((order) => order.status === 'new' && !seen.current.has(order.id));
      incoming.forEach((order) => seen.current.add(order.id));
      setOrders(incoming);
      setShop(result.shop || null);
      setAlertIds((current) => [...current.filter((id) => incoming.some((order) => order.id === id && order.status === 'new')), ...fresh.map((order) => order.id)]);
      if (fresh.length) chime();
      setError('');
      setLastContact(new Date().toISOString());
      // A sale recorded while the sheet could not be reached: finish marking it picked up.
      for (const order of incoming) {
        const sale = saleForOrder(sales, order.id);
        if (sale) callLink(link, 'status', { id: order.id, status: 'picked-up', saleId: sale.id }).catch(() => {});
      }
    } catch (problem) {
      setError(problem.message);
    }
  }, []);

  const active = ready && inWindow;
  useEffect(() => {
    if (!active) return undefined;
    poll();
    const timer = setInterval(poll, POLL_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [active, poll, settings.url, settings.key, settings.paused]);

  // Keep chiming while a new order is waiting for someone to look at it.
  useEffect(() => {
    if (!alertIds.length) return undefined;
    const timer = setInterval(chime, 45000);
    return () => clearInterval(timer);
  }, [alertIds.length]);

  const setStatus = useCallback(async (order, status, extra = {}) => {
    setOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, status } : entry).filter((entry) => ACTIVE_STATUSES.includes(entry.status)));
    setAlertIds((current) => current.filter((id) => id !== order.id));
    try {
      await callLink(latest.current.settings, 'status', { id: order.id, status, ...extra });
      setError('');
    } catch (problem) {
      setError(problem.message);
    }
    poll();
  }, [poll]);

  const setPaused = (paused) => setState((current) => ({ ...current, settings: { ...current.settings, onlineOrders: { ...orderSettings(current), paused } } }));
  const visible = ready ? sortOrders(orders.filter((order) => ACTIVE_STATUSES.includes(order.status))) : [];
  return {
    enabled: !!settings.enabled, ready, checking: active, paused: !!settings.paused, orders: visible, shop, error, lastContact,
    alerts: visible.filter((order) => alertIds.includes(order.id)),
    dismissAlerts: () => setAlertIds([]),
    setStatus, setPaused, refresh: poll,
  };
}

/* ---------- Sales screen pieces ---------- */

const pickupText = (order, now) => {
  const minutes = minutesUntil(order.pickupAt, now);
  const at = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(order.pickupAt));
  return minutes > 0 ? `Pickup ${at} (in ${minutes} min)` : minutes === 0 ? `Pickup ${at} (now)` : `Pickup ${at} (${-minutes} min ago)`;
};

export function OrdersButton({ orders, onOpen }) {
  const waiting = orders.orders.length;
  const fresh = orders.orders.filter((order) => order.status === 'new').length;
  return <button className={`staff-button orders-button ${fresh ? 'has-new' : ''}`} onClick={onOpen} aria-label={`Online orders: ${waiting} waiting`}>
    Orders{waiting > 0 && <span className="orders-count">{waiting}</span>}
  </button>;
}

function OrderCard({ order, now, children }) {
  return <article className={`order-card status-${order.status}`}>
    <div className="order-card-main">
      <span className="order-status">{STATUS_LABELS[order.status]}</span>
      <strong className="order-drink">{order.drink}</strong>
      {orderDetails(order).length > 0 && <span className="order-details">{orderDetails(order).join(' · ')}</span>}
      <span className="order-who"><b>{order.name}</b> · {pickupText(order, now)} · ${Number(order.price || 0).toFixed(2)}</span>
    </div>
    <div className="order-card-actions">{children}</div>
  </article>;
}

// Shows up over the sales screen when an order comes in.
export function NewOrderAlert({ orders, onShowAll }) {
  const now = new Date();
  return <Modal title={orders.alerts.length === 1 ? 'New online order' : `${orders.alerts.length} new online orders`} onClose={orders.dismissAlerts} wide>
    <p className="order-alert-intro">Start making it now. The teacher pays when they pick it up.</p>
    <div className="order-list">{orders.alerts.map((order) => <OrderCard key={order.id} order={order} now={now}>
      <button className="button primary" onClick={() => orders.setStatus(order, 'making')}>Start making</button>
    </OrderCard>)}</div>
    <div className="form-actions"><button className="button secondary" onClick={orders.dismissAlerts}>Later</button><button className="button secondary" onClick={onShowAll}>See all orders</button></div>
  </Modal>;
}

// The list of orders waiting, in pickup order. "Paid — record sale" records it like any sale.
export function OrdersPanel({ state, orders, onRecord, onClose }) {
  const [now, setNow] = useState(() => new Date());
  const [confirming, setConfirming] = useState(null);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(timer); }, []);
  const shopLine = !orders.checking ? 'Not checking for orders right now (outside shop hours).'
    : orders.paused ? 'Paused: the order page is not taking new orders.'
      : orders.shop?.open ? 'Taking online orders.' : orders.shop?.reason || 'Checking for orders…';
  return <Modal title="Online orders" onClose={onClose} wide>
    <div className="orders-head">
      <p className={`orders-shop ${orders.paused ? 'paused' : ''}`} role="status">{shopLine}</p>
      <button className={`button ${orders.paused ? 'primary' : 'secondary'}`} onClick={() => orders.setPaused(!orders.paused)}>{orders.paused ? <><PlayIcon size={20} /> Take orders again</> : <><PauseIcon size={20} /> Pause new orders</>}</button>
    </div>
    {orders.error && <p className="form-error" role="alert">{orders.error}</p>}
    {!orders.orders.length ? <p className="orders-empty">No orders waiting.</p>
      : <div className="order-list">{orders.orders.map((order) => {
        const parts = orderSaleParts(state, order);
        const recorded = saleForOrder(state.sales, order.id);
        return <OrderCard key={order.id} order={order} now={now}>
          {recorded ? <span className="order-note">Sale recorded. Updating the order sheet…</span> : <>
            {order.status === 'new' && <button className="button primary" onClick={() => orders.setStatus(order, 'making')}>Start making</button>}
            {order.status === 'making' && <button className="button primary" onClick={() => orders.setStatus(order, 'ready')}>Ready</button>}
            {parts.problem
              ? <><span className="order-note warning-text">{parts.problem} Record it with the drink buttons, then tap Done.</span><button className="button secondary" onClick={() => orders.setStatus(order, 'picked-up')}>Done</button></>
              : <button className="button primary paid-button" onClick={() => onRecord(order, parts)}>Paid — record sale</button>}
            {order.status === 'ready' && <button className="button secondary" onClick={() => setConfirming({ order, status: 'not-picked-up' })}>Not picked up</button>}
            {order.status !== 'ready' && <button className="button secondary" onClick={() => setConfirming({ order, status: 'declined' })}>Can't make it</button>}
          </>}
          {!recorded && parts.dropped?.length > 0 && <span className="order-note warning-text">Not on this iPad anymore, so it won't be recorded: {parts.dropped.join(', ')}</span>}
        </OrderCard>;
      })}</div>}
    <p className="orders-foot">{orders.lastContact ? `Last checked ${timeLabel(orders.lastContact)}.` : ''} New orders show up here within {POLL_SECONDS} seconds.</p>
    {confirming && <Modal title={confirming.status === 'declined' ? "Can't make this order?" : 'Not picked up?'} onClose={() => setConfirming(null)}>
      <p>{confirming.status === 'declined' ? `${confirming.order.name}'s order page will say the shop couldn't make it, so they can stop by instead.` : `This takes ${confirming.order.name}'s order off the list. No sale is recorded.`}</p>
      <div className="form-actions"><button className="button secondary" onClick={() => setConfirming(null)}>Go back</button><button className="button primary" onClick={() => { orders.setStatus(confirming.order, confirming.status); setConfirming(null); }}>{confirming.status === 'declined' ? "Yes, can't make it" : 'Yes, take it off'}</button></div>
    </Modal>}
  </Modal>;
}

// While staff or a counter are on another screen, a banner says an order came in.
export function OrderBanner({ orders, onGo }) {
  if (!orders.alerts.length) return null;
  const first = orders.alerts[0];
  return <div className="order-banner" role="alert">
    <strong>New online order: {first.drink} for {first.name}{orders.alerts.length > 1 ? ` (+${orders.alerts.length - 1} more)` : ''}</strong>
    {onGo && <button className="button primary" onClick={onGo}>Go to sales</button>}
  </div>;
}

/* ---------- Staff setup (Reports tab) ---------- */

export function OnlineOrdersPanel({ state, setState, orders }) {
  const settings = orderSettings(state);
  const [draft, setDraft] = useState({ url: settings.url || '', key: settings.key || '' });
  const [message, setMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const save = (patch) => setState((current) => ({ ...current, settings: { ...current.settings, onlineOrders: { ...orderSettings(current), ...patch } } }));
  const changed = draft.url.trim() !== (settings.url || '') || draft.key.trim() !== (settings.key || '');
  const test = async () => {
    setTesting(true);
    setMessage('');
    try {
      await callLink({ url: draft.url, key: draft.key }, 'test');
      save({ url: draft.url.trim(), key: draft.key.trim() });
      setMessage('Connected to the order sheet. Saved.');
    } catch (problem) {
      setMessage(problem.message);
    }
    setTesting(false);
  };
  return <section className="backup-panel online-orders-panel">
    <div>
      <h3>Online orders</h3>
      <p>Staff order from the school order page; orders pop up on this iPad. Paste the <strong>iPad link</strong> address and key from the Apps Script setup. Only one iPad should take orders.</p>
      {settings.enabled && <p className="storage-status">{orders.error ? orders.error : orders.lastContact ? `Last checked ${timeLabel(orders.lastContact)}.` : orders.checking ? 'Connecting…' : 'Checks for orders during shop hours.'}</p>}
      {message && <p className="backup-message" role="status">{message}</p>}
    </div>
    <div className="online-orders-fields">
      <label>iPad link address<input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://script.google.com/macros/s/…/exec" autoCapitalize="off" autoCorrect="off" spellCheck="false" /></label>
      <label>iPad link key<input value={draft.key} onChange={(event) => setDraft({ ...draft, key: event.target.value })} autoCapitalize="off" autoCorrect="off" spellCheck="false" /></label>
      <div className="backup-actions">
        <button className="button secondary" onClick={test} disabled={testing || !draft.url.trim() || !draft.key.trim()}>{testing ? 'Testing…' : changed ? 'Test and save' : 'Test connection'}</button>
        <label className="check-label"><input type="checkbox" checked={!!settings.enabled} disabled={!settings.url || !settings.key} onChange={(event) => save({ enabled: event.target.checked })} /> Take online orders on this iPad</label>
      </div>
    </div>
  </section>;
}
