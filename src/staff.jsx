import React, { useEffect, useMemo, useState } from 'react';
import { AlertIcon, BackIcon, ClipboardIcon, DownIcon, DownloadIcon, EditIcon, HeatIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon, SnowIcon, UpIcon, CupLogo } from './icons';
import { createPortal } from 'react-dom';
import { hashPin, storageStatus, uid } from './storage';
import { dateStamp, fullBackupText, parseFullBackup, salesCsvRows, saveFile, toCsv } from './backup';
import { INVENTORY_CATEGORIES, SHOP_HOURS, SPECIAL_MENU_ID, optionLabel } from './data';
import { ESTIMATE_LABELS, MEASURES, bakeryReport, finalizedCounts, overUnderReport, reorderList, busyTimes, clockLabel, currentRecipe, estimateUsage, formatNumber, formatRange, inventoryBalances, lineQuantity, onOpenDay, recipeHistory, weekStart, weeklyReport } from './estimates';
import { Brand, Credit, Modal, SectionHeading, dayLabel, menuItemFor, oneLine, prettyTemperature, productLabel, productName, timeLabel } from './ui';

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
      {tab === 'reports' && <ReportsTab state={state} setState={setState} staffName={staffName} />}
      {tab === 'history' && <HistoryTab state={state} />}
      <Credit />
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
    <MonthlySpecial state={state} setState={setState} />
    {flagged > 0 && <div className="review-notice"><AlertIcon size={21} />{flagged} names or details are flagged for review. Workbook names are kept as source names; changing the button name never changes past sales.</div>}
    <div className="data-list product-list">
      <div className="data-row data-head"><span>Product</span><span>Variants</span><span>Status</span><span>Order</span><span>Actions</span></div>
      {items.map((menuItem) => {
        const variants = state.products.filter((product) => product.menuItemId === menuItem.id);
        return <div className={`data-row ${menuItem.active ? '' : 'row-inactive'}`} key={menuItem.id}>
          <span><strong>{menuItem.id === SPECIAL_MENU_ID ? productName(state, { menuItemId: SPECIAL_MENU_ID }) : oneLine(menuItem.name)}</strong>{menuItem.reviewNote && <small className="warning-text">{menuItem.reviewNote}</small>}</span>
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

// The flavor name changes each month; the recipe and inventory item stay the same,
// and past sales keep the name they were sold under.
function MonthlySpecial({ state, setState }) {
  const offered = state.menuItems.some((entry) => entry.id === SPECIAL_MENU_ID && entry.active);
  return <label className="special-setting"><span><strong>Monthly special flavor</strong><small>{offered ? 'Names the Monthly Special button on the sales screen. Change it at the start of each month; past sales keep the flavor they were sold as. It uses the Monthly Special Syrup inventory item.' : 'The Monthly Special button is turned off. Reactivate it in the list below to offer the special.'}</small></span>
    <input value={state.settings?.monthlySpecial || ''} placeholder="e.g. Pumpkin Spice" onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, monthlySpecial: event.target.value } }))} aria-label="Monthly special flavor" />
  </label>;
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
const UNITS = ['', 'each', 'shot', 'pump', 'oz', 'Tbs', 'g', 'scoop'];

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
    <div className="recipe-summary"><AlertIcon size={23} /><div><strong>{ready} of {recipes.length} recipes ready for full ingredient estimates</strong><span>Recipes come from the Pinckney Panther recipe cards and the Oct 2026 setup worksheets. Tap a drink to change syrup pumps or anything else; each change is saved as a new version. Sales are never blocked by missing recipe details.</span></div></div>
    <div className="recipe-list">
      {recipes.map((recipe) => {
        const estimate = statuses[recipe.recipeKey];
        const linked = state.products.filter((product) => product.recipeKey === recipe.recipeKey);
        return <article className="recipe-row" key={recipe.versionId}>
          <button className="recipe-row-main" onClick={() => setOpen(open === recipe.recipeKey ? null : recipe.recipeKey)} aria-expanded={open === recipe.recipeKey}>
            <TempMark temperature={recipe.temperature} />
            <span><strong>{recipe.name}</strong><small>{recipe.temperature === 'none' ? 'Food' : `${prettyTemperature(recipe.temperature)} · ${[recipe.cupSize, recipe.cupType].filter(Boolean).join(' ') || 'Cup not set'}`} · {recipe.sourceCard || 'No source card'}</small></span>
            <span>{recipe.versionLabel}</span>
            <span><StatusPill status={estimate.status} />{estimate.gaps.length > 0 && <small>{estimate.gaps.length} details needed</small>}</span>
            <DownIcon />
          </button>
          <div className="recipe-row-actions">
            {recipe.lines.some((line) => line.unit === 'pump') && <button className="text-action" onClick={() => setEditingPumps(recipe)}><EditIcon size={18} /> Pumps</button>}
            <button className="text-action" onClick={() => setEditing({ recipe })}><EditIcon size={18} /> Edit</button>
          </div>
          {open === recipe.recipeKey && <RecipeDetail state={state} recipe={recipe} estimate={estimate} linked={linked} onEdit={() => setEditing({ recipe })} onEditPumps={() => setEditingPumps(recipe)} />}
        </article>;
      })}
    </div>
    {unlinked.length > 0 && <>
      <h3 className="subheading">Products without a recipe</h3>
      <p className="subheading-help">These still record sales normally. They are marked “Not configured” for ingredient estimates.</p>
      <div className="data-list">{unlinked.map((product) => <div className="data-row simple-row" key={product.id}><span><strong>{productLabel(state, product)}</strong><small>{product.sourceName}</small></span><span><button className="text-action" onClick={() => createFor(product)}><PlusIcon size={18} /> Create recipe</button></span></div>)}</div>
    </>}
    {editing && <RecipeEditor state={state} recipe={editing.recipe} options={recipeOptions(state, editing.recipe.recipeKey, editing.linkProductId)} onSave={(draft) => save([draft], editing.linkProductId)} onClose={() => setEditing(null)} />}
    {editingPumps && <PumpEditor state={state} recipe={editingPumps} onSave={(drafts) => save(drafts)} onClose={() => setEditingPumps(null)} />}
  </>;
}

// The sale choices (e.g. flavors) offered by the products this recipe is sold as.
const recipeOptions = (state, recipeKey, productId) => [...new Set(state.products.filter((product) => product.recipeKey === recipeKey || product.id === productId).flatMap((product) => product.options || []))];
const optionNote = (line) => line.forOptions?.length ? `Only for ${line.forOptions.join(', ')}` : '';

