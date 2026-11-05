import React, { useEffect, useMemo, useState } from 'react';
import { BackIcon, CheckIcon, ClipboardIcon, DownloadIcon, DrinkIcon, HeatIcon, LockIcon, MinusIcon, PlusIcon, SnowIcon, UndoIcon } from './icons';
import { saveState, hashPin, uid } from './storage';
import { changeChoices, currentRecipe } from './estimates';
import { backupDue, dateStamp, salesCsvRows, saveFile, toCsv } from './backup';
import { INVENTORY_CATEGORIES, SPECIAL_MENU_ID } from './data';
import { Brand, Credit, LogoFull, Modal, oneLine, prettyTemperature, productLabel, specialName, todayLabel } from './ui';
import { additionsFor, isDrink as isDrinkIn, makeSale, salesSlots } from './sales';
import { NewOrderAlert, OrderBanner, OrdersButton, OrdersPanel, useOnlineOrders } from './onlineOrders';
import StaffWorkspace from './staff';

export { salesSlots };

function App({ initialState }) {
  const [state, setState] = useState(initialState);
  const [saveFailed, setSaveFailed] = useState(false);
  const [view, setView] = useState('sales');
  const [staffGateOpen, setStaffGateOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [countOrigin, setCountOrigin] = useState('sales');

  useEffect(() => { saveState(state).then((saved) => setSaveFailed(!saved)); }, [state]);
  const orders = useOnlineOrders(state, setState);

  const startCount = (origin) => { setCountOrigin(origin); setView('count'); };

  return <>
    {saveFailed && <p className="save-warning" role="alert">This iPad could not save the latest change. Go to Staff → Reports and tap Full backup now.</p>}
    {view === 'sales' && <SalesScreen state={state} setState={setState} orders={orders} onStaff={() => setStaffGateOpen(true)} onCount={() => startCount('sales')} />}
    {view !== 'sales' && <OrderBanner orders={orders} onGo={view === 'staff' ? () => setView('sales') : null} />}
    {view === 'staff' && <StaffWorkspace state={state} setState={setState} orders={orders} staffName={staffName} onBack={() => setView('sales')} onStartCount={() => startCount('staff')} />}
    {view === 'count' && <CountScreen state={state} setState={setState} countedBy={countOrigin === 'staff' ? staffName : ''} onDone={() => setView(countOrigin)} />}
    {staffGateOpen && <StaffGate pinHash={state.staffPinHash} initialName={staffName} onSaveHash={(staffPinHash) => setState((current) => ({ ...current, staffPinHash }))} onSuccess={(name) => { setStaffName(name); setStaffGateOpen(false); setView('staff'); }} onClose={() => setStaffGateOpen(false)} />}
  </>;
}

function StaffGate({ pinHash, initialName, onSaveHash, onSuccess, onClose }) {
  const [name, setName] = useState(initialName);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const creating = !pinHash;

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) return setError('Enter your name so changes are credited in the activity log.');
    if (!/^\d{4}$/.test(pin)) return setError('Enter exactly four numbers.');
    if (creating && pin !== confirm) return setError('The two PIN entries do not match.');
    const nextHash = await hashPin(pin);
    if (creating) { onSaveHash(nextHash); onSuccess(name.trim()); }
    else if (nextHash === pinHash) onSuccess(name.trim());
    else setError('That PIN is not correct.');
  };

  return <Modal title={creating ? 'Create staff PIN' : 'Staff access'} onClose={onClose}>
    <form onSubmit={submit} className="stack-form">
      <LogoFull className="gate-logo" />
      <div className="modal-intro"><LockIcon size={32} /><p>{creating ? 'Choose a four-number PIN for staff controls on this device.' : 'Enter the staff PIN to manage products, recipes, inventory, and counts.'}</p></div>
      <label>Your name<input autoFocus={!initialName} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
      <label>Four-number PIN<input autoFocus={!!initialName} type="password" inputMode="numeric" pattern="[0-9]*" maxLength="4" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} /></label>
      {creating && <label>Confirm PIN<input type="password" inputMode="numeric" pattern="[0-9]*" maxLength="4" value={confirm} onChange={(event) => setConfirm(event.target.value.replace(/\D/g, ''))} /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary">{creating ? 'Save PIN' : 'Continue'}</button></div>
    </form>
    <Credit />
  </Modal>;
}

