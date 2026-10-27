import React, { useMemo, useState } from 'react';
import { AlertIcon, BackIcon, ClipboardIcon, DownIcon, DownloadIcon, EditIcon, HeatIcon, PauseIcon, PlayIcon, PlusIcon, SnowIcon, UpIcon, CupLogo } from './icons';
import { downloadCsv, uid } from './storage';
import { INVENTORY_CATEGORIES } from './data';
import { ESTIMATE_LABELS, currentRecipe, estimateUsage, formatNumber, formatRange, inventoryBalances, lineQuantity, recipeHistory, weekStart, weeklyReport } from './estimates';
import { Brand, Modal, SectionHeading, dayLabel, menuItemFor, oneLine, prettyTemperature, productLabel, timeLabel } from './ui';

const TABS = ['products', 'recipes', 'inventory', 'reports', 'history'];

export default function StaffWorkspace({ state, setState, staffName, onBack, onStartCount }) {
  const [tab, setTab] = useState('products');
  const pendingCounts = state.countSessions.filter((session) => session.status === 'pending').length;
  return <main className="app-shell staff-shell">
    <header className="topbar">
      <Brand />
      <h1>Staff workspace</h1>
      <button className="back-button" onClick={onBack}><BackIcon size={23} /> Back to sales</button>
    </header>
    <nav className="staff-tabs" aria-label="Staff workspace">
      {TABS.map((name) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}{name === 'inventory' && pendingCounts > 0 && <span className="tab-badge">{pendingCounts}</span>}</button>)}
    </nav>
    <section className="workspace-content">
      {tab === 'products' && <ProductsTab state={state} setState={setState} />}
      {tab === 'recipes' && <RecipesTab state={state} setState={setState} staffName={staffName} />}
      {tab === 'inventory' && <InventoryTab state={state} setState={setState} staffName={staffName} onStartCount={onStartCount} />}
      {tab === 'reports' && <ReportsTab state={state} />}
      {tab === 'history' && <HistoryTab state={state} />}
    </section>
  </main>;
}

const TempMark = ({ temperature }) => <span className={`temp-mark ${temperature}`}>{temperature === 'hot' ? <HeatIcon /> : temperature === 'iced' ? <SnowIcon /> : <CupLogo size={22} />}</span>;
const StatusPill = ({ status }) => <span className={`status-text ${status === 'complete' ? 'active' : status === 'not-configured' ? 'inactive' : 'warning'}`}>{ESTIMATE_LABELS[status]}</span>;

/* ---------- Products ---------- */

function ProductsTab({ state, setState }) {
  const [editing, setEditing] = useState(null);
  const items = [...state.menuItems].sort((a, b) => a.order - b.order);
  const flagged = state.products.filter((product) => product.reviewNote).length + state.menuItems.filter((entry) => entry.reviewNote).length;

  const move = (menuItem, direction) => {
    const target = items[items.findIndex((entry) => entry.id === menuItem.id) + direction];
    if (!target) return;
    setState((current) => ({ ...current, menuItems: current.menuItems.map((entry) => entry.id === menuItem.id ? { ...entry, order: target.order } : entry.id === target.id ? { ...entry, order: menuItem.order } : entry) }));
  };
  const toggle = (menuItem) => setState((current) => ({ ...current, menuItems: current.menuItems.map((entry) => entry.id === menuItem.id ? { ...entry, active: !entry.active } : entry) }));
  const save = (menuItem, variants) => {
    setState((current) => {
      const exists = current.menuItems.some((entry) => entry.id === menuItem.id);
      const menuItems = exists ? current.menuItems.map((entry) => entry.id === menuItem.id ? menuItem : entry) : [...current.menuItems, menuItem];
      let products = current.products;
      for (const variant of variants) products = products.some((product) => product.id === variant.id) ? products.map((product) => product.id === variant.id ? variant : product) : [...products, variant];
      return { ...current, menuItems, products };
    });
    setEditing(null);
  };
  const addNew = () => setEditing({ id: uid('item'), name: '', order: Math.max(0, ...state.menuItems.map((entry) => entry.order)) + 1, kind: 'drink', active: true, reviewNote: '' });

  return <>
    <SectionHeading title="Products" description="One row per menu button. Hot and iced versions share a button position and are recorded as separate products." action={<button className="button primary" onClick={addNew}><PlusIcon size={22} /> Add product</button>} />
    {flagged > 0 && <div className="review-notice"><AlertIcon size={21} />{flagged} names or details are flagged for review. Workbook names are kept as source names; changing the button name never changes past sales.</div>}
    <div className="data-list product-list">
      <div className="data-row data-head"><span>Product</span><span>Variants</span><span>Status</span><span>Order</span><span>Actions</span></div>
      {items.map((menuItem) => {
        const variants = state.products.filter((product) => product.menuItemId === menuItem.id);
        return <div className={`data-row ${menuItem.active ? '' : 'row-inactive'}`} key={menuItem.id}>
          <span><strong>{oneLine(menuItem.name)}</strong>{menuItem.reviewNote && <small className="warning-text">{menuItem.reviewNote}</small>}</span>
          <span className="variant-list">{variants.map((product) => {
            const recipe = currentRecipe(state.recipes, product.recipeKey);
            const status = estimateUsage(recipe, state.inventory).status;
            return <span key={product.id} className={`variant-chip ${product.temperature} ${product.active ? '' : 'inactive'}`}>
              <b>{prettyTemperature(product.temperature)}{product.active ? '' : ' (off)'}</b>
              <small>{product.sourceName}</small>
              <small>{recipe ? `${recipe.versionLabel} · ${ESTIMATE_LABELS[status]}` : 'Not configured for ingredient estimates'}</small>
              {product.reviewNote && <small className="warning-text">{product.reviewNote}</small>}
            </span>;
          })}</span>
          <span><span className={`status-text ${menuItem.active ? 'active' : 'inactive'}`}>{menuItem.active ? 'Active' : 'Inactive'}</span></span>
          <span className="order-actions"><button onClick={() => move(menuItem, -1)} aria-label={`Move ${oneLine(menuItem.name)} up`}><UpIcon /></button><button onClick={() => move(menuItem, 1)} aria-label={`Move ${oneLine(menuItem.name)} down`}><DownIcon /></button></span>
          <span className="row-actions"><button onClick={() => setEditing(menuItem)}><EditIcon /> Edit</button><button className={menuItem.active ? 'danger-link' : ''} onClick={() => toggle(menuItem)}>{menuItem.active ? <PauseIcon /> : <PlayIcon />}{menuItem.active ? 'Deactivate' : 'Reactivate'}</button></span>
        </div>;
      })}
    </div>
    {editing && <ProductEditor state={state} menuItem={editing} onSave={save} onClose={() => setEditing(null)} />}
  </>;
}