function RecipeDetail({ state, recipe, estimate, linked, onEdit, onEditPumps }) {
  const itemName = (id) => state.inventory.find((item) => item.id === id)?.name;
  const history = recipeHistory(state.recipes, recipe.recipeKey);
  return <div className="recipe-detail">
    <dl>
      {recipe.temperature !== 'none' && <>
        <div><dt>Cup</dt><dd>{[recipe.cupSize, recipe.cupType].filter(Boolean).join(' ') || 'Not set'}</dd></div>
        <div><dt>Espresso</dt><dd>{recipe.espressoShots != null ? `${recipe.espressoShots} shots` : 'Not set'}</dd></div>
      </>}
      <div><dt>Source</dt><dd>{recipe.sourceCard || '—'}</dd></div>
      <div><dt>Sold as</dt><dd>{linked.map((product) => product.sourceName).join('; ') || 'Not linked to a product'}</dd></div>
    </dl>
    <table className="line-table">
      <thead><tr><th>Ingredient</th><th>Card amount</th><th>Used for inventory</th><th>Inventory item</th></tr></thead>
      <tbody>{recipe.lines.map((line) => <tr key={line.id} className={line.excluded ? 'excluded' : ''}>
        <td><strong>{line.label}</strong><small>{[ROLE_LABELS[line.role], optionNote(line), line.note].filter(Boolean).join(' · ')}</small></td>
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
  const [rows, setRows] = useState(() => recipe.lines.filter((line) => line.unit === 'pump').map((line) => ({ label: line.label, itemId: line.itemId, count: line.amount?.min ?? 0, original: line.amount?.min ?? 0, forOptions: line.forOptions })));
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
          <span><strong>{row.label}</strong><small>{[row.added ? 'New' : `Was ${row.original}`, row.forOptions?.length ? `for ${row.forOptions.join(', ')}` : ''].filter(Boolean).join(' · ')}</small></span>
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

function RecipeEditor({ state, recipe, options = [], onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({ ...JSON.parse(JSON.stringify(recipe)), versionLabel: `v${recipe.version + 1}`, changeNote: '' }));
  const setLine = (id, patch) => setDraft((current) => ({ ...current, lines: current.lines.map((line) => line.id === id ? { ...line, ...patch } : line) }));
  const setAmount = (line, key, value) => setLine(line.id, { amount: { ...(line.amount || { min: null, max: null }), [key]: numberOrNull(value) } });
  const addLine = () => setDraft((current) => ({ ...current, lines: [...current.lines, { id: uid('line'), role: 'other', label: '', amount: null, unit: '', calcAmount: null, itemId: null, itemConfirmed: false, ozPerPump: null, excluded: false, note: '' }] }));
  const removeLine = (id) => setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) }));
  const [limiting, setLimiting] = useState(() => new Set());
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
          {options.length > 0 && !line.forOptions?.length && !limiting.has(line.id) && <button type="button" className="text-action option-toggle" onClick={() => setLimiting((current) => new Set(current).add(line.id))}>Used for every sale · Limit to certain choices</button>}
          {options.length > 0 && (line.forOptions?.length > 0 || limiting.has(line.id)) && <div className="line-editor-row option-row">
            <span>Used for:</span>
            <button type="button" className={`chip ${!line.forOptions?.length ? 'selected' : ''}`} onClick={() => setLine(line.id, { forOptions: [] })}>Every sale</button>
            {options.map((option) => {
              const on = !!line.forOptions?.includes(option);
              return <button type="button" key={option} className={`chip ${on ? 'selected' : ''}`} aria-pressed={on} onClick={() => setLine(line.id, { forOptions: on ? line.forOptions.filter((entry) => entry !== option) : [...(line.forOptions || []), option] })}>{option}</button>;
            })}
          </div>}
          {line.note && <small className="field-help">{line.note}</small>}
        </div>;
      })}</div>
      <button type="button" className="button secondary" onClick={addLine}><PlusIcon size={20} /> Add ingredient or supply</button>
      <label>Preparation instructions<textarea rows="3" value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} /></label>
      <div className="form-grid">
        <label>Version label<input required value={draft.versionLabel} onChange={(event) => setDraft({ ...draft, versionLabel: event.target.value })} /></label>
        <label>What changed<input required value={draft.changeNote} onChange={(event) => setDraft({ ...draft, changeNote: event.target.value })} placeholder="e.g. Updated card; chose 9 oz milk standard" /></label>
      </div>
      <div className={`estimate-preview ${preview.status}`}><StatusPill status={preview.status} />{preview.usage.length > 0 && <span>{draft.lines.some((line) => line.forOptions?.length) ? 'Every sale, before choices' : 'Each sale'}: {preview.usage.map((use) => `${formatNumber(use.quantity)} ${use.unit} ${use.itemName}`).join(' · ')}</span>}{preview.gaps.length > 0 && <ul>{preview.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>}</div>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary">Save new version</button></div>
    </form>
  </Modal>;
}

/* ---------- Inventory ---------- */

const EVENT_LABELS = { opening: 'Opening balance', count: 'Physical count reconciled', restock: 'Restock', waste: 'Waste', spill: 'Spill', adjustment: 'Adjustment', remake: 'Drink remake', 'drink-waste': 'Drink wasted', 'bakery-excess': 'Excess bakery items (to staff)' };
// Reasons are optional notes on why a count differs from the estimate. Each one starts
// filled in, so a reviewer only changes the ones they know more about.
const FIRST_COUNT = 'Starting count';
const NO_REASON = 'Use the count (no reason)';
const COUNT_REASONS = ['Matches estimate', FIRST_COUNT, NO_REASON, 'Unrecorded waste or spill', 'Unrecorded restock', 'Recipe estimate differs from actual use', 'Earlier count was wrong', 'Other'];
const defaultReason = (balance, difference) => !balance.lastCountAt ? FIRST_COUNT : difference === 0 ? COUNT_REASONS[0] : NO_REASON;
const unitLabel = (item) => item.countUnit || 'source unit';

function InventoryTab({ state, setState, staffName, onStartCount }) {
  const [eventItem, setEventItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const unitsReady = state.inventory.filter((item) => item.active && unitsComplete(item, measuredUnits(state))).length;
  const activeItems = state.inventory.filter((item) => item.active).length;
  const [drinkEvent, setDrinkEvent] = useState(false);
  const [bakeryEvent, setBakeryEvent] = useState(false);
  const [delivery, setDelivery] = useState(false);
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
      <button className="button secondary" onClick={() => setDelivery(true)}><PlusIcon size={20} /> Record delivery</button>
      <button className="button secondary" onClick={() => setDrinkEvent(true)}>Drink remake / waste</button>
      <button className="button secondary" onClick={() => setBakeryEvent(true)}>Excess bakery items</button>
      <button className="button secondary" onClick={() => setEditingItem({ id: uid('item'), name: '', sourceName: '', category: INVENTORY_CATEGORIES[0], full: 0, onHand: 0, need: 0, countUnit: '', usageUnit: '', usagePerCount: null, ozPerPump: null, active: true, note: '' })}><PlusIcon size={20} /> Add item</button>
      <button className="button primary" onClick={onStartCount}><ClipboardIcon size={20} /> Start count</button>
    </>} />
    <div className={`units-banner ${unitsReady === activeItems ? 'done' : ''}`}><div><strong>Units & sizes set for {unitsReady} of {activeItems} items</strong><span>What each item is counted in (gallon, can, bottle) and how much it holds. Estimates can only subtract recipe usage from items that are set up.</span></div><button className="button primary" onClick={() => setUnitsOpen(true)}>Units & sizes</button></div>
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
              <span className={low ? 'low-stock' : ''}><strong>{formatNumber(balance.estimate)}</strong>{low && <small>Need {formatNumber(Math.round((item.full - balance.estimate) * 100) / 100)} more to reach par</small>}</span>
              <span><small>{balance.lastCountAt ? timeLabel(balance.lastCountAt) : 'Workbook only'}</small></span>
              <span><small>{unitLabel(item)}{item.usageUnit && item.usagePerCount ? ` = ${formatNumber(item.usagePerCount)} ${item.usageUnit}` : ''}{item.ozPerPump ? ` · ${item.ozPerPump} oz/pump` : ''}</small></span>
              <span className="row-actions"><button onClick={() => setEventItem(item)}><PlusIcon size={18} /> Event</button><button onClick={() => setEditingItem(item)}><EditIcon /> Edit</button></span>
            </div>;
          })}
        </div>
      </section>;
    })}
    {eventItem && <InventoryEventEditor item={eventItem} onClose={() => setEventItem(null)} onSave={(event) => { addEvents([{ ...event, by: staffName }]); setEventItem(null); }} />}
    {unitsOpen && <UnitsSetup state={state} onClose={() => setUnitsOpen(false)} onSave={(updates) => { setState((current) => ({ ...current, inventory: current.inventory.map((item) => updates[item.id] ? { ...item, ...updates[item.id] } : item) })); setUnitsOpen(false); }} />}
    {editingItem && <ItemEditor item={editingItem} isNew={!state.inventory.some((entry) => entry.id === editingItem.id)} onSave={saveItem} onClose={() => setEditingItem(null)} />}
    {delivery && <DeliveryEditor state={state} onClose={() => setDelivery(false)} onSave={(events) => { addEvents(events.map((event) => ({ ...event, by: staffName }))); setDelivery(false); }} />}
    {bakeryEvent && <BakeryExcessEditor onClose={() => setBakeryEvent(false)} onSave={(event) => { addEvents([{ ...event, by: staffName }]); setBakeryEvent(false); }} />}
    {drinkEvent && <DrinkEventEditor state={state} onClose={() => setDrinkEvent(false)} onSave={(event) => { addEvents([{ ...event, by: staffName }]); setDrinkEvent(false); }} />}
    {reviewing && <CountReview state={state} session={reviewing} balances={balances} staffName={staffName} onClose={() => setReviewing(null)} onFinish={(events, status) => {
      const now = new Date().toISOString();
      setState((current) => ({ ...current, inventoryEvents: [...current.inventoryEvents, ...events], countSessions: current.countSessions.map((session) => session.id === reviewing.id ? { ...session, status, reviewedAt: now, reviewedBy: staffName } : session) }));
      setReviewing(null);
    }} />}
  </>;
}