function SalesScreen({ state, setState, orders, onStaff, onCount }) {
  const [temperature, setTemperature] = useState('hot');
  const [message, setMessage] = useState('Ready to record a sale');
  const [optionProduct, setOptionProduct] = useState(null);
  const [lastSaleId, setLastSaleId] = useState(null);
  const [decaf, setDecaf] = useState(false);
  const [studentDrink, setStudentDrink] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const due = backupDue(state, now);
  const slots = useMemo(() => salesSlots(state, temperature), [state.menuItems, state.products, temperature]);
  const counts = useMemo(() => Object.fromEntries(['hot', 'iced'].map((temp) => [temp, salesSlots(state, temp).filter((slot) => slot.product?.temperature === temp).length])), [state.menuItems, state.products]);
  const columns = slots.length <= 12 ? 3 : 4;
  const rows = Math.max(4, Math.ceil(slots.length / columns));

  const isDrink = (product) => isDrinkIn(state, product);
  const recordSale = (product, option = null, changes = []) => {
    const madeDecaf = decaf && isDrink(product);
    const free = studentDrink && isDrink(product);
    const sale = makeSale(state, product, option, changes, { decaf: madeDecaf, studentDrink: free });
    setState((current) => ({ ...current, sales: [...current.sales, sale] }));
    setLastSaleId(sale.id);
    if (madeDecaf) setDecaf(false);
    if (free) setStudentDrink(false);
    setMessage(`${[productLabel(state, product), option, ...changes, madeDecaf && 'Decaf', free && 'Student drink ($0)'].filter(Boolean).join(' · ')} recorded`);
  };

  // An online order is paid for at pickup and recorded like any sale, with the order's own
  // flavor, changes and decaf. The Decaf and Student drink toggles are left for the next tapped drink.
  const recordOrder = (order, { product, option, changes, decaf: orderDecaf }) => {
    const sale = makeSale(state, product, option, changes, { decaf: orderDecaf, orderId: order.id });
    setState((current) => ({ ...current, sales: [...current.sales, sale] }));
    setLastSaleId(sale.id);
    setMessage(`Online order for ${order.name}: ${[productLabel(state, product), option, ...changes, orderDecaf && 'Decaf'].filter(Boolean).join(' · ')} recorded`);
    orders.setStatus(order, 'picked-up', { saleId: sale.id });
    setOrdersOpen(false);
  };

  // Every drink opens a picker for flavor and changes; food records in one tap.
  const selectProduct = (product) => {
    if (!isDrink(product)) return recordSale(product);
    const recipe = currentRecipe(state.recipes, product.recipeKey);
    const toppings = !product.options?.includes('No topping'); // plain lattes choose toppings as their option
    const additions = additionsFor(state, product);
    setOptionProduct({ product, choices: (option) => changeChoices(recipe, option, state.inventory, { toppings, additions }) });
  };

  // Undo only reaches the sale just recorded on this screen, and keeps it in the log as voided.
  const undo = () => {
    if (!lastSaleId) return;
    // Undoing an online order's sale puts the order back on the list as ready.
    const orderId = state.sales.find((sale) => sale.id === lastSaleId)?.orderId;
    if (orderId) orders.setStatus({ id: orderId }, 'ready');
    setState((current) => ({ ...current, sales: current.sales.map((sale) => sale.id === lastSaleId ? { ...sale, voidedAt: new Date().toISOString() } : sale) }));
    setLastSaleId(null);
    setMessage('Last sale removed');
  };

  const saveBackup = async () => {
    const savedAt = new Date().toISOString();
    if (!await saveFile(`empowering-brew-sales-${dateStamp()}.csv`, toCsv(salesCsvRows(state.sales)), 'text/csv')) return;
    setState((current) => ({ ...current, settings: { ...current.settings, lastSalesBackupAt: savedAt } }));
    setMessage('Backup saved');
  };

  const pending = [decaf && 'decaf', studentDrink && 'a free student drink ($0)'].filter(Boolean);

  const switchTo = (temp) => { setTemperature(temp); setMessage(`${prettyTemperature(temp)} drinks`); };

  return <main className={`app-shell sales-shell ${temperature}`}>
    <header className="topbar">
      <Brand />
      <time>{todayLabel()}</time>
      <div className="topbar-actions">
        {orders.enabled && <OrdersButton orders={orders} onOpen={() => setOrdersOpen(true)} />}
        {state.settings?.studentCounts && <button className="staff-button" onClick={onCount}><ClipboardIcon size={19} /> Count</button>}
        <button className="staff-button" onClick={onStaff}><LockIcon size={19} /> Staff</button>
      </div>
    </header>
    <section className="sales-content" aria-label="Record a sale">
      <div className="temperature-switch" role="tablist" aria-label="Drink temperature">
        <button role="tab" aria-selected={temperature === 'hot'} className={temperature === 'hot' ? 'selected' : ''} onClick={() => switchTo('hot')}><HeatIcon size={39} /><span>HOT · {counts.hot}</span></button>
        <button role="tab" aria-selected={temperature === 'iced'} className={temperature === 'iced' ? 'selected' : ''} onClick={() => switchTo('iced')}><SnowIcon size={39} /><span>ICED · {counts.iced}</span></button>
      </div>
      <div className="product-grid" style={{ '--columns': columns, '--rows': rows }}>
        {slots.map(({ menuItem, product }) => product
          ? <ProductButton key={menuItem.id} name={menuItem.id === SPECIAL_MENU_ID ? specialName(state) || 'Monthly Special' : menuItem.name} special={menuItem.id === SPECIAL_MENU_ID} product={product} onSelect={() => selectProduct(product)} />
          : <div className="grid-placeholder" aria-hidden="true" key={menuItem.id} />)}
      </div>
    </section>
    <footer className={`confirmation-rail ${lastSaleId ? 'has-sale' : ''}`} aria-live="polite">
      <div className="confirmation-message"><span className="confirm-icon"><CheckIcon size={28} /></span><strong>{pending.length ? `Next drink will be recorded as ${pending.join(' and ')}` : message}</strong></div>
      <div className="rail-actions">
        <button className={`decaf-button student-button ${studentDrink ? 'on' : ''}`} aria-pressed={studentDrink} onClick={() => setStudentDrink(!studentDrink)}>{studentDrink ? 'Student drink ✓' : 'Student drink'}</button>
        <button className={`decaf-button ${decaf ? 'on' : ''}`} aria-pressed={decaf} onClick={() => setDecaf(!decaf)}>{decaf ? 'Decaf ✓' : 'Decaf'}</button>
        {due && <button className="backup-button" onClick={saveBackup}><DownloadIcon size={23} /> Save backup</button>}
        <button className="undo-button" disabled={!lastSaleId} onClick={undo}><UndoIcon size={25} /> Undo</button>
      </div>
    </footer>
    {ordersOpen && <OrdersPanel state={state} orders={orders} onRecord={recordOrder} onClose={() => setOrdersOpen(false)} />}
    {!ordersOpen && !optionProduct && orders.alerts.length > 0 && <NewOrderAlert orders={orders} onShowAll={() => { orders.dismissAlerts(); setOrdersOpen(true); }} />}
    {optionProduct && <DrinkPicker title={productLabel(state, optionProduct.product)} options={optionProduct.product.options || []} choices={optionProduct.choices} onClose={() => setOptionProduct(null)} onRecord={(option, changes) => { recordSale(optionProduct.product, option, changes); setOptionProduct(null); }} />}
  </main>;
}