function ProductEditor({ state, menuItem, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...menuItem });
  const [variants, setVariants] = useState(() => {
    const existing = state.products.filter((product) => product.menuItemId === menuItem.id);
    return ['hot', 'iced', 'none'].map((temperature) => {
      const found = existing.find((product) => product.temperature === temperature);
      return found ? { ...found, offered: found.active, optionsText: found.options.join(', ') } : { id: `${menuItem.id}-${temperature}-${Date.now().toString(36)}`, menuItemId: menuItem.id, temperature, sourceName: '', recipeKey: null, reviewNote: '', price: temperature === 'none' ? 2.5 : 3.5, options: [], optionsText: '', active: false, offered: false, isNew: true };
    });
  });
  const recipeKeys = (temperature) => state.recipes.filter((recipe) => !recipe.supersededAt && recipe.temperature === temperature);
  const setVariant = (temperature, patch) => setVariants((current) => current.map((variant) => variant.temperature === temperature ? { ...variant, ...patch } : variant));
  const shown = variants.filter((variant) => draft.kind === 'food' ? variant.temperature === 'none' : variant.temperature !== 'none');
  const submit = (event) => {
    event.preventDefault();
    const name = draft.name.trim();
    const saved = variants
      .filter((variant) => !variant.isNew || (variant.offered && shown.includes(variant)))
      .map(({ offered, optionsText, isNew, ...variant }) => ({ ...variant, active: offered && shown.some((entry) => entry.temperature === variant.temperature), sourceName: variant.sourceName.trim() || `${oneLine(name)}${variant.temperature === 'none' ? '' : ` - ${variant.temperature.toUpperCase()}`}`, price: Number(variant.price) || 0, options: optionsText.split(',').map((option) => option.trim()).filter(Boolean) }));
    onSave({ ...draft, name }, saved);
  };
  return <Modal title={menuItem.name ? `Edit ${oneLine(menuItem.name)}` : 'Add product'} onClose={onClose} wide>
    <form className="stack-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Button name<textarea required rows="2" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /><small className="field-help">Press Return to choose where the name wraps on the button.</small></label>
        <label>Type<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}><option value="drink">Drink (hot and/or iced)</option><option value="food">Food or other (no temperature)</option></select></label>
      </div>
      <label>Review note<textarea rows="2" value={draft.reviewNote} onChange={(event) => setDraft({ ...draft, reviewNote: event.target.value })} placeholder="Clear this once the name has been checked" /></label>
      {shown.map((variant) => <fieldset key={variant.temperature} className={`variant-fieldset ${variant.temperature}`}>
        <legend><label className="check-label"><input type="checkbox" checked={variant.offered} onChange={(event) => setVariant(variant.temperature, { offered: event.target.checked })} /> Offer {variant.temperature === 'none' ? 'this product' : prettyTemperature(variant.temperature).toLowerCase()}</label></legend>
        {variant.offered && <div className="form-grid">
          <label>Source name (sales sheet)<input value={variant.sourceName} onChange={(event) => setVariant(variant.temperature, { sourceName: event.target.value })} /></label>
          <label>Price<input type="number" step="0.01" min="0" value={variant.price} onChange={(event) => setVariant(variant.temperature, { price: event.target.value })} /></label>
          <label>Recipe<select value={variant.recipeKey || ''} onChange={(event) => setVariant(variant.temperature, { recipeKey: event.target.value || null })}><option value="">Not configured</option>{recipeKeys(variant.temperature).map((recipe) => <option key={recipe.recipeKey} value={recipe.recipeKey}>{recipe.name} · {recipe.versionLabel}</option>)}</select></label>
          <label>Flavor choices<input value={variant.optionsText} onChange={(event) => setVariant(variant.temperature, { optionsText: event.target.value })} placeholder="Comma separated; leave blank for none" /></label>
          <label className="span-2">Variant review note<input value={variant.reviewNote} onChange={(event) => setVariant(variant.temperature, { reviewNote: event.target.value })} /></label>
        </div>}
      </fieldset>)}
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary">Save product</button></div>
    </form>
  </Modal>;
}

/* ---------- Recipes ---------- */

const ROLE_LABELS = { cup: 'Cup', consumable: 'Consumable', espresso: 'Espresso', syrup: 'Syrup / sauce', milk: 'Milk', ice: 'Ice', topping: 'Topping / finish', other: 'Other' };
const UNITS = ['', 'each', 'shot', 'pump', 'oz', 'g', 'scoop'];