// Items that recipes measure in pumps need a measured pump volume as well.
// Which per-item conversions (pump, shot, Tbs) each item needs, from the current recipes.
const MEASURE_LABELS = { pump: 'oz per pump', shot: 'oz grounds per shot', Tbs: 'oz per Tbs' };
function measuredUnits(state) {
  const units = new Map();
  for (const entry of state.recipes.filter((recipe) => !recipe.supersededAt).flatMap((recipe) => recipe.lines)) {
    if (!entry.itemId || !MEASURES[entry.unit] || entry.excluded) continue;
    units.set(entry.itemId, new Set([...(units.get(entry.itemId) || []), entry.unit]));
  }
  for (const item of state.inventory) if (item.category === 'Syrups & sauces') units.set(item.id, new Set([...(units.get(item.id) || []), 'pump']));
  return units;
}
const unitsComplete = (item, measured) => !!item.countUnit && !!item.usageUnit && item.usagePerCount > 0
  && [...(measured.get(item.id) || [])].every((unit) => item.usageUnit === unit || item[MEASURES[unit].field] > 0);
const COUNT_UNITS = ['gallon', 'half gallon', 'quart', 'bottle', 'can', 'jar', 'bag', 'box', 'sleeve', 'pack', 'case', 'roll', 'each'];