function ProductButton({ name, special = false, product, onSelect }) {
  const label = oneLine(name).toLowerCase();
  let type = 'latte';
  if (label.includes('mocha')) type = 'mocha';
  if (label.includes('caramel')) type = 'caramel';
  if (label.includes('black coffee')) type = 'black';
  if (label.includes('tea')) type = 'tea';
  if (product.temperature === 'none') type = 'treat';
  return <button className={`product-button ${product.temperature === 'none' ? 'treat-button' : ''} ${special ? 'special-button' : ''}`} onClick={onSelect} aria-label={`Record ${product.temperature === 'none' ? '' : prettyTemperature(product.temperature)} ${oneLine(name)}${special ? ' (monthly special)' : ''}`}>
    {special && <small className="special-tag">Monthly special</small>}
    <DrinkIcon type={type} temperature={product.temperature} />
    <span>{name.split('\n').map((part, index) => <React.Fragment key={index}>{index > 0 && <br />}{part}</React.Fragment>)}</span>
    {product.temperature !== 'none' && <small className={`temp-badge ${product.temperature}`}>{product.temperature === 'hot' ? <HeatIcon size={14} /> : <SnowIcon size={14} />}{prettyTemperature(product.temperature)}</small>}
    <small className="product-price">${product.price.toFixed(2)}</small>
  </button>;
}