function RecipesTab({ state, setState, staffName }) {
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editingPumps, setEditingPumps] = useState(null);
  const recipes = state.recipes.filter((recipe) => !recipe.supersededAt);
  const statuses = Object.fromEntries(recipes.map((recipe) => [recipe.recipeKey, estimateUsage(recipe, state.inventory)]));
  const ready = recipes.filter((recipe) => statuses[recipe.recipeKey].status === 'complete').length;
  const unlinked = state.products.filter((product) => product.active && !currentRecipe(state.recipes, product.recipeKey));

  // Saves each draft as a new version and closes out the version it replaces.
  const save = (drafts, linkProductId) => {
    const now = new Date().toISOString();
    const previousIds = drafts.map((draft) => currentRecipe(state.recipes, draft.recipeKey)?.versionId);
    const next = drafts.map((draft) => {
      const version = (currentRecipe(state.recipes, draft.recipeKey)?.version || 0) + 1;
      return { ...draft, versionId: `${draft.recipeKey}-v${version}-${Date.now().toString(36)}`, version, effectiveFrom: now, supersededAt: null, savedBy: staffName };
    });
    setState((current) => ({
      ...current,
      recipes: [...current.recipes.map((recipe) => previousIds.includes(recipe.versionId) ? { ...recipe, supersededAt: now } : recipe), ...next],
      products: linkProductId ? current.products.map((product) => product.id === linkProductId ? { ...product, recipeKey: drafts[0].recipeKey } : product) : current.products,
    }));
    setEditing(null);
    setEditingPumps(null);
  };
  const createFor = (product) => setEditing({ linkProductId: product.id, recipe: {
    recipeKey: product.id, version: 0, versionLabel: 'v1', name: oneLine(menuItemFor(state, product)?.name || product.sourceName), temperature: product.temperature,
    cupSize: '', cupType: '', espressoShots: null, lines: [], instructions: '', sourceCard: '', sourceDocument: '', changeNote: '',
  } });

  return <>
    <SectionHeading title="Recipes" description="Every save creates a new version. Past sales keep the version and ingredient estimate they were recorded with." />
    <div className="recipe-summary"><AlertIcon size={23} /><div><strong>{ready} of {recipes.length} recipes ready for full ingredient estimates</strong><span>Recipes come from the Pinckney Panther recipe cards. Tap a drink to change syrup pumps or anything else; each change is saved as a new version. Sales are never blocked by missing recipe details.</span></div></div>
    <div className="recipe-list">
      {recipes.map((recipe) => {
        const estimate = statuses[recipe.recipeKey];
        const linked = state.products.filter((product) => product.recipeKey === recipe.recipeKey);
        return <article className="recipe-row" key={recipe.versionId}>
          <button className="recipe-row-main" onClick={() => setOpen(open === recipe.recipeKey ? null : recipe.recipeKey)} aria-expanded={open === recipe.recipeKey}>
            <TempMark temperature={recipe.temperature} />
            <span><strong>{recipe.name}</strong><small>{prettyTemperature(recipe.temperature)} · {[recipe.cupSize, recipe.cupType].filter(Boolean).join(' ') || 'Cup not set'} · {recipe.sourceCard || 'No source card'}</small></span>
            <span>{recipe.versionLabel}</span>
            <span><StatusPill status={estimate.status} />{estimate.gaps.length > 0 && <small>{estimate.gaps.length} details needed</small>}</span>
            <DownIcon />
          </button>
          {open === recipe.recipeKey && <RecipeDetail state={state} recipe={recipe} estimate={estimate} linked={linked} onEdit={() => setEditing({ recipe })} onEditPumps={() => setEditingPumps(recipe)} />}
        </article>;
      })}
    </div>
    {unlinked.length > 0 && <>
      <h3 className="subheading">Products without a recipe</h3>
      <p className="subheading-help">These still record sales normally. They are marked “Not configured” for ingredient estimates.</p>
      <div className="data-list">{unlinked.map((product) => <div className="data-row simple-row" key={product.id}><span><strong>{productLabel(state, product)}</strong><small>{product.sourceName}</small></span><span><button className="text-action" onClick={() => createFor(product)}><PlusIcon size={18} /> Create recipe</button></span></div>)}</div>
    </>}
    {editing && <RecipeEditor state={state} recipe={editing.recipe} onSave={(draft) => save([draft], editing.linkProductId)} onClose={() => setEditing(null)} />}
    {editingPumps && <PumpEditor state={state} recipe={editingPumps} onSave={(drafts) => save(drafts)} onClose={() => setEditingPumps(null)} />}
  </>;
}