// One screen for every item's package size, so setup does not take 39 separate edits.
function UnitsSetup({ state, onSave, onClose }) {
  const measured = useMemo(() => measuredUnits(state), [state]);
  const inRecipes = useMemo(() => new Set(state.recipes.filter((recipe) => !recipe.supersededAt).flatMap((recipe) => recipe.lines).map((line) => line.itemId).filter(Boolean)), [state]);
  const items = state.inventory.filter((item) => item.active);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(items.map((item) => [item.id, { countUnit: item.countUnit, usageUnit: item.usageUnit || 'oz', usagePerCount: item.usagePerCount ?? '', ...Object.fromEntries(Object.values(MEASURES).map(({ field }) => [field, item[field] ?? ''])) }])));
  const [onlyRecipes, setOnlyRecipes] = useState(false);
  const set = (id, patch) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const save = () => onSave(Object.fromEntries(Object.entries(drafts).map(([id, draft]) => [id, { countUnit: draft.countUnit.trim(), usageUnit: draft.countUnit.trim() ? draft.usageUnit : '', usagePerCount: numberOrNull(String(draft.usagePerCount)), ...Object.fromEntries(Object.values(MEASURES).map(({ field }) => [field, numberOrNull(String(draft[field]))])) }])));
  const shown = items.filter((item) => !onlyRecipes || inRecipes.has(item.id));
  const done = items.filter((item) => unitsComplete({ ...item, ...drafts[item.id], usagePerCount: Number(drafts[item.id].usagePerCount), ...Object.fromEntries(Object.values(MEASURES).map(({ field }) => [field, Number(drafts[item.id][field])])) }, measured)).length;
  return <Modal title="Units & sizes" onClose={onClose} wide>
    <p className="field-help">For each item, enter what you count it in and how much one holds, the way recipes measure it. Examples: Whole Milk, 1 gallon = 128 oz · Whip, 1 can = 10 oz · a 750 mL syrup bottle = 25.4 oz · Hot cups, 1 sleeve = 50 each · Coffee, 1 bag = 18 oz, and oz of ground coffee per espresso shot (18 g = 0.63 oz). Leave anything you don't know yet blank.</p>
    <div className="units-toolbar"><strong>{done} of {items.length} complete</strong><label className="check-label"><input type="checkbox" checked={onlyRecipes} onChange={(event) => setOnlyRecipes(event.target.checked)} /> Only items used in recipes</label></div>
    <datalist id="count-units">{COUNT_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
    <div className="units-table">
      <div className="units-row units-head"><span>Item</span><span>Counted in</span><span>One holds</span><span>Conversions</span></div>
      {shown.map((item) => {
        const draft = drafts[item.id];
        return <div className="units-row" key={item.id}>
          <span><strong>{item.name}</strong><small>{item.category}{inRecipes.has(item.id) ? ' · used in recipes' : ''}</small></span>
          <span><input list="count-units" value={draft.countUnit} onChange={(event) => set(item.id, { countUnit: event.target.value })} placeholder="choose or type" aria-label={`${item.name} counted in`} /></span>
          <span className="holds"><input type="number" step="any" min="0" value={draft.usagePerCount} onChange={(event) => set(item.id, { usagePerCount: event.target.value })} aria-label={`Amount in one ${draft.countUnit || 'unit'} of ${item.name}`} /><select value={draft.usageUnit} onChange={(event) => set(item.id, { usageUnit: event.target.value })} aria-label={`${item.name} size unit`}>{UNITS.filter(Boolean).filter((unit) => unit !== 'pump').map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></span>
          <span className="conversions">{measured.has(item.id) ? [...measured.get(item.id)].map((unit) => <label key={unit}><input type="number" step="any" min="0" value={draft[MEASURES[unit].field]} onChange={(event) => set(item.id, { [MEASURES[unit].field]: event.target.value })} aria-label={`${item.name} ${MEASURE_LABELS[unit]}`} /><small>{MEASURE_LABELS[unit]}</small></label>) : <small>—</small>}</span>
        </div>;
      })}
    </div>
    <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="button" className="button primary" onClick={save}>Save units</button></div>
  </Modal>;
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
        <label>Ounces of ground coffee per espresso shot<input type="number" step="any" min="0" value={draft.ozPerShot ?? ''} onChange={(event) => set({ ozPerShot: numberOrNull(event.target.value) })} placeholder="Coffee only; e.g. 0.63 for 18 g" /></label>
        <label>Ounces per tablespoon<input type="number" step="any" min="0" value={draft.ozPerTbs ?? ''} onChange={(event) => set({ ozPerTbs: numberOrNull(event.target.value) })} placeholder="Toppings measured in Tbs; e.g. 0.09 for whipped cream" /></label>
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

// A delivery from a packing slip: enter only what arrived. Each line is a restock that adds
// to the estimate; nothing else is counted or changed.
function DeliveryEditor({ state, onClose, onSave }) {
  const items = state.inventory.filter((item) => item.active);
  const [amounts, setAmounts] = useState({});
  const [note, setNote] = useState('');
  const [find, setFind] = useState('');
  const entered = Object.entries(amounts).filter(([, value]) => Number(value) > 0);
  const step = (id, delta) => setAmounts((current) => ({ ...current, [id]: String(Math.max(0, (Number(current[id]) || 0) + delta)) }));
  const shown = items.filter((item) => item.name.toLowerCase().includes(find.trim().toLowerCase()));
  const categories = [...INVENTORY_CATEGORIES, ...new Set(items.map((item) => item.category).filter((category) => !INVENTORY_CATEGORIES.includes(category)))];
  const submit = (event) => {
    event.preventDefault();
    const at = new Date().toISOString();
    const deliveryId = uid('delivery');
    onSave(entered.map(([id, value]) => {
      const item = items.find((entry) => entry.id === id);
      return { id: uid('event'), type: 'restock', deliveryId, itemId: id, itemName: item.name, quantity: Number(value), at, note: note.trim() ? `Delivery: ${note.trim()}` : 'Delivery' };
    }));
  };
  return <Modal title="Record delivery" onClose={onClose} wide>
    <form className="stack-form" onSubmit={submit}>
      <p className="field-help">Enter what arrived from the packing slip. Leave everything else blank. Each item is added to its estimate as a restock; nothing is counted and nothing else changes. Enter amounts in the unit each item is counted in.</p>
      <div className="form-grid">
        <label>Packing slip or supplier (optional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example, Sysco order 4521" /></label>
        <label>Find an item<input type="search" value={find} onChange={(event) => setFind(event.target.value)} placeholder="Type part of a name" /></label>
      </div>
      {categories.map((category) => {
        const group = shown.filter((item) => item.category === category);
        if (!group.length) return null;
        return <section key={category} className="count-group"><h3>{category}</h3><div className="count-grid">
          {group.map((item) => <div className={`count-row ${Number(amounts[item.id]) > 0 ? 'delivery-entered' : ''}`} key={item.id}>
            <span><strong>{item.name}</strong><small>Enter in: {item.countUnit || 'same unit as the inventory sheet'}{item.usagePerCount > 1 && item.usageUnit ? ` (1 ${item.countUnit} = ${formatNumber(item.usagePerCount)} ${item.usageUnit})` : ''}</small></span>
            <div className="stepper">
              <button type="button" onClick={() => step(item.id, -1)} aria-label={`One less ${item.name}`}><MinusIcon size={22} /></button>
              <input inputMode="decimal" type="number" step="any" min="0" value={amounts[item.id] || ''} onChange={(event) => setAmounts({ ...amounts, [item.id]: event.target.value })} aria-label={`${item.name} received`} placeholder="—" />
              <button type="button" onClick={() => step(item.id, 1)} aria-label={`One more ${item.name}`}><PlusIcon size={22} /></button>
            </div>
          </div>)}
        </div></section>;
      })}
      <div className="form-actions delivery-actions"><span>{entered.length} {entered.length === 1 ? 'item' : 'items'} entered</span><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!entered.length}>Add delivery to inventory</button></div>
    </form>
  </Modal>;
}

// Unsold bakery items moved to the staff offer, so they are no longer for sale.
function BakeryExcessEditor({ onClose, onSave }) {
  const [count, setCount] = useState('');
  const [forDate, setForDate] = useState(() => dateStamp());
  const [note, setNote] = useState('');
  const valid = Number(count) > 0 && forDate;
  const submit = (event) => {
    event.preventDefault();
    onSave({ id: uid('event'), type: 'bakery-excess', productName: 'Bakery items', count: Number(count), forDate, at: new Date().toISOString(), note });
  };
  return <Modal title="Excess bakery items" onClose={onClose}>
    <form className="stack-form" onSubmit={submit}>
      <p className="field-help">How many bakery items were left over and moved to the staff offer, so they won't be sold. Reports shows this next to bakery sales to help decide how many to make each day.</p>
      <label>How many items<div className="stepper">
        <button type="button" onClick={() => setCount(String(Math.max(0, (Number(count) || 0) - 1)))} aria-label="One less"><MinusIcon size={22} /></button>
        <input autoFocus inputMode="numeric" type="number" min="0" step="1" value={count} onChange={(event) => setCount(event.target.value)} aria-label="How many items" placeholder="0" />
        <button type="button" onClick={() => setCount(String((Number(count) || 0) + 1))} aria-label="One more"><PlusIcon size={22} /></button>
      </div></label>
      <label>Made on<input type="date" value={forDate} onChange={(event) => setForDate(event.target.value)} /></label>
      <label>Note (optional)<textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example, which items" /></label>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!valid}>Record</button></div>
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
  const [decisions, setDecisions] = useState(() => Object.fromEntries(rows.map((row) => [row.item.id, { include: true, reason: defaultReason(balances[row.item.id], row.difference) }])));
  const [note, setNote] = useState('');
  const set = (id, patch) => setDecisions((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const finalize = () => {
    const at = new Date().toISOString();
    onFinish(rows.filter((row) => decisions[row.item.id].include).map((row) => ({
      id: uid('event'), type: 'count', itemId: row.item.id, itemName: row.item.name, countedValue: row.counted, estimatedBefore: row.estimated, quantity: row.difference,
      reason: decisions[row.item.id].reason, note, countSessionId: session.id, countedBy: session.countedBy, by: staffName, at,
    })), 'finalized');
  };
  return <Modal title={`Review count from ${session.countedBy || 'a student'}`} onClose={onClose} wide>
    <p className="field-help">Submitted {timeLabel(session.submittedAt)}. Accepted counts replace the estimated balance. A reason is filled in for every item; change one only if you know why a count is off (for example, an unrecorded restock). Items never counted before are marked Starting count. Uncheck any item that should be recounted.</p>
    <div className="review-table">
      <div className="review-row review-head"><span>Use</span><span>Item</span><span>Estimated</span><span>Counted</span><span>Difference</span><span>Reason</span></div>
      {rows.map(({ item, counted, estimated, difference }) => <div className="review-row" key={item.id}>
        <span><input type="checkbox" aria-label={`Accept count for ${item.name}`} checked={decisions[item.id].include} onChange={(event) => set(item.id, { include: event.target.checked })} /></span>
        <span><strong>{item.name}</strong><small>{unitLabel(item)}</small></span>
        <span>{formatNumber(estimated)}</span>
        <span><strong>{formatNumber(counted)}</strong></span>
        <span className={difference < 0 ? 'negative' : difference > 0 ? 'positive' : ''}>{difference > 0 ? '+' : ''}{formatNumber(difference)}</span>
        <span><select value={decisions[item.id].reason} disabled={!decisions[item.id].include} onChange={(event) => set(item.id, { reason: event.target.value })} aria-label={`Reason for ${item.name}`}>{COUNT_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></span>
      </div>)}
    </div>
    <div className="stack-form">
      <label>Reviewer note<textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="form-actions"><button type="button" className="button secondary danger-text" onClick={() => onFinish([], 'discarded')}>Discard count</button><button type="button" className="button secondary" onClick={onClose}>Later</button><button type="button" className="button primary" onClick={finalize}>Finalize accepted counts</button></div>
    </div>
  </Modal>;
}

/* ---------- Reports ---------- */

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ReportsTab({ state, setState, staffName }) {
  const [start, setStart] = useState(() => weekStart(new Date()));
  const report = useMemo(() => weeklyReport(state, start), [state, start]);
  const shift = (weeks) => setStart((current) => { const next = new Date(current); next.setDate(next.getDate() + weeks * 7); return next; });
  const showDays = WEEKDAYS.map((_, index) => SHOP_HOURS.days.includes(index));
  const dates = WEEKDAYS.map((_, index) => { const date = new Date(report.start); date.setDate(date.getDate() + index); return date; });
  const totals = WEEKDAYS.map((_, index) => report.rows.reduce((sum, row) => sum + row.days[index], 0));
  const revenue = report.sales.reduce((sum, sale) => sum + (sale.price || 0), 0);
  const exportCsv = () => saveFile(`empowering-brew-sales-week-of-${dateStamp(report.start)}.csv`, toCsv(salesCsvRows(report.sales)), 'text/csv');
  const sections = useOpenReports();
  const weekNav = <div className="week-nav"><button className="button secondary" onClick={() => shift(-1)}><BackIcon size={20} /> Previous</button><strong>Week of {dayLabel(report.start)}</strong><button className="button secondary" onClick={() => shift(1)}>Next <span className="flip"><BackIcon size={20} /></span></button></div>;
  const allOpen = sections.open.length === REPORT_IDS.length;
  return <>
    <BackupPanel state={state} setState={setState} />
    <PinPanel state={state} setState={setState} staffName={staffName} />
    <div className="report-list-head"><h2>Reports</h2><button className="button secondary" onClick={() => sections.setOpen(allOpen ? [] : REPORT_IDS)}>{allOpen ? 'Close all' : 'Open all'}</button></div>
    <ReorderList state={state} section={sections.props('reorder')} />
    <OverUnder state={state} section={sections.props('over-under')} />
    <ReportSection {...sections.props('sales')} title="Weekly sales" summary={`Week of ${dayLabel(report.start)} · ${report.sales.length} sold · $${revenue.toFixed(2)}`} description="Same layout as the Empowering Brew Weekly Coffee Sales sheet. Hot and iced are counted separately. Open days only (Mon, Tue, Thu, Fri); sales on closed days are left out." action={<button className="button secondary" onClick={exportCsv} disabled={!report.sales.length}><DownloadIcon size={20} /> Export CSV</button>}>
    {weekNav}
    <div className="stat-row"><div><span>Drinks and treats sold</span><strong>{report.sales.length}</strong></div><div><span>Sales at menu price</span><strong>${revenue.toFixed(2)}</strong></div><div><span>Free student drinks</span><strong>{report.sales.filter((sale) => sale.studentDrink).length}</strong></div><div><span>Sales without a complete estimate</span><strong>{report.withoutFullEstimate}</strong></div></div>
    <div className="table-scroll"><table className="report-table">
      <thead><tr><th>Product</th>{WEEKDAYS.map((day, index) => showDays[index] && <th key={day}>{day}<small>{dayLabel(dates[index])}</small></th>)}<th>Total</th></tr></thead>
      <tbody>{report.rows.map((row) => <tr key={row.product.id}><td><span className={`temp-dot ${row.product.temperature}`} />{productLabel(state, row.product)}</td>{row.days.map((count, index) => showDays[index] && <td key={index}>{count || ''}</td>)}<td><strong>{row.total}</strong></td></tr>)}</tbody>
      <tfoot><tr><td>Total</td>{totals.map((count, index) => showDays[index] && <td key={index}>{count}</td>)}<td>{report.sales.length}</td></tr></tfoot>
    </table></div>
    <h3 className="subheading">Estimated ingredient usage this week</h3>
    {report.usage.length ? <div className="data-list">{report.usage.map((use) => <div className="data-row simple-row" key={`${use.itemName}-${use.unit}`}><span><strong>{use.itemName}</strong></span><span>{formatNumber(use.quantity)} {use.unit}</span></div>)}</div>
      : <p className="subheading-help">No usage estimated yet. Usage appears once recipes have confirmed inventory items, standard amounts, and measured pump volumes.</p>}
    </ReportSection>
    <BakeryTable state={state} report={report} showDays={showDays} weekNav={weekNav} section={sections.props('bakery')} />
    <BusyTimes state={state} section={sections.props('busy')} />
  </>;
}

// Reports fold up so the page stays short. Which ones are open is remembered on this iPad only.
const REPORT_IDS = ['reorder', 'over-under', 'sales', 'bakery', 'busy'];
const OPEN_REPORTS_KEY = 'empowering-brew-open-reports';
function useOpenReports() {
  const [open, setOpen] = useState(() => { try { return JSON.parse(localStorage.getItem(OPEN_REPORTS_KEY)) || []; } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(OPEN_REPORTS_KEY, JSON.stringify(open)); } catch { /* private browsing: just don't remember */ } }, [open]);
  const toggle = (id) => setOpen((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  return { open, setOpen, props: (id) => ({ id, open: open.includes(id), onToggle: () => toggle(id) }) };
}

function ReportSection({ id, title, summary, description, action, open, onToggle, children }) {
  return <section className={`report-section ${open ? 'open' : ''}`}>
    <button type="button" className="report-section-toggle" aria-expanded={open} aria-controls={`report-${id}`} onClick={onToggle}>
      <span className="report-section-arrow" aria-hidden="true"><DownIcon size={26} /></span>
      <span className="report-section-title"><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
    </button>
    {open && <div className="report-section-body" id={`report-${id}`}>
      {(description || action) && <div className="report-section-intro"><p>{description}</p>{action}</div>}
      {children}
    </div>}
  </section>;
}

// Everything below par, to download and send to whoever does the ordering.
function ReorderList({ state, section }) {
  const rows = useMemo(() => reorderList(state, INVENTORY_CATEGORIES), [state]);
  const download = () => saveFile(`empowering-brew-reorder-list-${dateStamp()}.csv`, toCsv([
    ['Empowering Brew reorder list', `Made ${timeLabel(new Date().toISOString())}`],
    [],
    ['Item', 'Category', 'Counted in', 'Par', 'Estimated on hand', 'Need to reach par', 'Order (whole units)', 'Last counted'],
    ...rows.map((row) => [row.item.name.trim(), row.item.category, row.item.countUnit, row.item.full, row.estimate, row.need, row.order, row.lastCountAt ? timeLabel(row.lastCountAt) : 'Not counted yet']),
  ]), 'text/csv');
  return <ReportSection {...section} title="Reorder list" summary={rows.length ? `${rows.length} ${rows.length === 1 ? 'item' : 'items'} below par` : 'Nothing below par'} description="Every item below par, from the Inventory estimates. Download it to email or share with whoever does the ordering. Order is the amount needed, rounded up to whole units." action={<button className="button secondary" onClick={download} disabled={!rows.length}><DownloadIcon size={20} /> Download reorder list</button>}>
    {rows.length ? <div className="table-scroll"><table className="report-table">
      <thead><tr><th>Item</th><th>Counted in</th><th>Par</th><th>On hand</th><th>Need</th><th>Order</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.item.id}><td>{row.item.name}<small className="reorder-category">{row.item.category}</small></td><td>{row.item.countUnit || '—'}</td><td>{formatNumber(row.item.full)}</td><td>{formatNumber(row.estimate)}</td><td>{formatNumber(row.need)}</td><td><strong>{row.order}</strong></td></tr>)}</tbody>
    </table></div> : <p className="subheading-help">Nothing is below par right now.</p>}
  </ReportSection>;
}

// Weekly over/under: run after the Wednesday count, then open the student report to print
// or go over on the iPad. Page 1 celebrates what went right or close; page 2 is a short
// list of things to work on, with a tip for each.
const STAFF_REASONS = ['Unrecorded waste or spill', 'Unrecorded restock', 'Recipe estimate differs from actual use', 'Earlier count was wrong', 'Other'];
const hundredths = (value) => Math.round(value * 100) / 100;
const weekdayDate = (iso) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(iso));
// "1 gallon", "2.5 bags", "3 boxes"; items counted one by one get just the number.
function amountText(value, unit) {
  const number = formatNumber(hundredths(Math.abs(value)));
  if (!unit || unit === 'each') return number;
  return `${number} ${Math.abs(hundredths(value)) === 1 ? unit : /(x|s|ch|sh)$/.test(unit) ? `${unit}es` : `${unit}s`}`;
}
// Close counts as a win; a likely missed delivery is always something to work on.
const isCelebration = (row) => !row.missedDelivery && (row.status === 'right' || ((row.status === 'more' || row.status === 'less') && row.close));
const isWorkOn = (row) => row.missedDelivery || ((row.status === 'more' || row.status === 'less') && !row.close);

const WORK_TIPS = {
  'Syrups & sauces': { more: 'Count the pumps. Use the recipe number every time.', less: 'Use every pump the recipe calls for. Customers can taste the difference!' },
  'Toppings & sweeteners': { more: 'Use the recipe amount of topping, not a little extra.', less: 'Add the full topping the recipe calls for. It’s part of what makes the drink special.' },
  'Milk & cream': { more: 'Pour only what the drink needs. Use the line on the pitcher or cup.', less: 'Fill to the recipe amount so every drink tastes right.' },
  'Coffee & bar': { more: 'Measure with the scoop every time.', less: 'Use the full recipe amount.' },
  count: { more: 'Tap every drink on the iPad, even when it’s busy. Enter remakes and spills too.', less: 'Tap a drink only once it’s ordered. Made a mistake? Tap Undo right away.' },
};
const TIP_GROUP = { whip: 'Toppings & sweeteners' }; // whipped topping is stored with milk but used like a topping
const COUNTED_CATEGORIES = ['Cups & to-go', 'Supplies'];

function workOnText(row) {
  const name = row.item.name.trim();
  if (row.missedDelivery) return { headline: `Did we forget to enter a delivery of ${name}?`, detail: 'We counted more than last week, but no delivery was entered.', tip: 'When a box comes in, use Record delivery with the packing slip.' };
  const counted = COUNTED_CATEGORIES.includes(row.item.category);
  const more = row.status === 'more';
  const headline = counted ? (more ? `Too many ${name}` : `Fewer ${name} than expected`) : (more ? `Too much ${name}` : `Not enough ${name}`);
  const unit = row.item.countUnit;
  const detail = `Recipes say ${amountText(row.expected, unit)}. We used ${amountText(row.actual, unit)}${row.percent != null ? ` (${row.percent}% ${more ? 'more' : 'less'})` : ''}.`;
  const tips = WORK_TIPS[counted ? 'count' : TIP_GROUP[row.item.id] || row.item.category] || WORK_TIPS.count;
  return { headline, detail, tip: tips[more ? 'more' : 'less'] };
}

// General encouragement for any coffee shop team. Three are picked each week so they change.
const AFFIRMATIONS = [
  'Every drink you make can brighten someone’s day.',
  'A smile and a thank-you are part of every order.',
  'Great teamwork keeps the line moving.',
  'Asking questions is how great baristas learn.',
  'Mistakes happen. Fixing them is what pros do.',
  'A clean station is a happy station.',
  'Showing up and doing your best matters.',
  'Customers remember how you made them feel.',
  'Following the recipe means every drink tastes just right.',
  'Helping a teammate makes the whole shop better.',
  'You are learning skills you can use at any job.',
  'Being careful with supplies helps the whole shop.',
  'Every week you get a little faster and a little better.',
  'Being friendly is the best ingredient.',
  'You make Empowering Brew a great place to visit.',
];
const weeklyAffirmations = (iso) => {
  const start = Math.floor(new Date(iso).getTime() / (7 * 86400000)) * 3;
  return [0, 1, 2].map((offset) => AFFIRMATIONS[(start + offset) % AFFIRMATIONS.length]);
};

function OverUnder({ state, section }) {
  const counts = useMemo(() => finalizedCounts(state), [state]);
  const [sessionId, setSessionId] = useState(null);
  const [open, setOpen] = useState(false);
  const chosen = counts.find((session) => session.id === sessionId) || counts[0];
  const report = useMemo(() => chosen && overUnderReport(state, chosen.id), [state, chosen]);
  const ready = report?.items.length > 0;
  const total = (test) => report?.items.filter(test).length || 0;
  return <ReportSection {...section} title="Weekly over/under" summary={ready ? `Count on ${weekdayDate(report.at)} · ${total(isCelebration)} to celebrate · ${total(isWorkOn)} to work on` : 'First report after the next weekly count'} description="Run it on Wednesday after the inventory count is finalized. For each item, it compares what we really used since the last count with what the recipes say the week’s sales used. The student report has two pages: Celebrations (right on track or close) and Things to Work On (with a tip for each). Go over it together on the iPad or print it." action={<button className="button primary" onClick={() => setOpen(true)} disabled={!ready}><ClipboardIcon size={20} /> Open student report</button>}>
    {counts.length > 1 && <label className="over-under-pick">Count<select value={chosen.id} onChange={(event) => setSessionId(event.target.value)}>{counts.map((session) => <option key={session.id} value={session.id}>{weekdayDate(session.at)}</option>)}</select></label>}
    {ready ? <div className="stat-row">
      <div><span>Right on track</span><strong>{total((row) => isCelebration(row) && row.status === 'right')}</strong></div>
      <div><span>Close (within 20%)</span><strong>{total((row) => isCelebration(row) && row.status !== 'right')}</strong></div>
      <div><span>Things to work on</span><strong>{total(isWorkOn)}</strong></div>
      <div><span>Possible missed deliveries</span><strong>{total((row) => row.missedDelivery)}</strong></div>
    </div> : <p className="subheading-help">{counts.length ? 'This count has nothing to compare yet: every item’s last count was the starting count. The first over/under report appears after the next weekly count is finalized.' : 'No inventory count has been finalized yet.'}</p>}
    {open && report && <OverUnderPage report={report} onClose={() => setOpen(false)} />}
  </ReportSection>;
}

const WORK_ON_SHOWN = 5; // keeps Things to Work On to one printed page

function OverUnderPage({ report, onClose }) {
  const byName = (a, b) => a.item.name.localeCompare(b.item.name);
  const right = report.items.filter((row) => isCelebration(row) && row.status === 'right').sort(byName);
  const close = report.items.filter((row) => isCelebration(row) && row.status !== 'right').sort(byName);
  const workOn = report.items.filter(isWorkOn).sort((a, b) => b.missedDelivery - a.missedDelivery || (b.percent ?? 999) - (a.percent ?? 999));
  const supplies = report.items.filter((row) => row.status === 'untracked' && row.actual > 0).sort(byName);
  const dates = <p>From the count on <b>{weekdayDate(report.since)}</b> to the count on <b>{weekdayDate(report.at)}</b></p>;
  const logo = <img src={`${import.meta.env.BASE_URL}brand/empowering-brew-logo.png`} alt="Empowering Brew" />;
  // Rendered straight into <body> so printing can hide the app behind it.
  return createPortal(<div className="report-page" role="dialog" aria-modal="true" aria-label="Weekly over/under report">
    <div className="report-page-tools no-print"><button className="button secondary" onClick={onClose}><BackIcon size={20} /> Back to Reports</button><button className="button primary" onClick={() => window.print()}>Print</button></div>
    <article className="report-sheet celebrate-sheet">
      <header className="report-sheet-head">{logo}<div><h1>Celebrations</h1>{dates}</div></header>
      <p className="report-banner">We served <b>{report.sold}</b> drinks and treats this week!</p>
      <section className="report-group">
        <h2 className="right">Right on track</h2>
        <p>We used just what the recipes say. Great job following the recipes!</p>
        {right.length ? <ul className="report-chips">{right.map((row) => <li key={row.item.id} className="right"><span aria-hidden="true">✓</span>{row.item.name.trim()}</li>)}</ul>
          : <p className="report-empty">Let’s aim to get one item right on track next week!</p>}
      </section>
      {close.length > 0 && <section className="report-group">
        <h2 className="close">So close!</h2>
        <p>Almost right on: within 20% of the recipe.</p>
        <ul className="report-chips">{close.map((row) => <li key={row.item.id} className="close"><span aria-hidden="true">★</span>{row.item.name.trim()}<small>a little {row.status === 'more' ? 'more' : 'less'}</small></li>)}</ul>
      </section>}
      <section className="report-cheers">
        <h2>Remember</h2>
        <ul>{weeklyAffirmations(report.at).map((line) => <li key={line}>{line}</li>)}</ul>
      </section>
      <section className="report-talk"><h2>Let’s talk about it</h2><ol><li>Which celebration are you proudest of?</li><li>Pick one thing to work on. Why do you think it happened?</li><li>What will you do differently next week?</li></ol></section>
    </article>
    <article className="report-sheet work-sheet">
      <header className="report-sheet-head">{logo}<div><h1>Things to Work On</h1>{dates}</div></header>
      <p className="report-lede">Small changes make a big difference. Here is what to try next week.</p>
      {workOn.length ? <ol className="work-list">{workOn.slice(0, WORK_ON_SHOWN).map((row) => {
        const text = workOnText(row);
        return <li key={row.item.id} className={row.missedDelivery ? 'missed' : row.status}>
          <span className="work-mark" aria-hidden="true">{row.missedDelivery ? '?' : row.status === 'more' ? '▲' : '▼'}</span>
          <div><h3>{text.headline}</h3><p>{text.detail}</p><p className="work-tip"><b>Try this:</b> {text.tip}</p>
            {STAFF_REASONS.includes(row.reason) && <p className="report-note">Staff note from the count: {row.reason}</p>}</div>
        </li>;
      })}</ol> : <p className="report-banner">Nothing big to work on this week. Keep doing what you’re doing!</p>}
      {workOn.length > WORK_ON_SHOWN && <p className="report-note">Also check: {workOn.slice(WORK_ON_SHOWN).map((row) => row.item.name.trim()).join(', ')}.</p>}
      <div className="report-flag"><b>Did you forget to ring it in?</b> Tap every drink and treat on the iPad, even when it’s busy. Spills, remakes and deliveries get entered too.</div>
      {supplies.length > 0 && <p className="report-note">Supplies sales don’t track, used this week: {supplies.map((row) => `${row.item.name.trim()} ${amountText(row.actual, row.item.countUnit)}`).join(' · ')}</p>}
    </article>
  </div>, document.body);
}

// Bakery made / sold / excess per open day, to settle how many to make.
function BakeryTable({ state, report, showDays, weekNav, section }) {
  const bakery = useMemo(() => bakeryReport(state, report), [state, report]);
  const sum = (list) => list.reduce((total, value, index) => total + (showDays[index] ? value : 0), 0);
  const row = (label, list, strong = false) => <tr><td>{label}</td>{list.map((count, index) => showDays[index] && <td key={index}>{strong ? <strong>{count || ''}</strong> : count || ''}</td>)}<td><strong>{sum(list)}</strong></td></tr>;
  return <ReportSection {...section} title="Bakery items" summary={`Week of ${dayLabel(report.start)} · ${sum(bakery.sold)} sold · ${sum(bakery.excess)} to staff`} description="Sold at the register plus excess moved to the staff offer (Inventory → Excess bakery items). Made is the two added together; use it to find the right number to make each day.">
    {weekNav}
    <div className="table-scroll"><table className="report-table">
      <thead><tr><th>Bakery</th>{WEEKDAYS.map((day, index) => showDays[index] && <th key={day}>{day}</th>)}<th>Total</th></tr></thead>
      <tbody>{row('Sold', bakery.sold)}{row('Excess (to staff)', bakery.excess)}</tbody>
      <tfoot>{row('Made', bakery.made)}</tfoot>
    </table></div>
  </ReportSection>;
}

// When drinks are ordered, for staffing and prep. Every sale already records its time.
// This week and last week are calendar weeks (Monday to Sunday), whatever week the table above shows.
const BUSY_SCOPES = [['this', 'This week', 0], ['last', 'Last week', -1], ['all', 'All weeks', null]];

function BusyTimes({ state, section }) {
  const [scope, setScope] = useState('this');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [, , offset] = BUSY_SCOPES.find(([key]) => key === scope);
  const start = useMemo(() => { if (offset == null) return null; const date = weekStart(new Date()); date.setDate(date.getDate() + offset * 7); return date; }, [offset]);
  const sales = useMemo(() => {
    if (!start) return state.sales;
    const end = new Date(start); end.setDate(end.getDate() + 7);
    return state.sales.filter((sale) => new Date(sale.soldAt) >= start && new Date(sale.soldAt) < end);
  }, [state.sales, start]);
  const busy = useMemo(() => busyTimes(sales.filter((sale) => !sale.studentDrink && onOpenDay(sale)), slotMinutes, SHOP_HOURS), [sales, slotMinutes]);
  const days = WEEKDAYS.map((_, index) => SHOP_HOURS.days.includes(index));
  const shade = (count) => count ? { background: `rgba(4, 107, 177, ${0.12 + 0.78 * count / busy.max})`, color: count / busy.max > 0.5 ? 'white' : undefined } : undefined;
  const chip = (on, label, onClick) => <button type="button" className={`chip ${on ? 'selected' : ''}`} aria-pressed={on} onClick={onClick}>{label}</button>;
  return <ReportSection {...section} title="Busy times" summary={busy.busiest ? `Busiest (${BUSY_SCOPES.find(([key]) => key === scope)[1].toLowerCase()}): ${WEEKDAYS[busy.busiest.day]}${start ? '' : 's'}, ${clockLabel(busy.busiest.startMinutes)}` : 'No sales yet'}>
    <p className="subheading-help">Drinks and treats sold in each {slotMinutes === 30 ? 'half hour' : 'hour'}, by the time they were rung up. Darker squares are busier; use them to plan who works when and when to prep. Free student drinks are left out. Shows open hours (10 AM–2 PM, Mon, Tue, Thu, Fri); a sale outside those hours adds its own row. Sales on closed days are left out.</p>
    <div className="filter-chips">
      {BUSY_SCOPES.map(([key, label]) => <React.Fragment key={key}>{chip(scope === key, label, () => setScope(key))}</React.Fragment>)}<span className="chip-gap" aria-hidden="true" />
      {chip(slotMinutes === 30, 'Half hours', () => setSlotMinutes(30))}{chip(slotMinutes === 60, 'Hours', () => setSlotMinutes(60))}
    </div>
    {busy.slots.length ? <>
      <p className="busy-summary">{start && <>Week of {dayLabel(start)} · </>}Busiest: <strong>{WEEKDAYS[busy.busiest.day]}{start ? '' : 's'}, {clockLabel(busy.busiest.startMinutes)}–{clockLabel(busy.busiest.startMinutes + slotMinutes)}</strong> · {busy.busiest.count} sold{start ? '' : ' across all weeks'}</p>
      <div className="table-scroll"><table className="report-table busy-table">
        <thead><tr><th>Time</th>{WEEKDAYS.map((day, index) => days[index] && <th key={day}>{day.slice(0, 3)}</th>)}<th>Total</th></tr></thead>
        <tbody>{busy.slots.map((slot) => <tr key={slot.startMinutes}><td>{clockLabel(slot.startMinutes)}</td>{slot.days.map((count, index) => days[index] && <td key={index} style={shade(count)}>{count || ''}</td>)}<td><strong>{slot.total || ''}</strong></td></tr>)}</tbody>
      </table></div>
    </> : <p className="subheading-help">{{ this: 'No sales this week yet.', last: `No sales last week (week of ${start && dayLabel(start)}).`, all: 'No sales recorded yet.' }[scope]}</p>}
  </ReportSection>;
}

function BackupPanel({ state, setState }) {
  const [message, setMessage] = useState('');
  const [storage, setStorage] = useState(null);
  useEffect(() => { storageStatus().then(setStorage).catch(() => {}); }, [state.sales.length]);
  const last = state.settings?.lastSalesBackupAt;
  const markSaved = (savedAt) => setState((current) => ({ ...current, settings: { ...current.settings, lastSalesBackupAt: savedAt } }));
  const saveSales = async () => {
    const savedAt = new Date().toISOString();
    if (await saveFile(`empowering-brew-sales-${dateStamp()}.csv`, toCsv(salesCsvRows(state.sales)), 'text/csv')) { markSaved(savedAt); setMessage('Sales backup saved.'); }
  };
  const saveFull = async () => {
    const savedAt = new Date().toISOString();
    if (await saveFile(`empowering-brew-full-backup-${dateStamp()}.json`, fullBackupText(state), 'application/json')) { markSaved(savedAt); setMessage('Full backup saved.'); }
  };
  const restore = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const { state: restored, exportedAt } = parseFullBackup(await file.text());
      const when = exportedAt ? timeLabel(exportedAt) : 'an unknown date';
      if (!window.confirm(`Replace everything on this iPad with the backup from ${when}? It has ${restored.sales.length} ${restored.sales.length === 1 ? 'sale' : 'sales'}. Anything recorded here since then will be lost.`)) return;
      setState(restored);
      setMessage(`Restored the backup from ${when}.`);
    } catch (error) {
      setMessage(error instanceof SyntaxError ? 'That file could not be read.' : error.message);
    }
  };
  return <section className="backup-panel">
    <div>
      <h3>Backups</h3>
      <p>Last backup: <strong>{last ? timeLabel(last) : 'never'}</strong>. Data is saved only on this iPad, so save a copy somewhere else (Files, Google Drive, email) every day.</p>
      {message && <p className="backup-message" role="status">{message}</p>}
      {storage && <p className="storage-status">{storageSummary(storage)}</p>}
    </div>
    <div className="backup-actions">
      <button className="button primary" onClick={saveSales} disabled={!state.sales.length}><DownloadIcon size={20} /> Sales CSV (all days)</button>
      <button className="button secondary" onClick={saveFull}><DownloadIcon size={20} /> Full backup</button>
      <label className="button secondary file-button">Restore full backup<input type="file" accept=".json,application/json" onChange={restore} /></label>
      <label className="backup-time">Daily reminder<input type="time" value={state.settings?.backupTime || ''} onChange={(event) => setState((current) => ({ ...current, settings: { ...current.settings, backupTime: event.target.value } }))} /><small>Clear to turn off</small></label>
    </div>
  </section>;
}

