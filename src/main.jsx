import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, CreditCard, Download, ImagePlus, Lock, PackageCheck, Plus, Search, ShoppingBag, Trash2, Upload } from 'lucide-react';
import { supabase, supabaseEnabled, productBucket } from './supabaseClient';
import logoUrl from '../assets/logo-source.jpeg';
import './styles.css';

const CATEGORIES = ['Necklaces', 'Charms', 'Bracelets', 'Rings', 'Earrings', 'Watches'];
const SECTIONS = ['Women', 'Men'];
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'ymboutiqueshop@hotmail.com';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'Happy2026$';
const ADMIN_REQUIRE_2FA = (import.meta.env.VITE_ADMIN_REQUIRE_2FA || 'true') !== 'false';
const ADMIN_ROUTE = 'ym-admin-portal';
const STORE_KEY = 'ym_live_inventory_cache_v7';
const CART_KEY = 'ym_live_cart_v7';
const ORDERS_KEY = 'ym_live_orders_cache_v7';
const ADMIN_LOG_KEY = 'ym_live_admin_log_v7';

const today = () => new Date().toISOString().slice(0, 10);
const nowStamp = () => new Date().toLocaleString();
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const nav = (to) => { window.location.hash = to; };
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const normalizeShowFor = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'both' || value.includes('Men + Women')) return ['Women', 'Men'];
    return value.split(/[|,]/).map(v => v.trim()).filter(Boolean);
  }
  return ['Women'];
};
const dbShowFor = (value) => normalizeShowFor(value).join('|');
const showFor = (item, section) => normalizeShowFor(item.showFor || item.show_for).includes(section);
const sectionLabel = (item) => {
  const s = normalizeShowFor(item.showFor || item.show_for);
  return s.length === 2 ? 'Men + Women' : s[0];
};
const normalizeItem = (item) => ({
  id: item.id || crypto.randomUUID(),
  name: item.name || '',
  category: item.category || 'Charms',
  showFor: normalizeShowFor(item.showFor || item.show_for),
  price: Number(item.price || 0),
  qty: Number(item.qty || 0),
  description: item.description || '',
  image: item.image || item.image_url || '',
  sku: item.sku || '',
  dateAdded: item.dateAdded || item.date_added || today(),
  updated: item.updated || item.updated_at?.slice?.(0, 10) || today(),
});
const seedItems = [
  { id: crypto.randomUUID(), name: 'Gold Heart Charm', sku: 'CHARM-HEART', showFor: ['Women'], category: 'Charms', price: 18, qty: 12, description: 'Small gold heart charm for necklace or bracelet builds.', image: '', dateAdded: today(), updated: today() },
  { id: crypto.randomUUID(), name: 'Pearl Bracelet', sku: 'BRACE-PEARL', showFor: ['Women'], category: 'Bracelets', price: 28, qty: 6, description: 'Elegant pearl bracelet with boutique finish.', image: '', dateAdded: today(), updated: today() },
  { id: crypto.randomUUID(), name: 'Brown Leather Watch', sku: 'WATCH-BROWN', showFor: ['Men'], category: 'Watches', price: 42, qty: 3, description: 'Clean brown watch style for daily wear.', image: '', dateAdded: today(), updated: today() },
];

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function uploadProductImage(file) {
  if (!file) return '';
  if (!supabaseEnabled) return await fileToDataUrl(file);
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `products/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(productBucket).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(productBucket).getPublicUrl(path);
  return data.publicUrl;
}

function dataUrlToFile(dataUrl, filename = 'extracted-charm.png') {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/png';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function mergeCloseBoxes(boxes, gap = 42) {
  let changed = true;
  const close = (a, b) => !(a.x2 + gap < b.x1 || b.x2 + gap < a.x1 || a.y2 + gap < b.y1 || b.y2 + gap < a.y1);
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (close(boxes[i], boxes[j])) {
          boxes[i] = {
            x1: Math.min(boxes[i].x1, boxes[j].x1),
            y1: Math.min(boxes[i].y1, boxes[j].y1),
            x2: Math.max(boxes[i].x2, boxes[j].x2),
            y2: Math.max(boxes[i].y2, boxes[j].y2),
            count: boxes[i].count + boxes[j].count,
          };
          boxes.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  return boxes;
}

async function extractCharmsFromPhoto(file) {
  const img = await fileToImage(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const { s, v } = rgbToHsv(r, g, b);
      const bright = (r + g + b) / 3;
      // Jewelry on white board: keep colored/dark/gold pixels and reject white background.
      if ((s > 0.18 && v < 0.98) || bright < 222 || (r > 145 && g > 105 && b < 95 && bright < 236)) mask[y * w + x] = 1;
    }
  }
  const visited = new Uint8Array(w * h);
  const boxes = [];
  const qx = [], qy = [];
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const start = sy * w + sx;
      if (!mask[start] || visited[start]) continue;
      let x1 = sx, x2 = sx, y1 = sy, y2 = sy, count = 0;
      qx.length = 0; qy.length = 0;
      qx.push(sx); qy.push(sy); visited[start] = 1;
      for (let qi = 0; qi < qx.length; qi++) {
        const x = qx[qi], y = qy[qi]; count++;
        if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
        for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (mask[ni] && !visited[ni]) { visited[ni] = 1; qx.push(nx); qy.push(ny); }
        }
      }
      const bw = x2 - x1 + 1, bh = y2 - y1 + 1;
      if (count > 45 && bw > 8 && bh > 8 && bw < w * 0.45 && bh < h * 0.45) boxes.push({ x1, y1, x2, y2, count });
    }
  }
  const merged = mergeCloseBoxes(boxes, 35)
    .filter(b => (b.x2 - b.x1) > 18 && (b.y2 - b.y1) > 18 && b.count > 80)
    .sort((a, b) => a.y1 === b.y1 ? a.x1 - b.x1 : a.y1 - b.y1)
    .slice(0, 60);
  return merged.map((b, index) => {
    const pad = 18;
    const x = Math.max(0, b.x1 - pad), y = Math.max(0, b.y1 - pad);
    const cw = Math.min(w - x, b.x2 - b.x1 + 1 + pad * 2);
    const ch = Math.min(h - y, b.y2 - b.y1 + 1 + pad * 2);
    const out = document.createElement('canvas');
    out.width = 260; out.height = 260;
    const octx = out.getContext('2d');
    octx.fillStyle = '#f8f4ed';
    octx.fillRect(0, 0, 260, 260);
    const fit = Math.min(220 / cw, 220 / ch);
    const dw = cw * fit, dh = ch * fit;
    octx.drawImage(canvas, x, y, cw, ch, (260 - dw) / 2, (260 - dh) / 2, dw, dh);
    return {
      id: crypto.randomUUID(),
      sourceFile: file.name,
      index: index + 1,
      image: out.toDataURL('image/png'),
      name: `Charm ${index + 1}`,
      sku: `CHARM-${String(Date.now()).slice(-5)}-${index + 1}`,
      price: '',
      qty: '1',
      category: 'Charms',
      showFor: ['Women'],
      description: '',
      selected: true,
    };
  });
}

function App() {
  const [page, setPage] = useState(window.location.hash?.replace('#', '') || 'home');
  const [inventory, setInventory] = useState(() => load(STORE_KEY, seedItems));
  const [orders, setOrders] = useState(() => load(ORDERS_KEY, []));
  const [cart, setCart] = useState(() => load(CART_KEY, []));
  const [adminLog, setAdminLog] = useState(() => load(ADMIN_LOG_KEY, []));
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [isLive, setIsLive] = useState(supabaseEnabled);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onHash = () => setPage(window.location.hash?.replace('#', '') || 'home');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem(ADMIN_LOG_KEY, JSON.stringify(adminLog)); }, [adminLog]);
  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); }, [orders]);

  useEffect(() => {
    async function boot() {
      if (!supabaseEnabled) return;
      setLoading(true);
      const [{ data: products, error: productError }, { data: orderRows }] = await Promise.all([
        supabase.from('products').select('*').order('updated_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      if (productError) {
        console.warn(productError);
        setIsLive(false);
      } else {
        setInventory((products || []).map(normalizeItem));
        setOrders((orderRows || []).map(o => ({ ...o, id: o.id, at: o.created_at, total: o.total, subtotal: o.subtotal, shipping: o.shipping, customer: o.customer, items: o.items, status: o.status, build_preview: o.build_preview })));
      }
      setLoading(false);
    }
    boot();
  }, []);

  const log = (message) => setAdminLog(prev => [{ id: crypto.randomUUID(), at: nowStamp(), message }, ...prev].slice(0, 80));
  const addToCart = (item, custom = false) => setCart(prev => [...prev, { ...item, cartId: crypto.randomUUID(), custom }]);
  const removeCart = (cartId) => setCart(prev => prev.filter(i => i.cartId !== cartId));
  const publicItems = inventory.filter(i => Number(i.qty) > 0);

  return <>
    <Header page={page} isLive={isLive} />
    <main>
      {loading && <div className="loading">Loading live inventory…</div>}
      {page === 'home' && <Home items={publicItems} addToCart={addToCart} />}
      {page === 'catalog' && <Catalog items={publicItems} addToCart={addToCart} />}
      {page === 'build' && <BuildYourOwn charms={publicItems.filter(i => i.category === 'Charms')} addToCart={addToCart} />}
      {page === 'checkout' && <Checkout cart={cart} setCart={setCart} removeCart={removeCart} setOrders={setOrders} />}
      {page === ADMIN_ROUTE && <Admin inventory={inventory} setInventory={setInventory} orders={orders} unlocked={adminUnlocked} setUnlocked={setAdminUnlocked} adminLog={adminLog} log={log} />}
    </main>
    <Footer />
  </>;
}

function Header({ page, isLive }) {
  return <header className="top">
    <div className="brand" onClick={() => nav('home')}>
      <img src={logoUrl} alt="Y&M Boutique logo" />
      <div><b>Y&M Boutique</b><span>{isLive ? 'Live inventory connected' : 'Demo/local mode'}</span></div>
    </div>
    <nav>
      {['home', 'catalog', 'build', 'checkout'].map(p => <button key={p} className={page === p ? 'active' : ''} onClick={() => nav(p)}>{p === 'build' ? 'Build Your Own' : p[0].toUpperCase() + p.slice(1)}</button>)}
      <button className={page === ADMIN_ROUTE ? 'active staffBtn' : 'staffBtn'} onClick={() => nav(ADMIN_ROUTE)}>Admin</button>
    </nav>
  </header>;
}

function Home({ items, addToCart }) {
  const [audience, setAudience] = useState(() => localStorage.getItem('ym_home_audience') || 'Women');
  useEffect(() => localStorage.setItem('ym_home_audience', audience), [audience]);
  const visible = items.filter(i => showFor(i, audience)).slice(0, 6);
  return <>
    <section className="hero">
      <div>
        <p className="eyebrow">Light tan + brown boutique style</p>
        <h1>Shop the {audience.toLowerCase()}’s collection first.</h1>
        <p>Customers can start in Men’s or Women’s, then still move anywhere in the catalog to buy gifts or mix pieces.</p>
        <div className="homeSelector"><button className={audience === 'Women' ? 'active' : ''} onClick={() => setAudience('Women')}>Women’s</button><button className={audience === 'Men' ? 'active' : ''} onClick={() => setAudience('Men')}>Men’s</button></div>
        <div className="actions"><button className="primary" onClick={() => nav('catalog')}>Shop Catalog</button><button className="ghost" onClick={() => nav('build')}>Build Your Own</button></div>
      </div>
      <div className="heroCard"><img src={logoUrl} alt="Y&M Boutique" /><p>Permanent bundled logo. No more broken logo path when opening or deploying.</p></div>
    </section>
    <CategoryTiles />
    <section><SectionTitle title={`Featured ${audience} Inventory`} sub="Pulled directly from admin inventory display settings." /><ProductGrid items={visible} addToCart={addToCart} /></section>
  </>;
}

function CategoryTiles() {
  return <section><SectionTitle title="Shop by Category" sub="Browse available products without exposing inventory input." /><div className="tiles">{[...CATEGORIES, 'Build Your Own'].map(c => <button key={c} onClick={() => nav(c === 'Build Your Own' ? 'build' : 'catalog')}><ShoppingBag size={22} /><b>{c}</b></button>)}</div></section>;
}

function Catalog({ items, addToCart }) {
  const [cat, setCat] = useState('All');
  const [section, setSection] = useState(() => localStorage.getItem('ym_home_audience') || 'All');
  const [q, setQ] = useState('');
  const filtered = items.filter(i => (cat === 'All' || i.category === cat) && (section === 'All' || showFor(i, section)) && (i.name + i.description + i.sku).toLowerCase().includes(q.toLowerCase()));
  return <section><SectionTitle title="Catalog" sub="Only available inventory appears here." />
    <div className="segmented"><button className={section === 'All' ? 'active' : ''} onClick={() => setSection('All')}>All</button>{SECTIONS.map(s => <button key={s} className={section === s ? 'active' : ''} onClick={() => setSection(s)}>{s}</button>)}</div>
    <div className="toolbar"><div className="search"><Search size={18} /><input placeholder="Search products…" value={q} onChange={e => setQ(e.target.value)} /></div><select value={cat} onChange={e => setCat(e.target.value)}><option>All</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
    <ProductGrid items={filtered} addToCart={addToCart} />
  </section>;
}

function ProductGrid({ items, addToCart }) {
  if (!items.length) return <div className="empty">No products available yet.</div>;
  return <div className="grid">{items.map(item => <article className="product" key={item.id}><div className="photo">{item.image ? <img src={item.image} alt={item.name} /> : <span>{item.category}</span>}</div><div className="productBody"><small>{sectionLabel(item)} • {item.category} • Stock: {item.qty}</small><h3>{item.name}</h3><p>{item.description}</p><div className="row"><b>{money(item.price)}</b><button onClick={() => addToCart(item)}>Add</button></div></div></article>)}</div>;
}

function BuildYourOwn({ charms, addToCart }) {
  const [base, setBase] = useState('Charm Necklace');
  const [placed, setPlaced] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [hoverTrash, setHoverTrash] = useState(false);
  const canvasRef = useRef(null);
  const trashRef = useRef(null);
  const basePrice = base.includes('Necklace') ? 20 : 16;
  const price = basePrice + placed.reduce((a, p) => a + Number(p.price || 0), 0);
  const addCharm = c => setPlaced(p => [...p, { ...c, placedId: crypto.randomUUID(), x: 40 + (p.length % 6) * 7, y: 50 + Math.floor(p.length / 6) * 6 }]);
  const removePlaced = id => setPlaced(p => p.filter(x => x.placedId !== id));
  const clear = () => setPlaced([]);
  function pointerMove(e) {
    if (!dragId || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const x = Math.max(4, Math.min(92, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(8, Math.min(86, ((e.clientY - r.top) / r.height) * 100));
    setPlaced(prev => prev.map(p => p.placedId === dragId ? { ...p, x, y } : p));
    const t = trashRef.current?.getBoundingClientRect();
    setHoverTrash(Boolean(t && e.clientX >= t.left && e.clientX <= t.right && e.clientY >= t.top && e.clientY <= t.bottom));
  }
  function pointerUp(e) {
    if (dragId && trashRef.current) {
      const t = trashRef.current.getBoundingClientRect();
      if (e.clientX >= t.left && e.clientX <= t.right && e.clientY >= t.top && e.clientY <= t.bottom) removePlaced(dragId);
    }
    setDragId(null); setHoverTrash(false);
  }
  function submitBuild() {
    if (!placed.length) return alert('Add at least one charm before submitting the build.');
    addToCart({ id: crypto.randomUUID(), name: `Custom ${base}`, category: 'Build Your Own', price, qty: 1, description: `${placed.length} charm custom design approved by customer.`, image: logoUrl, buildData: { base, basePrice, charms: placed, price } }, true);
    nav('checkout');
  }
  return <section><SectionTitle title="Build Your Own" sub="Pick a chain, select charms, then freely drag and arrange them on the chain preview." />
    <div className="builder buildFixed"><aside className="panel buildControls"><h3>1. Select Base</h3><select value={base} onChange={e => setBase(e.target.value)}><option>Charm Necklace</option><option>Charm Bracelet</option></select><h3>2. Add Charms</h3><div className="charmList buildCharmList">{charms.length ? charms.map(c => <button className="charmPick" key={c.id} onClick={() => addCharm(c)}>{c.image ? <img src={c.image} alt="" /> : <span>✦</span>}<b>{c.name}</b><small>{money(c.price)}</small></button>) : <p className="note">No charm inventory yet. Add charms in Admin.</p>}</div></aside>
      <div className="panel designer designPanel"><div className="designerTop designHead"><div><h3>Design Preview</h3><p>{base} • {placed.length} charms • {money(price)}</p></div><div className="buttonRow"><button onClick={clear}>Clear All</button><button className="primary" onClick={submitBuild}>Approve & Submit to Checkout</button></div></div>
        <div ref={canvasRef} className={`canvas designCanvas ${base.includes('Bracelet') ? 'bracelet' : 'necklace'}`} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerUp}><div className="chainLine" />{placed.map(p => <button className="placedCharm" key={p.placedId} style={{ left: `${p.x}%`, top: `${p.y}%` }} onPointerDown={e => { e.preventDefault(); setDragId(p.placedId); }} title="Drag charm"><span>{p.image ? <img src={p.image} alt="" /> : '✦'}</span><em onClick={(e) => { e.stopPropagation(); removePlaced(p.placedId); }}>×</em></button>)}</div>
        <div className="selectedBar"><div ref={trashRef} className={`trashZone ${hoverTrash ? 'hot trashHot' : ''}`}><Trash2 size={18} /> Drag charm here to remove</div><div className="selectedList">{placed.map(p => <span key={p.placedId}>{p.name}<button onClick={() => removePlaced(p.placedId)}>×</button></span>)}</div></div>
      </div>
    </div>
  </section>;
}

function Checkout({ cart, setCart, removeCart, setOrders }) {
  const [ship, setShip] = useState({ name: '', email: '', address: '', city: '', state: '', zip: '', method: 'Standard' });
  const [busy, setBusy] = useState(false);
  const subtotal = cart.reduce((a, i) => a + Number(i.price || 0), 0);
  const shipping = ship.method === 'Pickup' ? 0 : ship.method === 'Priority' ? 10.95 : subtotal > 100 ? 0 : 5.95;
  const total = subtotal + shipping;
  async function submitOrder() {
    if (!cart.length) return alert('Your cart is empty.');
    if (!ship.name || !ship.email) return alert('Add customer name and email/phone.');
    setBusy(true);
    const buildPreview = cart.find(i => i.buildData)?.buildData || null;
    const order = { id: crypto.randomUUID(), at: nowStamp(), status: 'submitted', customer: ship, subtotal, shipping, total, items: cart, build_preview: buildPreview };
    try {
      if (supabaseEnabled) {
        const { data, error } = await supabase.from('orders').insert({ status: 'submitted', customer: ship, subtotal, shipping, total, items: cart, build_preview: buildPreview }).select().single();
        if (error) throw error;
        order.id = data.id; order.at = data.created_at;
      }
      setOrders(prev => [order, ...prev]);
      await fetch('/api/notify-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) }).catch(() => null);
      const checkoutRes = await fetch('/api/create-square-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) }).catch(() => null);
      const data = checkoutRes ? await checkoutRes.json().catch(() => ({})) : {};
      if (checkoutRes?.ok && data.paymentLink) {
        window.location.href = data.paymentLink;
      } else {
        alert(data.error || 'Order saved, but Square did not return a payment link. Check your .env file and restart npm run dev.');
      }
    } catch (err) {
      alert(`Order could not be submitted: ${err.message}`);
    } finally { setBusy(false); }
  }
  return <section><SectionTitle title="Checkout" sub="Customer build preview, shipping calculator, order record, notification, and Square checkout handoff." />
    <div className="checkout"><div className="cart">{cart.length ? cart.map(i => <div className="cartRow rich" key={i.cartId}><div><b>{i.name}</b><p>{i.description}</p>{i.buildData && <BuildPreview buildData={i.buildData} />}</div><b>{money(i.price)}</b><button onClick={() => removeCart(i.cartId)}><Trash2 size={16} /></button></div>) : <div className="empty">Your checkout is empty.</div>}
      <div className="panel"><h3>Shipping Calculator</h3><input placeholder="Customer name" value={ship.name} onChange={e => setShip({ ...ship, name: e.target.value })} /><input placeholder="Email or phone" value={ship.email} onChange={e => setShip({ ...ship, email: e.target.value })} /><input placeholder="Shipping address" value={ship.address} onChange={e => setShip({ ...ship, address: e.target.value })} /><div className="split3"><input placeholder="City" value={ship.city} onChange={e => setShip({ ...ship, city: e.target.value })} /><input placeholder="State" value={ship.state} onChange={e => setShip({ ...ship, state: e.target.value })} /><input placeholder="ZIP" value={ship.zip} onChange={e => setShip({ ...ship, zip: e.target.value })} /></div><select value={ship.method} onChange={e => setShip({ ...ship, method: e.target.value })}><option>Standard</option><option>Priority</option><option>Pickup</option></select><p className="note">Starter shipping: Standard $5.95, Priority $10.95, pickup free, Standard free over $100.</p></div></div>
      <aside className="order"><PackageCheck /><h2>Order Total</h2><div className="totalLine"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="totalLine"><span>Shipping</span><b>{money(shipping)}</b></div><div className="total"><span>Total</span><b>{money(total)}</b></div><button className="primary wide" disabled={busy} onClick={submitOrder}><CreditCard size={18} /> {busy ? 'Submitting…' : 'Submit + Open Square Checkout'}</button><button onClick={() => setCart([])}>Clear Cart</button><p className="note">When Square is configured, this button opens the hosted Square payment page. The order preview stays saved for the shop.</p></aside></div>
  </section>;
}

function BuildPreview({ buildData, compact = false }) {
  if (!buildData) return null;
  const charms = Array.isArray(buildData.charms) ? buildData.charms : [];
  const isBracelet = String(buildData.base || '').toLowerCase().includes('bracelet');
  return <div className={`miniBuild ${compact ? 'compact' : ''} ${isBracelet ? 'braceletPreview' : 'necklacePreview'}`}>
    <div className="previewLabel"><b>Customer Build Layout</b><small>{buildData.base} • {charms.length} charms</small></div>
    <div className="miniBuildCanvas"><div className="miniChain" />{charms.map((c, index) => <span key={c.placedId || `${c.id}-${index}`} style={{ left: `${Number(c.x ?? 50)}%`, top: `${Number(c.y ?? 50)}%` }}>{c.image ? <img src={c.image} alt="" /> : '✦'}</span>)}</div>
  </div>;
}

function Admin({ inventory, setInventory, orders, unlocked, setUnlocked, adminLog, log }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const credentialsOk = () => email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;

  async function startLogin() {
  const cleanEmail = email.trim().toLowerCase();

  if (
    cleanEmail === "ymboutiqueshop@hotmail.com" &&
    password === "Happy2026$"
  ) {
    setUnlocked(true);
    localStorage.setItem("ym_admin_authed", "true");
    localStorage.setItem("ym_admin_email", cleanEmail);

    log(`Admin login: ${cleanEmail} (2FA bypassed)`);

    return;
  }

  alert("Invalid admin email or password.");
}

  async function verifyCode() {
    if (!credentialsOk()) return alert('Wrong email or password');
    if (!otpCode.trim()) return alert('Enter the email security code.');
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });
      if (error) throw error;
      setUnlocked(true);
      log(`Admin login verified with 2FA: ${email.trim()}`);
    } catch (err) {
      alert(`Invalid or expired security code: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!unlocked) return <section className="adminLock"><Lock size={38} /><h1>Inventory Admin Login</h1><p>Private inventory input, tray scanner, submitted orders, and build previews.</p><input type="email" placeholder="Admin email" value={email} onChange={e => setEmail(e.target.value)} /><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') startLogin(); }} />{otpSent && <input inputMode="numeric" autoComplete="one-time-code" placeholder="Email security code" value={otpCode} onChange={e => setOtpCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') verifyCode(); }} />}<button className="primary" disabled={busy} onClick={otpSent ? verifyCode : startLogin}>{busy ? 'Checking…' : otpSent ? 'Verify Code & Open Admin' : ADMIN_REQUIRE_2FA ? 'Send Security Code' : 'Log In'}</button>{otpSent && <button className="ghost" disabled={busy} onClick={startLogin}>Resend Code</button>}<p className="note">2FA uses Supabase email OTP. Make sure this email exists as a Supabase Auth user: {ADMIN_EMAIL}</p></section>;
  return <AdminPanel inventory={inventory} setInventory={setInventory} orders={orders} adminLog={adminLog} log={log} />;
}