function RecipeDetail({ state, recipe, estimate, linked, onEdit, onEditPumps }) {
  const itemName = (id) => state.inventory.find((item) => item.id === id)?.name;
  const history = recipeHistory(state.recipes, recipe.recipeKey);
  return <div className="recipe-detail">
    <dl>
      <div><dt>Cup</dt><dd>{[recipe.cupSize, recipe.cupType].filter(Boolean).join(' ') || 'Not set'}</dd></div>
      <div><dt>Espresso</dt><dd>{recipe.espressoShots != null ? `${recipe.espressoShots} shots` : 'Not set'}</dd></div>
      <div><dt>Source</dt><dd>{recipe.sourceCard || '—'}</dd></div>
      <div><dt>Sold as</dt><dd>{linked.map((product) => product.sourceName).join('; ') || 'Not linked to a product'}</dd></div>
    </dl>
    <table className="line-table">
      <thead><tr><th>Ingredient</th><th>Card amount</th><th>Used for inventory</th><th>Inventory item</th></tr></thead>
      <tbody>{recipe.lines.map((line) => <tr key={line.id} className={line.excluded ? 'excluded' : ''}>
        <td><strong>{line.label}</strong><small>{ROLE_LABELS[line.role]}{line.note ? ` · ${line.note}` : ''}</small></td>
        <td>{formatRange(line.amount, line.unit)}</td>
        <td>{line.excluded ? 'Not used' : lineQuantity(line) != null ? `${formatNumber(lineQuantity(line))} ${line.unit || ''}${line.unit === 'pump' && line.ozPerPump ? ` @ ${line.ozPerPump} oz` : ''}` : <span className="warning-text">Needed</span>}</td>
        <td>{line.itemId ? `${itemName(line.itemId)}${line.itemConfirmed ? '' : ' (suggested, not confirmed)'}` : <span className="warning-text">None</span>}</td>
      </tr>)}</tbody>
    </table>
    <div><h3>Preparation</h3><p>{recipe.instructions || 'Not entered'}</p></div>
    {estimate.gaps.length > 0 && <div className="gap-list"><h3>Needed before estimates are complete</h3><ul>{estimate.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></div>}
    <div><h3>Versions</h3><ul className="version-list">{history.map((version) => <li key={version.versionId}><strong>{version.versionLabel}</strong> · {version.supersededAt ? `${timeLabel(version.effectiveFrom)} – ${timeLabel(version.supersededAt)}` : `current since ${timeLabel(version.effectiveFrom)}`}{version.savedBy ? ` · ${version.savedBy}` : ''}{version.changeNote ? ` · ${version.changeNote}` : ''}</li>)}</ul></div>
    <div className="detail-actions"><button className="button primary" onClick={onEditPumps}><EditIcon size={20} /> Change syrup pumps</button><button className="button secondary" onClick={onEdit}><EditIcon size={20} /> Edit full recipe</button></div>
  </div>;
}

// Quick editor for the most common change: pump counts. Can update the hot and
// iced versions of a drink together, matching syrups by name.
function PumpEditor({ state, recipe, onSave, onClose }) {
  const sibling = state.recipes.find((entry) => !entry.supersededAt && entry.name === recipe.name && entry.temperature !== recipe.temperature);
  const [rows, setRows] = useState(() => recipe.lines.filter((line) => line.unit === 'pump').map((line) => ({ label: line.label, itemId: line.itemId, count: line.amount?.min ?? 0, original: line.amount?.min ?? 0 })));
  const [both, setBoth] = useState(!!sibling);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState('');
  const syrups = state.inventory.filter((item) => item.category === 'Syrups & sauces' && item.active && !rows.some((row) => row.itemId === item.id));
  const setCount = (index, count) => setRows((current) => current.map((row, position) => position === index ? { ...row, count: Math.max(0, count) } : row));
  const addSyrup = (itemId) => {
    const item = state.inventory.find((entry) => entry.id === itemId);
    if (item) setRows((current) => [...current, { label: item.name, itemId: item.id, count: 1, original: 0, added: true }]);
    setAdding('');
  };
  const changes = rows.filter((row) => row.count !== row.original).map((row) => `${row.label} ${row.original}→${row.count}`);

  const apply = (target) => {
    let lines = target.lines.map((line) => {
      const row = line.unit === 'pump' && rows.find((entry) => entry.label === line.label);
      return row ? { ...line, amount: { min: row.count, max: row.count } } : line;
    }).filter((line) => !(line.unit === 'pump' && line.amount?.min === 0));
    const insertAt = Math.max(0, ...lines.map((line, index) => line.unit === 'pump' ? index + 1 : 0)) || lines.findIndex((line) => line.role === 'milk');
    const added = rows.filter((row) => row.count > 0 && !target.lines.some((line) => line.unit === 'pump' && line.label === row.label))
      .map((row) => ({ id: uid('line'), role: 'syrup', label: row.label, amount: { min: row.count, max: row.count }, unit: 'pump', calcAmount: null, itemId: row.itemId, itemConfirmed: !!row.itemId, ozPerPump: null, excluded: false, note: '' }));
    lines = [...lines.slice(0, insertAt < 0 ? lines.length : insertAt), ...added, ...lines.slice(insertAt < 0 ? lines.length : insertAt)];
    return { ...target, lines, versionLabel: `v${target.version + 1}`, changeNote: [`Pumps: ${changes.join(', ')}`, note.trim()].filter(Boolean).join('. ') };
  };

  return <Modal title={`Syrup pumps · ${recipe.name}`} onClose={onClose}>
    <div className="stack-form">
      <p className="field-help">Change the pump count for each syrup or sauce. Set a syrup to 0 to remove it. Past sales keep the old amounts.</p>
      <div className="pump-list">
        {rows.map((row, index) => <div className={`pump-row ${row.count !== row.original ? 'changed' : ''}`} key={row.label}>
          <span><strong>{row.label}</strong><small>{row.added ? 'New' : `Was ${row.original}`}</small></span>
          <div className="stepper">
            <button type="button" onClick={() => setCount(index, row.count - 1)} aria-label={`One less pump of ${row.label}`}>−</button>
            <input type="number" inputMode="numeric" min="0" step="1" value={row.count} onChange={(event) => setCount(index, Number(event.target.value) || 0)} aria-label={`${row.label} pumps`} />
            <button type="button" onClick={() => setCount(index, row.count + 1)} aria-label={`One more pump of ${row.label}`}>+</button>
          </div>
        </div>)}
      </div>
      {syrups.length > 0 && <label>Add a syrup or sauce<select value={adding} onChange={(event) => addSyrup(event.target.value)}><option value="">Choose…</option>{syrups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {sibling && <label className="check-label"><input type="checkbox" checked={both} onChange={(event) => setBoth(event.target.checked)} /> Also change the {prettyTemperature(sibling.temperature).toLowerCase()} {recipe.name}</label>}
      <label>Note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Fall 2026 recipe update" /></label>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="button" className="button primary" disabled={!changes.length} onClick={() => onSave([apply(recipe), ...(both && sibling ? [apply(sibling)] : [])])}>Save pumps</button></div>
    </div>
  </Modal>;
}

const normalizeAmount = (amount) => {
  if (!amount || (amount.min == null && amount.max == null)) return null;
  const min = amount.min ?? amount.max;
  const max = amount.max ?? amount.min;
  return { min: Math.min(min, max), max: Math.max(min, max) };
};
const normalizeRecipe = (draft) => ({ ...draft, espressoShots: draft.espressoShots === '' || draft.espressoShots == null ? null : Number(draft.espressoShots), lines: draft.lines.map((line) => ({ ...line, amount: normalizeAmount(line.amount) })) });
const numberOrNull = (value) => value === '' ? null : Number(value);

function RecipeEditor({ state, recipe, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({ ...JSON.parse(JSON.stringify(recipe)), versionLabel: `v${recipe.version + 1}`, changeNote: '' }));
  const setLine = (id, patch) => setDraft((current) => ({ ...current, lines: current.lines.map((line) => line.id === id ? { ...line, ...patch } : line) }));
  const setAmount = (line, key, value) => setLine(line.id, { amount: { ...(line.amount || { min: null, max: null }), [key]: numberOrNull(value) } });
  const addLine = () => setDraft((current) => ({ ...current, lines: [...current.lines, { id: uid('line'), role: 'other', label: '', amount: null, unit: '', calcAmount: null, itemId: null, itemConfirmed: false, ozPerPump: null, excluded: false, note: '' }] }));
  const removeLine = (id) => setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) }));
  const preview = estimateUsage(normalizeRecipe(draft), state.inventory);
  const items = [...state.inventory].sort((a, b) => a.name.localeCompare(b.name));

  return <Modal title={`${recipe.version ? 'New version of' : 'New recipe:'} ${recipe.name} · ${prettyTemperature(recipe.temperature)}`} onClose={onClose} wide>
    <form className="stack-form" onSubmit={(event) => { event.preventDefault(); onSave(normalizeRecipe(draft)); }}>
      <div className="form-grid three">
        <label>Drink name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Cup size<input value={draft.cupSize} onChange={(event) => setDraft({ ...draft, cupSize: event.target.value })} placeholder="e.g. 16 oz" /></label>
        <label>Cup type<input value={draft.cupType} onChange={(event) => setDraft({ ...draft, cupType: event.target.value })} placeholder="e.g. Paper cup" /></label>
        <label>Espresso shots<input type="number" min="0" step="1" value={draft.espressoShots ?? ''} onChange={(event) => setDraft({ ...draft, espressoShots: event.target.value })} /></label>
        <label>Source card<input value={draft.sourceCard} onChange={(event) => setDraft({ ...draft, sourceCard: event.target.value })} placeholder="e.g. Card 3/10, 2026 update" /></label>
        <label>Source document<input value={draft.sourceDocument} onChange={(event) => setDraft({ ...draft, sourceDocument: event.target.value })} /></label>
      </div>
      <h3 className="form-section">Ingredients and supplies</h3>
      <p className="field-help">Enter amounts exactly as the card gives them. When the card gives a range, keep the range and choose the standard amount used for inventory. Leave an amount blank if the card does not give one. Only confirmed inventory items count toward estimates.</p>
      <div className="line-editor-list">{draft.lines.map((line) => {
        const amount = line.amount || { min: null, max: null };
        const isRange = amount.min != null && amount.max != null && amount.min !== amount.max;
        const item = state.inventory.find((entry) => entry.id === line.itemId);
        return <div className={`line-editor ${line.excluded ? 'excluded' : ''}`} key={line.id}>
          <div className="line-editor-row">
            <label>Type<select value={line.role} onChange={(event) => setLine(line.id, { role: event.target.value })}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="grow">Ingredient or supply<input required value={line.label} onChange={(event) => setLine(line.id, { label: event.target.value })} /></label>
            <label className="narrow">From<input type="number" step="any" min="0" value={amount.min ?? ''} onChange={(event) => setAmount(line, 'min', event.target.value)} /></label>
            <label className="narrow">To<input type="number" step="any" min="0" value={amount.max ?? ''} onChange={(event) => setAmount(line, 'max', event.target.value)} placeholder="same" /></label>
            <label className="narrow">Unit<select value={line.unit || ''} onChange={(event) => setLine(line.id, { unit: event.target.value || null })}>{UNITS.map((unit) => <option key={unit} value={unit}>{unit || '—'}</option>)}</select></label>
          </div>
          {isRange && <div className="line-editor-row standard-row">
            <span>Card range {amount.min}-{amount.max} {line.unit}. Standard amount for inventory:</span>
            {[amount.min, (amount.min + amount.max) / 2, amount.max].map((value) => <button type="button" key={value} className={`chip ${line.calcAmount === value ? 'selected' : ''}`} onClick={() => setLine(line.id, { calcAmount: value })}>{value} {line.unit}</button>)}
            <input className="narrow-input" type="number" step="any" min={amount.min} max={amount.max} value={line.calcAmount ?? ''} onChange={(event) => setLine(line.id, { calcAmount: numberOrNull(event.target.value) })} aria-label="Standard amount" />
          </div>}
          <div className="line-editor-row">
            <label className="grow">Inventory item<select value={line.itemId || ''} onChange={(event) => setLine(line.id, { itemId: event.target.value || null, itemConfirmed: false })}><option value="">None</option>{items.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            {line.itemId && <label className="check-label"><input type="checkbox" checked={line.itemConfirmed} onChange={(event) => setLine(line.id, { itemConfirmed: event.target.checked })} /> Confirmed match</label>}
            {line.unit === 'pump' && <label className="narrow wide-narrow">Oz per pump (this drink)<input type="number" step="any" min="0" value={line.ozPerPump ?? ''} onChange={(event) => setLine(line.id, { ozPerPump: numberOrNull(event.target.value) })} placeholder={item?.ozPerPump ? `${item.ozPerPump} (dispenser)` : 'not measured'} /></label>}
            <label className="check-label"><input type="checkbox" checked={line.excluded} onChange={(event) => setLine(line.id, { excluded: event.target.checked })} /> Not used</label>
            <button type="button" className="text-action danger-link" onClick={() => removeLine(line.id)}>Remove</button>
          </div>
          {line.note && <small className="field-help">{line.note}</small>}
        </div>;
      })}</div>
      <button type="button" className="button secondary" onClick={addLine}><PlusIcon size={20} /> Add ingredient or supply</button>
      <label>Preparation instructions<textarea rows="3" value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} /></label>
      <div className="form-grid">
        <label>Version label<input required value={draft.versionLabel} onChange={(event) => setDraft({ ...draft, versionLabel: event.target.value })} /></label>
        <label>What changed<input required value={draft.changeNote} onChange={(event) => setDraft({ ...draft, changeNote: event.target.value })} placeholder="e.g. Updated card; chose 9 oz milk standard" /></label>
      </div>
      <div className={`estimate-preview ${preview.status}`}><StatusPill status={preview.status} />{preview.usage.length > 0 && <span>Each sale: {preview.usage.map((use) => `${formatNumber(use.quantity)} ${use.unit} ${use.itemName}`).join(' · ')}</span>}{preview.gaps.length > 0 && <ul>{preview.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>}</div>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary">Save new version</button></div>
    </form>
  </Modal>;
}