// One staff PIN is shared by everyone on this iPad; each person still enters their own name.
function PinPanel({ state, setState, staffName }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const changedAt = state.settings?.pinChangedAt;
  const save = (staffPinHash) => {
    setState((current) => ({ ...current, staffPinHash, settings: { ...current.settings, pinChangedAt: new Date().toISOString(), pinChangedBy: staffName } }));
    setOpen(false);
    setMessage('Staff PIN changed. Use the new PIN from now on.');
  };
  return <section className="backup-panel pin-panel">
    <div>
      <h3>Staff PIN</h3>
      <p>All staff share one four-number PIN on this iPad. Change it if a student learns it or someone leaves. Restoring a full backup brings back the PIN saved in that backup.</p>
      {changedAt && <p className="storage-status">Last changed {timeLabel(changedAt)}{state.settings?.pinChangedBy ? ` by ${state.settings.pinChangedBy}` : ''}.</p>}
      {message && <p className="backup-message" role="status">{message}</p>}
    </div>
    <div className="backup-actions"><button className="button secondary" onClick={() => { setMessage(''); setOpen(true); }}>Change PIN</button></div>
    {open && <ChangePinModal pinHash={state.staffPinHash} onSave={save} onClose={() => setOpen(false)} />}
  </section>;
}

function ChangePinModal({ pinHash, onSave, onClose }) {
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const digits = (setter) => (event) => setter(event.target.value.replace(/\D/g, ''));
  const submit = async (event) => {
    event.preventDefault();
    if (await hashPin(current) !== pinHash) return setError('The current PIN is not correct.');
    if (!/^\d{4}$/.test(pin)) return setError('Enter exactly four numbers for the new PIN.');
    if (pin !== confirm) return setError('The two new PIN entries do not match.');
    onSave(await hashPin(pin));
  };
  const field = (label, value, setter, autoFocus = false) => <label>{label}<input autoFocus={autoFocus} type="password" inputMode="numeric" pattern="[0-9]*" maxLength="4" value={value} onChange={digits(setter)} /></label>;
  return <Modal title="Change staff PIN" onClose={onClose}>
    <form onSubmit={submit} className="stack-form">
      {field('Current PIN', current, setCurrent, true)}
      {field('New four-number PIN', pin, setPin)}
      {field('Confirm new PIN', confirm, setConfirm)}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary">Save new PIN</button></div>
    </form>
  </Modal>;
}