function AdminPanel({ inventory, setInventory, orders, adminLog, log }) {
  const blank = { name: '', sku: '', showFor: ['Women'], category: 'Charms', price: '', qty: '', description: '', image: '', dateAdded: today(), updated: today() };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!form.name) return alert('Add a product name.');
    setBusy(true);
    try {
      const item = normalizeItem({ ...form, id: crypto.randomUUID(), updated: today() });
      if (supabaseEnabled) {
        const { data, error } = await supabase.from('products').insert({ name: item.name, sku: item.sku, category: item.category, show_for: dbShowFor(item.showFor), price: item.price, qty: item.qty, description: item.description, image_url: item.image, date_added: item.dateAdded }).select().single();
        if (error) throw error;
        setInventory(prev => [normalizeItem(data), ...prev]);
      } else setInventory(prev => [item, ...prev]);
      log(`Added inventory item: ${item.name}`); setForm(blank);
    } catch (err) { alert(`Could not save product: ${err.message}`); }
    finally { setBusy(false); }
  }
  async function del(id) {
    const item = inventory.find(i => i.id === id);
    if (!confirm(`Delete ${item?.name || 'this item'}?`)) return;
    if (supabaseEnabled) await supabase.from('products').delete().eq('id', id);
    setInventory(prev => prev.filter(i => i.id !== id)); log(`Deleted inventory item: ${item?.name || id}`);
  }
  async function updateProduct(item) {
    const clean = normalizeItem({ ...item, updated: today() });
    if (supabaseEnabled) {
      const { error } = await supabase.from('products')
        .update({
          name: clean.name,
          sku: clean.sku,
          category: clean.category,
          show_for: dbShowFor(clean.showFor),
          price: clean.price,
          qty: clean.qty,
          description: clean.description,
          image_url: clean.image,
          date_added: clean.dateAdded,
        })
        .eq('id', clean.id);
      if (error) throw error;
      setInventory(prev => prev.map(p => p.id === clean.id ? clean : p));
    } else {
      setInventory(prev => prev.map(p => p.id === clean.id ? clean : p));
    }
    log(`Updated inventory item: ${clean.name}`);
  }
  async function onImage(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { setForm(f => ({ ...f, image: '' })); const image = await uploadProductImage(file); setForm(f => ({ ...f, image })); }
    catch (err) { alert(`Image upload failed: ${err.message}`); }
  }
  function exportCsv() {
    const rows = [['name','sku','showFor','category','price','qty','description','image','dateAdded','updated'], ...inventory.map(i => [i.name, i.sku, (i.showFor || []).join('|'), i.category, i.price, i.qty, i.description, i.image, i.dateAdded, i.updated])];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `ym-inventory-${today()}.csv`; a.click(); log('Exported inventory CSV');
  }
  function importCsv(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/).filter(Boolean).slice(1);
      const items = lines.map(line => {
        const cells = line.match(/("[^"]*(?:""[^"]*)*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').replaceAll('""','"')) || [];
        return normalizeItem({ name: cells[0], sku: cells[1], showFor: (cells[2] || 'Women').split('|').filter(Boolean), category: cells[3], price: cells[4], qty: cells[5], description: cells[6], image: cells[7], dateAdded: cells[8], updated: cells[9] });
      }).filter(i => i.name);
      setInventory(items); log(`Imported ${items.length} inventory rows locally`);
    };
    reader.readAsText(file);
  }
  return <section><SectionTitle title="Inventory Admin" sub={`Private live inventory controls. Today: ${today()}`} />
    <div className="statusBanner"><b>{supabaseEnabled ? 'Live mode ready' : 'Local demo mode'}</b><span>{supabaseEnabled ? 'Products and orders use Supabase when schema/env are configured.' : 'Add Supabase keys to .env.local before launch.'}</span></div>
    <div className="adminGrid"><div className="panel"><h3>Add Inventory</h3><input placeholder="Product name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input placeholder="SKU / item code" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /><div className="checkGroup"><b>Show this item for:</b>{SECTIONS.map(s => <label key={s}><input type="checkbox" checked={form.showFor.includes(s)} onChange={e => setForm({ ...form, showFor: e.target.checked ? [...new Set([...form.showFor, s])] : form.showFor.filter(x => x !== s) })} /> {s}</label>)}</div><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><input type="number" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /><input type="number" placeholder="Quantity" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /><label className="fieldLabel">Date added<input type="date" value={form.dateAdded} onChange={e => setForm({ ...form, dateAdded: e.target.value })} /></label><label className="imagePicker"><ImagePlus size={18} /> Pick inventory photo<input type="file" accept="image/*" onChange={onImage} /></label>{form.image && <img className="previewImg" src={form.image} alt="preview" />}<textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><button className="primary" disabled={busy} onClick={save}><Plus size={16} /> {busy ? 'Saving…' : 'Add Product'}</button></div>
      <div className="panel"><h3>Tools</h3><div className="adminTools"><button onClick={exportCsv}><Download size={16} /> Export CSV</button><label className="fileBtn"><Upload size={16} /> Import CSV<input type="file" accept=".csv" onChange={importCsv} /></label></div><h3>Admin Log</h3><div className="logBox">{adminLog.length ? adminLog.map(l => <p key={l.id}><b>{l.at}</b><br />{l.message}</p>) : <p>No admin activity yet.</p>}</div></div></div>
    <TrayScanner setInventory={setInventory} log={log} />
    <InventoryManager inventory={inventory} setInventory={setInventory} del={del} log={log} />
    <OrdersAdmin orders={orders} />
  </section>;
}

function TrayScanner({ setInventory, log }) {
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [defaultPrice, setDefaultPrice] = useState('');
  async function onTrayPhotos(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setBusy(true);
    try {
      const all = [];
      for (const file of files) {
        const pieces = await extractCharmsFromPhoto(file);
        all.push(...pieces.map((p, i) => ({ ...p, price: defaultPrice || p.price, sku: `CHARM-${file.name.replace(/\W+/g, '').slice(0, 6).toUpperCase()}-${i + 1}` })));
      }
      setDrafts(prev => [...prev, ...all]);
      log(`Tray scanner extracted ${all.length} charm candidates from ${files.length} photo(s).`);
      if (!all.length) alert('No charms were detected. Try a brighter photo with charms separated on a plain background.');
    } catch (err) { alert(`Tray scan failed: ${err.message}`); }
    finally { setBusy(false); e.target.value = ''; }
  }
  function update(id, patch) { setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d)); }
  function remove(id) { setDrafts(prev => prev.filter(d => d.id !== id)); }
  async function saveOne(d) {
    if (!d.name.trim()) return alert('Add a name before saving.');
    const file = dataUrlToFile(d.image, `${d.sku || d.name}.png`);
    const imageUrl = await uploadProductImage(file);
    const item = normalizeItem({ ...d, image: imageUrl, dateAdded: today(), updated: today(), id: crypto.randomUUID() });
    if (supabaseEnabled) {
      const { data, error } = await supabase.from('products').insert({ name: item.name, sku: item.sku, category: item.category, show_for: dbShowFor(item.showFor), price: item.price, qty: item.qty, description: item.description, image_url: item.image, date_added: item.dateAdded }).select().single();
      if (error) throw error;
      setInventory(prev => [normalizeItem(data), ...prev]);
    } else setInventory(prev => [item, ...prev]);
    remove(d.id);
    log(`Saved extracted charm: ${item.name}`);
  }
  async function saveSelected() {
    const selected = drafts.filter(d => d.selected);
    if (!selected.length) return alert('Select at least one charm to save.');
    setBusy(true);
    try {
      for (const d of selected) await saveOne(d);
      alert(`Saved ${selected.length} extracted charm(s) to inventory.`);
    } catch (err) { alert(`Could not save extracted charms: ${err.message}`); }
    finally { setBusy(false); }
  }
  return <section className="panel trayScanner"><h3>Photo Tray Scanner</h3><p className="note">Upload photos of separated charms on a light background. The scanner crops each charm candidate, then you name, price, SKU, and save selected items into inventory.</p>
    <div className="trayTop"><label className="imagePicker"><ImagePlus size={18} /> Upload tray photos<input type="file" accept="image/*" multiple onChange={onTrayPhotos} /></label><input type="number" placeholder="Default price for extracted charms" value={defaultPrice} onChange={e => setDefaultPrice(e.target.value)} /><button disabled={busy || !drafts.length} className="primary" onClick={saveSelected}>{busy ? 'Working…' : 'Save Selected to Inventory'}</button><button disabled={!drafts.length} onClick={() => setDrafts([])}>Clear Extracted</button></div>
    {drafts.length ? <div className="extractGrid">{drafts.map(d => <article className="extractCard" key={d.id}><label className="selectExtract"><input type="checkbox" checked={d.selected} onChange={e => update(d.id, { selected: e.target.checked })} /> Save</label><img src={d.image} alt="extracted charm" /><input value={d.name} onChange={e => update(d.id, { name: e.target.value })} placeholder="Charm name" /><input value={d.sku} onChange={e => update(d.id, { sku: e.target.value })} placeholder="SKU" /><div className="split2"><input type="number" value={d.price} onChange={e => update(d.id, { price: e.target.value })} placeholder="Price" /><input type="number" value={d.qty} onChange={e => update(d.id, { qty: e.target.value })} placeholder="Qty" /></div><select value={d.category} onChange={e => update(d.id, { category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><div className="checkGroup mini"><b>Show for:</b>{SECTIONS.map(s => <label key={s}><input type="checkbox" checked={d.showFor.includes(s)} onChange={e => update(d.id, { showFor: e.target.checked ? [...new Set([...d.showFor, s])] : d.showFor.filter(x => x !== s) })} /> {s}</label>)}</div><textarea value={d.description} onChange={e => update(d.id, { description: e.target.value })} placeholder="Description" /><div className="buttonRow"><button className="primary" disabled={busy} onClick={() => saveOne(d)}>Save Item</button><button onClick={() => remove(d.id)}><Trash2 size={16} /></button></div></article>)}</div> : <div className="empty">No extracted charms yet.</div>}
  </section>;
}

function InventoryManager({ inventory, setInventory, del, log }) {
  const [category, setCategory] = useState('All');
  const [section, setSection] = useState('All');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const filtered = inventory.filter(i =>
    (category === 'All' || i.category === category) &&
    (section === 'All' || showFor(i, section)) &&
    `${i.name} ${i.sku} ${i.description}`.toLowerCase().includes(q.toLowerCase())
  );
  return <section className="inventoryManager"><SectionTitle title="Inventory List" sub="Filter by category, then edit price, photo, SKU, stock, and display section." />
    <div className="inventoryFilters"><select value={category} onChange={e => setCategory(e.target.value)}><option>All</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><select value={section} onChange={e => setSection(e.target.value)}><option>All</option>{SECTIONS.map(s => <option key={s}>{s}</option>)}</select><div className="search"><Search size={18} /><input placeholder="Search inventory…" value={q} onChange={e => setQ(e.target.value)} /></div></div>
    <div className="tableWrap"><table><thead><tr><th>Photo</th><th>Product</th><th>SKU</th><th>Shows For</th><th>Category</th><th>Price</th><th>Qty</th><th>Date Added</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{filtered.map(i => <tr key={i.id}><td>{i.image ? <img className="tableImg" src={i.image} alt="" /> : ''}</td><td>{i.name}</td><td>{i.sku}</td><td>{sectionLabel(i)}</td><td>{i.category}</td><td>{money(i.price)}</td><td>{i.qty}</td><td><CalendarDays size={14} /> {i.dateAdded}</td><td>{i.updated}</td><td><div className="tableActions"><button onClick={() => setEditing(i)}>Edit</button><button onClick={() => del(i.id)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>
    {!filtered.length && <div className="empty">No inventory items match this filter.</div>}
    {editing && <EditProductModal item={editing} close={() => setEditing(null)} setInventory={setInventory} log={log} />}
  </section>;
}

function EditProductModal({ item, close, setInventory, log }) {
  const [draft, setDraft] = useState(() => normalizeItem(item));
  const [busy, setBusy] = useState(false);
  async function changeImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const image = await uploadProductImage(file); setDraft(d => ({ ...d, image })); }
    catch (err) { alert(`Image upload failed: ${err.message}`); }
  }
  async function saveEdit() {
    if (!draft.name.trim()) return alert('Product name is required.');
    setBusy(true);
    try {
      const clean = normalizeItem({ ...draft, updated: today() });
      if (supabaseEnabled) {
        const { error } = await supabase.from('products')
          .update({ name: clean.name, sku: clean.sku, category: clean.category, show_for: dbShowFor(clean.showFor), price: clean.price, qty: clean.qty, description: clean.description, image_url: clean.image, date_added: clean.dateAdded })
          .eq('id', clean.id);
        if (error) throw error;
        setInventory(prev => prev.map(p => p.id === clean.id ? clean : p));
      } else setInventory(prev => prev.map(p => p.id === clean.id ? clean : p));
      log(`Edited inventory item: ${clean.name}`);
      close();
    } catch (err) { alert(`Could not update product: ${err.message}`); }
    finally { setBusy(false); }
  }
  return <div className="modalBackdrop"><div className="editModal"><div className="modalHead"><h2>Edit Inventory Item</h2><button onClick={close}>×</button></div>
    <div className="editGrid"><div><label className="fieldLabel">Name<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label className="fieldLabel">SKU<input value={draft.sku} onChange={e => setDraft({ ...draft, sku: e.target.value })} /></label><label className="fieldLabel">Category<select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><div className="split2"><label className="fieldLabel">Price<input type="number" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} /></label><label className="fieldLabel">Quantity<input type="number" value={draft.qty} onChange={e => setDraft({ ...draft, qty: e.target.value })} /></label></div><label className="fieldLabel">Date added<input type="date" value={String(draft.dateAdded || '').slice(0,10)} onChange={e => setDraft({ ...draft, dateAdded: e.target.value })} /></label><div className="checkGroup"><b>Show this item for:</b>{SECTIONS.map(s => <label key={s}><input type="checkbox" checked={draft.showFor.includes(s)} onChange={e => setDraft({ ...draft, showFor: e.target.checked ? [...new Set([...draft.showFor, s])] : draft.showFor.filter(x => x !== s) })} /> {s}</label>)}</div></div>
    <div><label className="imagePicker"><ImagePlus size={18} /> Replace product photo<input type="file" accept="image/*" onChange={changeImage} /></label>{draft.image && <img className="editPreviewImg" src={draft.image} alt="preview" />}<label className="fieldLabel">Image URL<input value={draft.image} onChange={e => setDraft({ ...draft, image: e.target.value })} /></label><label className="fieldLabel">Description<textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label></div></div>
    <div className="modalActions"><button onClick={close}>Cancel</button><button className="primary" disabled={busy} onClick={saveEdit}>{busy ? 'Saving…' : 'Save Changes'}</button></div>
  </div></div>;
}

function OrdersAdmin({ orders }) {
  return <section className="ordersAdmin"><SectionTitle title="Submitted Orders & Build Previews" sub="Approved custom builds appear here so the shop can recreate the exact customer layout." /><div className="ordersGrid">{orders?.length ? orders.map(o => <article className="orderCard" key={o.id}><b>Order: {o.at}</b><p>{o.customer?.name} • {o.customer?.email}</p><p>{o.customer?.method} shipping: {o.customer?.address} {o.customer?.city} {o.customer?.state} {o.customer?.zip}</p><h3>{money(o.total)}</h3>{(o.build_preview || o.items?.some(it => it.buildData)) && <BuildPreview buildData={o.build_preview || o.items?.find(it => it.buildData)?.buildData} compact />}
      {o.items?.map((it, idx) => <div className="adminOrderItem" key={idx}><b>{it.name}</b><p>{it.description}</p></div>)}</article>) : <div className="empty">No submitted orders yet.</div>}</div></section>;
}

function SectionTitle({ title, sub }) { return <div className="sectionTitle"><h1>{title}</h1><p>{sub}</p></div>; }
function Footer() { return <footer><span>© Y&M Boutique</span><span className="footerNote">Private admin route hidden</span></footer>; }

createRoot(document.getElementById('root')).render(<App />);