/* ---------- Inventory ---------- */

const EVENT_LABELS = { opening: 'Opening balance', count: 'Physical count reconciled', restock: 'Restock', waste: 'Waste', spill: 'Spill', adjustment: 'Adjustment', remake: 'Drink remake', 'drink-waste': 'Drink wasted' };
const COUNT_REASONS = ['Matches estimate', 'Unrecorded waste or spill', 'Unrecorded restock', 'Recipe estimate differs from actual use', 'Earlier count was wrong', 'Other'];
const unitLabel = (item) => item.countUnit || 'source unit';

function InventoryTab({ state, setState, staffName, onStartCount }) {
  const [eventItem, setEventItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [drinkEvent, setDrinkEvent] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const balances = useMemo(() => inventoryBalances(state), [state]);
  const pending = state.countSessions.filter((session) => session.status === 'pending');
  const categories = [...INVENTORY_CATEGORIES, ...new Set(state.inventory.map((item) => item.category).filter((category) => !INVENTORY_CATEGORIES.includes(category)))];
  const addEvents = (events) => setState((current) => ({ ...current, inventoryEvents: [...current.inventoryEvents, ...events] }));
  const saveItem = (item) => {
    setState((current) => {
      const exists = current.inventory.some((entry) => entry.id === item.id);
      return {
        ...current,
        inventory: exists ? current.inventory.map((entry) => entry.id === item.id ? item : entry) : [...current.inventory, item],
        inventoryEvents: exists ? current.inventoryEvents : [...current.inventoryEvents, { id: uid('event'), type: 'opening', itemId: item.id, itemName: item.name, countedValue: item.onHand, at: new Date().toISOString(), by: staffName, note: 'Opening balance for new item' }],
      };
    });
    setEditingItem(null);
  };

  return <>
    <SectionHeading title="Inventory" description="Estimated balances = last physical count + restocks − waste − estimated recipe usage. Counts change balances only after staff review." action={<>
      <button className="button secondary" onClick={() => setDrinkEvent(true)}>Drink remake / waste</button>
      <button className="button secondary" onClick={() => setEditingItem({ id: uid('item'), name: '', sourceName: '', category: INVENTORY_CATEGORIES[0], full: 0, onHand: 0, need: 0, countUnit: '', usageUnit: '', usagePerCount: null, ozPerPump: null, active: true, note: '' })}><PlusIcon size={20} /> Add item</button>
      <button className="button primary" onClick={onStartCount}><ClipboardIcon size={20} /> Start count</button>
    </>} />
    <label className="check-label setting-toggle"><input type="checkbox" checked={!!state.settings?.studentCounts} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, studentCounts: event.target.checked } }))} /> Show the Count button on the student sales screen</label>
    {pending.map((session) => <div className="pending-review" key={session.id}><div><strong>Count from {session.countedBy || 'a student'} awaiting review</strong><span>Submitted {timeLabel(session.submittedAt)} · {Object.keys(session.counts).length} items counted</span></div><button className="button primary" onClick={() => setReviewing(session)}>Review count</button></div>)}
    {categories.map((category) => {
      const items = state.inventory.filter((item) => item.category === category);
      if (!items.length) return null;
      return <section key={category} className="inventory-group">
        <h3 className="subheading">{category}</h3>
        <div className="data-list inventory-list">
          <div className="data-row data-head"><span>Item</span><span>Par</span><span>Estimated</span><span>Last count</span><span>Units</span><span>Actions</span></div>
          {items.map((item) => {
            const balance = balances[item.id];
            const unconverted = Object.entries(balance.unconverted);
            const low = balance.estimate < item.full;
            return <div className={`data-row ${item.active ? '' : 'row-inactive'}`} key={item.id}>
              <span><strong>{item.name}</strong>{item.note && <small className="warning-text">{item.note}</small>}{unconverted.length > 0 && <small className="warning-text">{unconverted.map(([unit, quantity]) => `${formatNumber(quantity)} ${unit}`).join(', ')} used since last count but not deducted. Set units to convert.</small>}</span>
              <span>{formatNumber(item.full)}</span>
              <span className={low ? 'low-stock' : ''}><strong>{formatNumber(balance.estimate)}</strong>{low && <small>Below par</small>}</span>
              <span><small>{balance.lastCountAt ? timeLabel(balance.lastCountAt) : 'Workbook only'}</small></span>
              <span><small>{unitLabel(item)}{item.usageUnit && item.usagePerCount ? ` = ${formatNumber(item.usagePerCount)} ${item.usageUnit}` : ''}{item.ozPerPump ? ` · ${item.ozPerPump} oz/pump` : ''}</small></span>
              <span className="row-actions"><button onClick={() => setEventItem(item)}><PlusIcon size={18} /> Event</button><button onClick={() => setEditingItem(item)}><EditIcon /> Edit</button></span>
            </div>;
          })}
        </div>
      </section>;
    })}
    {eventItem && <InventoryEventEditor item={eventItem} onClose={() => setEventItem(null)} onSave={(event) => { addEvents([{ ...event, by: staffName }]); setEventItem(null); }} />}
    {editingItem && <ItemEditor item={editingItem} isNew={!state.inventory.some((entry) => entry.id === editingItem.id)} onSave={saveItem} onClose={() => setEditingItem(null)} />}
    {drinkEvent && <DrinkEventEditor state={state} onClose={() => setDrinkEvent(false)} onSave={(event) => { addEvents([{ ...event, by: staffName }]); setDrinkEvent(false); }} />}
    {reviewing && <CountReview state={state} session={reviewing} balances={balances} staffName={staffName} onClose={() => setReviewing(null)} onFinish={(events, status) => {
      const now = new Date().toISOString();
      setState((current) => ({ ...current, inventoryEvents: [...current.inventoryEvents, ...events], countSessions: current.countSessions.map((session) => session.id === reviewing.id ? { ...session, status, reviewedAt: now, reviewedBy: staffName } : session) }));
      setReviewing(null);
    }} />}
  </>;
}