const sizeLabel = (bytes) => bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(1)} MB`;

function storageSummary({ backend, persisted, usage, quota }) {
  const where = backend === 'indexeddb' ? 'Stored in this iPad\'s long-term app storage' : 'Stored in limited browser storage (about 5 MB)';
  const keep = persisted === true ? 'protected from automatic clearing' : persisted === false ? 'the iPad may clear it if space runs low' : null;
  const used = usage != null && quota ? `${sizeLabel(usage)} used of ${sizeLabel(quota)} available` : null;
  return [where, keep, used].filter(Boolean).join(' · ') + '.';
}

/* ---------- History ---------- */

function HistoryTab({ state }) {
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(150);
  const records = useMemo(() => [
    ...state.sales.map((sale) => ({ kind: 'Sale', time: sale.soldAt, title: `${sale.productName}${sale.temperature === 'none' ? '' : ` · ${prettyTemperature(sale.temperature)}`}${sale.option ? ` · ${optionLabel(sale.option, sale.special)}` : ''}${sale.changes?.length ? ` · ${sale.changes.join(', ')}` : ''}${sale.decaf ? ' · Decaf' : ''}${sale.studentDrink ? ' · Student drink ($0)' : ''}`, detail: `${sale.voidedAt ? 'Undone at the register · ' : ''}${ESTIMATE_LABELS[sale.estimateStatus] || 'Not configured'}${sale.recipeVersionId ? ` · recipe ${sale.recipeVersionId}` : ''}${sale.usage?.length ? ` · ${sale.usage.map((use) => `${use.quantity} ${use.unit} ${use.itemName}`).join(', ')}` : ''}`, voided: !!sale.voidedAt })),
    ...state.inventoryEvents.filter((event) => event.type !== 'opening').map((event) => ({ kind: 'Inventory', time: event.at, title: `${event.itemName || event.productName} · ${EVENT_LABELS[event.type] || event.type}`, detail: [event.type === 'bakery-excess' ? `${event.count} ${event.count === 1 ? 'item' : 'items'} made ${dayLabel(new Date(`${event.forDate}T12:00:00`))}` : event.type === 'count' ? `Estimated ${formatNumber(event.estimatedBefore)}, counted ${formatNumber(event.countedValue)} (${event.quantity > 0 ? '+' : ''}${formatNumber(event.quantity)})` : typeof event.quantity === 'number' ? `${event.quantity > 0 ? '+' : ''}${formatNumber(event.quantity)}` : event.usage?.map((use) => `${use.quantity} ${use.unit} ${use.itemName}`).join(', '), event.reason, event.note, event.countedBy && `counted by ${event.countedBy}`, event.by && `by ${event.by}`].filter(Boolean).join(' · ') })),
    ...state.countSessions.map((session) => ({ kind: 'Count', time: session.reviewedAt || session.submittedAt, title: `Physical count · ${session.status}`, detail: `${Object.keys(session.counts).length} items · counted by ${session.countedBy || 'not given'}${session.reviewedBy ? ` · reviewed by ${session.reviewedBy}` : ''}` })),
    ...state.recipes.filter((recipe) => recipe.savedBy).map((recipe) => ({ kind: 'Recipe', time: recipe.effectiveFrom, title: `${recipe.name} · ${prettyTemperature(recipe.temperature)} · ${recipe.versionLabel}`, detail: `${recipe.changeNote} · by ${recipe.savedBy}` })),
  ].sort((a, b) => b.time.localeCompare(a.time)), [state]);
  const shown = records.filter((record) => filter === 'all' || record.kind === filter);
  return <>
    <SectionHeading title="History" description="Everything recorded on this iPad. Nothing is deleted; undone sales are kept and marked." />
    <div className="filter-chips">{['all', 'Sale', 'Inventory', 'Count', 'Recipe'].map((name) => <button key={name} className={`chip ${filter === name ? 'selected' : ''}`} onClick={() => setFilter(name)}>{name === 'all' ? 'All' : name === 'Inventory' ? name : `${name}s`}</button>)}</div>
    {!shown.length ? <div className="empty-state"><CupLogo size={54} /><h3>No activity yet</h3><p>Sales, inventory events, counts, and recipe changes will appear here.</p></div>
      : <div className="history-list">{shown.slice(0, limit).map((record, index) => <div className={`history-row ${record.voided ? 'voided' : ''}`} key={`${record.kind}-${record.time}-${index}`}><span className="history-kind">{record.kind}</span><span><strong>{record.title}</strong><small>{record.detail}</small></span><time>{timeLabel(record.time)}</time></div>)}
        {shown.length > limit && <button className="button secondary full-button" onClick={() => setLimit(limit + 150)}>Show more</button>}</div>}
  </>;
}