// Flavor (when the drink has choices) plus any changes, then one big button to record.
function DrinkPicker({ title, options, choices, onClose, onRecord }) {
  const [option, setOption] = useState(null);
  const [changes, setChanges] = useState([]);
  const { remove, add } = choices(option);
  const picked = changes.filter((change) => remove.includes(change) || add.includes(change));
  const needsOption = options.length > 0 && !option;
  const toggle = (change) => setChanges((current) => current.includes(change) ? current.filter((entry) => entry !== change) : [...current, change]);
  const chips = (list) => <div className="change-grid">{list.map((change) => <button key={change} className={picked.includes(change) ? 'selected' : ''} aria-pressed={picked.includes(change)} onClick={() => toggle(change)}>{picked.includes(change) ? '✓ ' : ''}{change}</button>)}</div>;
  const recordLabel = needsOption ? 'Choose a flavor first' : picked.length ? `Record drink with ${picked.length} ${picked.length === 1 ? 'change' : 'changes'}` : 'No changes — record drink';
  const record = <button className={`button primary full-button record-button ${picked.length ? '' : 'no-changes'}`} disabled={needsOption} onClick={() => onRecord(option, picked)}>{recordLabel}</button>;
  return <Modal title={title} onClose={onClose} wide>
    {options.length > 0 && <>
      <h3 className="picker-heading">1. Choose the flavor</h3>
      <div className="flavor-grid flavor-grid-wide">{options.map((entry) => <button key={entry} className={option === entry ? 'selected' : ''} aria-pressed={option === entry} onClick={() => setOption(entry)}>{entry}</button>)}</div>
    </>}
    {record}
    {picked.length > 0 && <p className="picked-changes" role="status">{picked.join(' · ')}</p>}
    {remove.length > 0 && <><h3 className="picker-heading">Take off</h3>{chips(remove)}</>}
    {add.length > 0 && <><h3 className="picker-heading">Add or swap</h3>{chips(add)}</>}
    {picked.length > 0 && record}
    <button className="button secondary full-button" onClick={onClose}>Cancel</button>
  </Modal>;
}

function CountScreen({ state, setState, countedBy, onDone }) {
  const items = state.inventory.filter((item) => item.active);
  const [draft, setDraft] = useState(() => Object.fromEntries(items.map((item) => [item.id, ''])));
  const [name, setName] = useState(countedBy);
  const completed = Object.values(draft).filter((value) => value !== '').length;
  const step = (id, delta) => setDraft((current) => ({ ...current, [id]: String(Math.max(0, (Number(current[id]) || 0) + delta)) }));
  const submit = () => {
    const session = { id: uid('count'), status: 'pending', submittedAt: new Date().toISOString(), countedBy: name.trim() || 'Not given', counts: Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== '').map(([id, value]) => [id, Number(value)])) };
    setState((current) => ({ ...current, countSessions: [...current.countSessions, session] }));
    onDone();
  };
  const categories = [...INVENTORY_CATEGORIES, ...new Set(items.map((item) => item.category).filter((category) => !INVENTORY_CATEGORIES.includes(category)))];
  return <main className="app-shell count-shell">
    <header className="topbar"><Brand /><h1>Inventory count</h1><button className="back-button" onClick={onDone}><BackIcon size={23} /> Cancel</button></header>
    <section className="count-content">
      <div className="count-intro"><div><h2>Count what you see</h2><p>Enter how many of each item are on the shelf. Use decimals for partly used containers, such as 0.5 for half. Leave an item blank if you did not count it. A staff member checks your count before anything changes.</p></div><strong>{completed} of {items.length}</strong></div>
      <label className="counter-name">Your name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      {categories.map((category) => {
        const group = items.filter((item) => item.category === category);
        if (!group.length) return null;
        return <section key={category} className="count-group"><h3>{category}</h3><div className="count-grid">
          {group.map((item) => <div className="count-row" key={item.id}>
            <span><strong>{item.name}</strong><small>Count in: {item.countUnit || 'same unit as the inventory sheet'}</small></span>
            <div className="stepper">
              <button type="button" onClick={() => step(item.id, -1)} aria-label={`One less ${item.name}`}><MinusIcon size={22} /></button>
              <input inputMode="decimal" type="number" step="any" min="0" value={draft[item.id]} onChange={(event) => setDraft({ ...draft, [item.id]: event.target.value })} aria-label={`${item.name} count`} placeholder="—" />
              <button type="button" onClick={() => step(item.id, 1)} aria-label={`One more ${item.name}`}><PlusIcon size={22} /></button>
            </div>
          </div>)}
        </div></section>;
      })}
      <Credit />
    </section>
    <footer className="count-footer"><span>Your count goes to staff for review.</span><button className="button primary" disabled={!completed} onClick={submit}>Submit count</button></footer>
  </main>;
}

export default App;