function ItemEditor({ item, isNew, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...item });
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  return <Modal title={isNew ? 'Add inventory item' : `Edit ${item.name}`} onClose={onClose} wide>
    <form className="stack-form" onSubmit={(event) => { event.preventDefault(); onSave({ ...draft, name: draft.name.trim(), sourceName: draft.sourceName || draft.name.trim(), full: Number(draft.full) || 0, onHand: Number(draft.onHand) || 0 }); }}>
      <div className="form-grid">
        <label>Name<input required value={draft.name} onChange={(event) => set({ name: event.target.value })} />{!isNew && draft.sourceName !== draft.name && <small className="field-help">Inventory sheet name: {draft.sourceName}</small>}</label>
        <label>Category<select value={draft.category} onChange={(event) => set({ category: event.target.value })}>{INVENTORY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Counted in<input value={draft.countUnit} onChange={(event) => set({ countUnit: event.target.value })} placeholder="e.g. bottle, gallon, sleeve of 50" /></label>
        <label>Par level (Full)<input type="number" step="any" min="0" value={draft.full} onChange={(event) => set({ full: event.target.value })} /></label>
        <label>Recipes measure it in<select value={draft.usageUnit} onChange={(event) => set({ usageUnit: event.target.value })}>{UNITS.map((unit) => <option key={unit} value={unit}>{unit || 'Not set'}</option>)}</select></label>
        <label>{draft.usageUnit || 'Units'} in one {draft.countUnit || 'counted unit'}<input type="number" step="any" min="0" value={draft.usagePerCount ?? ''} onChange={(event) => set({ usagePerCount: numberOrNull(event.target.value) })} placeholder="e.g. 25.4 oz per bottle" /></label>
        <label>Measured ounces per pump<input type="number" step="any" min="0" value={draft.ozPerPump ?? ''} onChange={(event) => set({ ozPerPump: numberOrNull(event.target.value) })} placeholder="Dispensers only; measure first" /></label>
        {isNew && <label>Opening amount on hand<input type="number" step="any" min="0" value={draft.onHand} onChange={(event) => set({ onHand: event.target.value })} /></label>}
      </div>
      <label>Note<textarea rows="2" value={draft.note} onChange={(event) => set({ note: event.target.value })} /></label>
      <label className="check-label"><input type="checkbox" checked={draft.active} onChange={(event) => set({ active: event.target.checked })} /> Include in physical counts</label>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary">Save item</button></div>
    </form>
  </Modal>;
}

function InventoryEventEditor({ item, onClose, onSave }) {
  const [type, setType] = useState('restock');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const raw = Number(amount);
    const quantity = ['waste', 'spill'].includes(type) ? -Math.abs(raw) : type === 'restock' ? Math.abs(raw) : raw;
    onSave({ id: uid('event'), type, itemId: item.id, itemName: item.name, quantity, at: new Date().toISOString(), note });
  };
  return <Modal title={`Record event · ${item.name}`} onClose={onClose}>
    <form className="stack-form" onSubmit={submit}>
      <label>Event type<select value={type} onChange={(event) => setType(event.target.value)}><option value="restock">Restock (adds)</option><option value="waste">Waste (removes)</option><option value="spill">Spill (removes)</option><option value="adjustment">Adjustment (+ or −)</option></select></label>
      <label>Quantity in {unitLabel(item)}<input required type="number" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>Note{type === 'adjustment' && ' (required)'}<textarea required={type === 'adjustment'} rows="3" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary">Record event</button></div>
    </form>
  </Modal>;
}

function DrinkEventEditor({ state, onClose, onSave }) {
  const products = state.products.filter((product) => product.active && product.temperature !== 'none');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [type, setType] = useState('remake');
  const [note, setNote] = useState('');
  const product = products.find((entry) => entry.id === productId);
  const recipe = product && currentRecipe(state.recipes, product.recipeKey);
  const estimate = estimateUsage(recipe, state.inventory);
  const submit = (event) => {
    event.preventDefault();
    onSave({ id: uid('event'), type, productId, productName: productLabel(state, product), temperature: product.temperature, recipeVersionId: recipe?.versionId || null, usage: estimate.usage, gaps: estimate.gaps, estimateStatus: estimate.status, at: new Date().toISOString(), note });
  };
  return <Modal title="Drink remake or waste" onClose={onClose}>
    <form className="stack-form" onSubmit={submit}>
      <p className="field-help">Records ingredients used by a drink that was not sold. It is kept separate from sales.</p>
      <label>Drink<select value={productId} onChange={(event) => setProductId(event.target.value)}>{products.map((entry) => <option key={entry.id} value={entry.id}>{productLabel(state, entry)}</option>)}</select></label>
      <label>What happened<select value={type} onChange={(event) => setType(event.target.value)}><option value="remake">Remade (first drink discarded)</option><option value="drink-waste">Wasted or spilled drink</option></select></label>
      <label>Note<textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className={`estimate-preview ${estimate.status}`}><StatusPill status={estimate.status} />{estimate.usage.length > 0 && <span>{estimate.usage.map((use) => `${formatNumber(use.quantity)} ${use.unit} ${use.itemName}`).join(' · ')}</span>}</div>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!product}>Record</button></div>
    </form>
  </Modal>;
}

function CountReview({ state, session, balances, staffName, onClose, onFinish }) {
  const rows = Object.entries(session.counts).map(([itemId, counted]) => {
    const item = state.inventory.find((entry) => entry.id === itemId);
    return item && { item, counted, estimated: balances[itemId].estimate, difference: Math.round((counted - balances[itemId].estimate) * 1000) / 1000 };
  }).filter(Boolean);
  const [decisions, setDecisions] = useState(() => Object.fromEntries(rows.map((row) => [row.item.id, { include: true, reason: row.difference === 0 ? COUNT_REASONS[0] : '' }])));
  const [note, setNote] = useState('');
  const set = (id, patch) => setDecisions((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const missingReason = rows.some((row) => decisions[row.item.id].include && !decisions[row.item.id].reason);
  const finalize = () => {
    const at = new Date().toISOString();
    onFinish(rows.filter((row) => decisions[row.item.id].include).map((row) => ({
      id: uid('event'), type: 'count', itemId: row.item.id, itemName: row.item.name, countedValue: row.counted, estimatedBefore: row.estimated, quantity: row.difference,
      reason: decisions[row.item.id].reason, note, countSessionId: session.id, countedBy: session.countedBy, by: staffName, at,
    })), 'finalized');
  };
  return <Modal title={`Review count from ${session.countedBy || 'a student'}`} onClose={onClose} wide>
    <p className="field-help">Submitted {timeLabel(session.submittedAt)}. Accepted counts replace the estimated balance, and the difference is saved with your reason. Uncheck any item that should be recounted.</p>
    <div className="review-table">
      <div className="review-row review-head"><span>Use</span><span>Item</span><span>Estimated</span><span>Counted</span><span>Difference</span><span>Reason</span></div>
      {rows.map(({ item, counted, estimated, difference }) => <div className="review-row" key={item.id}>
        <span><input type="checkbox" aria-label={`Accept count for ${item.name}`} checked={decisions[item.id].include} onChange={(event) => set(item.id, { include: event.target.checked })} /></span>
        <span><strong>{item.name}</strong><small>{unitLabel(item)}</small></span>
        <span>{formatNumber(estimated)}</span>
        <span><strong>{formatNumber(counted)}</strong></span>
        <span className={difference < 0 ? 'negative' : difference > 0 ? 'positive' : ''}>{difference > 0 ? '+' : ''}{formatNumber(difference)}</span>
        <span><select value={decisions[item.id].reason} disabled={!decisions[item.id].include} onChange={(event) => set(item.id, { reason: event.target.value })} aria-label={`Reason for ${item.name}`}><option value="">Choose…</option>{COUNT_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></span>
      </div>)}
    </div>
    <div className="stack-form">
      <label>Reviewer note<textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      {missingReason && <p className="form-error">Choose a reason for every accepted item.</p>}
      <div className="form-actions"><button type="button" className="button secondary danger-text" onClick={() => onFinish([], 'discarded')}>Discard count</button><button type="button" className="button secondary" onClick={onClose}>Later</button><button type="button" className="button primary" disabled={missingReason} onClick={finalize}>Finalize accepted counts</button></div>
    </div>
  </Modal>;
}

/* ---------- Reports ---------- */

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ReportsTab({ state }) {
  const [start, setStart] = useState(() => weekStart(new Date()));
  const report = useMemo(() => weeklyReport(state, start), [state, start]);
  const shift = (weeks) => setStart((current) => { const next = new Date(current); next.setDate(next.getDate() + weeks * 7); return next; });
  const showDays = WEEKDAYS.map((_, index) => index < 5 || report.rows.some((row) => row.days[index] > 0));
  const dates = WEEKDAYS.map((_, index) => { const date = new Date(report.start); date.setDate(date.getDate() + index); return date; });
  const totals = WEEKDAYS.map((_, index) => report.rows.reduce((sum, row) => sum + row.days[index], 0));
  const revenue = report.sales.reduce((sum, sale) => sum + (sale.price || 0), 0);
  const exportCsv = () => downloadCsv(`empowering-brew-sales-${report.start.toISOString().slice(0, 10)}.csv`, [
    ['Date', 'Time', 'Product', 'Temperature', 'Flavor', 'Price', 'Source name', 'Recipe version', 'Estimate status', 'Estimated usage'],
    ...report.sales.map((sale) => { const at = new Date(sale.soldAt); return [at.toLocaleDateString('en-US'), at.toLocaleTimeString('en-US'), sale.productName, prettyTemperature(sale.temperature), sale.option || '', sale.price?.toFixed(2), sale.sourceName, sale.recipeVersionId || '', ESTIMATE_LABELS[sale.estimateStatus] || '', (sale.usage || []).map((use) => `${use.quantity} ${use.unit} ${use.itemName}`).join('; ')]; }),
  ]);
  return <>
    <SectionHeading title="Weekly sales" description="Same layout as the Empowering Brew Weekly Coffee Sales sheet. Hot and iced are counted separately." action={<button className="button secondary" onClick={exportCsv} disabled={!report.sales.length}><DownloadIcon size={20} /> Export CSV</button>} />
    <div className="week-nav"><button className="button secondary" onClick={() => shift(-1)}><BackIcon size={20} /> Previous</button><strong>Week of {dayLabel(report.start)}</strong><button className="button secondary" onClick={() => shift(1)}>Next <span className="flip"><BackIcon size={20} /></span></button></div>
    <div className="stat-row"><div><span>Drinks and treats sold</span><strong>{report.sales.length}</strong></div><div><span>Sales at menu price</span><strong>${revenue.toFixed(2)}</strong></div><div><span>Sales without a complete estimate</span><strong>{report.withoutFullEstimate}</strong></div></div>
    <div className="table-scroll"><table className="report-table">
      <thead><tr><th>Product</th>{WEEKDAYS.map((day, index) => showDays[index] && <th key={day}>{day}<small>{dayLabel(dates[index])}</small></th>)}<th>Total</th></tr></thead>
      <tbody>{report.rows.map((row) => <tr key={row.product.id}><td><span className={`temp-dot ${row.product.temperature}`} />{productLabel(state, row.product)}</td>{row.days.map((count, index) => showDays[index] && <td key={index}>{count || ''}</td>)}<td><strong>{row.total}</strong></td></tr>)}</tbody>
      <tfoot><tr><td>Total</td>{totals.map((count, index) => showDays[index] && <td key={index}>{count}</td>)}<td>{report.sales.length}</td></tr></tfoot>
    </table></div>
    <h3 className="subheading">Estimated ingredient usage this week</h3>
    {report.usage.length ? <div className="data-list">{report.usage.map((use) => <div className="data-row simple-row" key={`${use.itemName}-${use.unit}`}><span><strong>{use.itemName}</strong></span><span>{formatNumber(use.quantity)} {use.unit}</span></div>)}</div>
      : <p className="subheading-help">No usage estimated yet. Usage appears once recipes have confirmed inventory items, standard amounts, and measured pump volumes.</p>}
  </>;
}

/* ---------- History ---------- */

function HistoryTab({ state }) {
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(150);
  const records = useMemo(() => [
    ...state.sales.map((sale) => ({ kind: 'Sale', time: sale.soldAt, title: `${sale.productName}${sale.temperature === 'none' ? '' : ` · ${prettyTemperature(sale.temperature)}`}${sale.option ? ` · ${sale.option}` : ''}`, detail: `${sale.voidedAt ? 'Undone at the register · ' : ''}${ESTIMATE_LABELS[sale.estimateStatus] || 'Not configured'}${sale.recipeVersionId ? ` · recipe ${sale.recipeVersionId}` : ''}${sale.usage?.length ? ` · ${sale.usage.map((use) => `${use.quantity} ${use.unit} ${use.itemName}`).join(', ')}` : ''}`, voided: !!sale.voidedAt })),
    ...state.inventoryEvents.filter((event) => event.type !== 'opening').map((event) => ({ kind: 'Inventory', time: event.at, title: `${event.itemName || event.productName} · ${EVENT_LABELS[event.type] || event.type}`, detail: [event.type === 'count' ? `Estimated ${formatNumber(event.estimatedBefore)}, counted ${formatNumber(event.countedValue)} (${event.quantity > 0 ? '+' : ''}${formatNumber(event.quantity)})` : typeof event.quantity === 'number' ? `${event.quantity > 0 ? '+' : ''}${formatNumber(event.quantity)}` : event.usage?.map((use) => `${use.quantity} ${use.unit} ${use.itemName}`).join(', '), event.reason, event.note, event.countedBy && `counted by ${event.countedBy}`, event.by && `by ${event.by}`].filter(Boolean).join(' · ') })),
    ...state.countSessions.map((session) => ({ kind: 'Count', time: session.reviewedAt || session.submittedAt, title: `Physical count · ${session.status}`, detail: `${Object.keys(session.counts).length} items · counted by ${session.countedBy || 'not given'}${session.reviewedBy ? ` · reviewed by ${session.reviewedBy}` : ''}` })),
    ...state.recipes.filter((recipe) => recipe.savedBy).map((recipe) => ({ kind: 'Recipe', time: recipe.effectiveFrom, title: `${recipe.name} · ${prettyTemperature(recipe.temperature)} · ${recipe.versionLabel}`, detail: `${recipe.changeNote} · by ${recipe.savedBy}` })),
  ].sort((a, b) => b.time.localeCompare(a.time)), [state]);
  const shown = records.filter((record) => filter === 'all' || record.kind === filter);
  return <>
    <SectionHeading title="History" description="Everything recorded on this iPad. Nothing is deleted; undone sales are kept and marked." />
    <div className="filter-chips">{['all', 'Sale', 'Inventory', 'Count', 'Recipe'].map((name) => <button key={name} className={`chip ${filter === name ? 'selected' : ''}`} onClick={() => setFilter(name)}>{name === 'all' ? 'All' : `${name}s`}</button>)}</div>
    {!shown.length ? <div className="empty-state"><CupLogo size={54} /><h3>No activity yet</h3><p>Sales, inventory events, counts, and recipe changes will appear here.</p></div>
      : <div className="history-list">{shown.slice(0, limit).map((record, index) => <div className={`history-row ${record.voided ? 'voided' : ''}`} key={`${record.kind}-${record.time}-${index}`}><span className="history-kind">{record.kind}</span><span><strong>{record.title}</strong><small>{record.detail}</small></span><time>{timeLabel(record.time)}</time></div>)}
        {shown.length > limit && <button className="button secondary full-button" onClick={() => setLimit(limit + 150)}>Show more</button>}</div>}
  </>;
}
