// Провижининг ОДНОЙ симуляторной компании через реальный WareApp API.
// admin → /companies (создаёт founder) → /branches (+manager) → /users (склад/продавцы/кассиры)
// → /products (каталог) → /stock/income (начальный остаток на каждый филиал) → клиенты (best-effort).
// Токены минтим напрямую (token.js), чтобы не упереться в rate-limit логина.
const cfg = require('./config');
const { api } = require('./wareapp');
const { mint } = require('./token');
const { pool } = require('./db');
const { rnd, rndInt, pmap, shortId } = require('./util');

let _adminToken = null;
async function adminToken() {
  if (_adminToken) return _adminToken;
  const r = await pool.query("SELECT id, username FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  if (!r.rows[0]) throw new Error('admin-пользователь не найден в БД');
  _adminToken = mint({ id: r.rows[0].id, username: r.rows[0].username, role: 'admin', company_id: null, branch_id: null });
  return _adminToken;
}

function must(r, what) {
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`${what}: HTTP ${r.status} ${String(r.raw || '').slice(0, 200)}`);
  }
  return r.body;
}

// spec: { idx, branches, warehouses, sellers, cashiers, products, customers }
async function provisionCompany(spec) {
  const sfx = shortId();
  const at = await adminToken();
  const pw = cfg.defaultPassword;

  // 1) Компания + founder
  const fUser = `sim_f_${spec.idx}_${sfx}`;
  const company = must(await api('POST', '/companies', at, {
    name: `${cfg.simTag} Co ${spec.idx}-${sfx}`,
    address: 'Tashkent', phone: '+998901234567',
    founder_first_name: 'Sim', founder_last_name: `Founder${spec.idx}`,
    gen_dir_username: fUser, gen_dir_password: pw,
  }), 'create company');
  const companyId = company.id;

  // founder id из БД → mint
  const fr = await pool.query("SELECT id FROM users WHERE company_id=$1 AND role IN ('founder','gen_dir') ORDER BY id LIMIT 1", [companyId]);
  if (!fr.rows[0]) throw new Error('founder не создался');
  const founderToken = mint({ id: fr.rows[0].id, username: fUser, role: 'founder', company_id: companyId, branch_id: null });

  // 2) Филиалы + менеджеры + роль-юзеры
  const branches = [];
  for (let b = 1; b <= spec.branches; b++) {
    const mUser = `sim_m_${spec.idx}_${b}_${sfx}`;
    const branch = must(await api('POST', '/branches', founderToken, {
      company_id: companyId, name: `${cfg.simTag} Филиал ${b}`,
      address: `Branch ${b}`, manager_username: mUser, manager_password: pw,
    }), 'create branch');
    const branchId = branch.id;
    const mid = await pool.query('SELECT id FROM users WHERE username=$1 LIMIT 1', [mUser]);
    const managerToken = mid.rows[0] ? mint({ id: mid.rows[0].id, username: mUser, role: 'manager', company_id: companyId, branch_id: branchId }) : null;

    const mkUsers = async (role, n, tag) => {
      const arr = [];
      for (let k = 1; k <= n; k++) {
        const uname = `sim_${tag}_${spec.idx}_${b}_${k}_${sfx}`;
        const u = must(await api('POST', '/users', founderToken, { username: uname, password: pw, role, branch_id: branchId }), `create ${role}`);
        arr.push({ id: u.id, username: uname, token: mint({ id: u.id, username: uname, role, company_id: companyId, branch_id: branchId }) });
      }
      return arr;
    };
    const warehouses = await mkUsers('warehouse', Math.max(1, spec.warehouses), 'w');
    const sellers = await mkUsers('seller', Math.max(1, spec.sellers), 's');
    const cashiers = await mkUsers('cashier', Math.max(1, spec.cashiers), 'c');

    branches.push({ id: branchId, name: branch.name, manager: { username: mUser, password: pw, token: managerToken }, warehouses, sellers, cashiers });
  }

  // 3) Каталог товаров (создаёт warehouse первого филиала — founder не имеет прав на /products)
  const whTok = branches[0].warehouses[0].token;
  const products = await pmap(Array.from({ length: spec.products }, (_, i) => i + 1), 8, async (p) => {
    const priceBuy = Math.round(rnd(5000, 200000) / 100) * 100;
    const priceSell = Math.round((priceBuy * rnd(1.2, 1.8)) / 100) * 100;
    const pr = must(await api('POST', '/products', whTok, {
      name_ru: `${cfg.simTag} Товар ${spec.idx}-${p}`, unit: 'шт', price_buy: priceBuy, price_sell: priceSell,
    }), 'create product');
    return { id: pr.id, price_buy: priceBuy, price_sell: priceSell };
  });

  // 4) Начальный остаток: на каждый филиал по каждому товару (большой, чтобы продажи не упирались)
  for (const br of branches) {
    const wTok = br.warehouses[0].token;
    await pmap(products, 10, async (prod) => {
      await api('POST', '/stock/income', wTok, {
        product_id: prod.id, quantity: cfg.initialStock, price: prod.price_buy,
        payment_status: 'paid', payment_method: 'cash', note: `${cfg.simTag} initial`,
      });
    });
  }

  // 5) Клиенты (best-effort — для CRM/сегментации/лояльности). Если эндпоинт иной — пропускаем.
  const customers = [];
  try {
    await pmap(Array.from({ length: spec.customers || 0 }, (_, i) => i + 1), 8, async (c) => {
      const r = await api('POST', '/customers', founderToken, {
        name: `${cfg.simTag} Клиент ${spec.idx}-${c}`, phone: `+99890${rndInt(1000000, 9999999)}`,
      });
      if (r.status >= 200 && r.status < 300 && r.body && r.body.id) customers.push(r.body.id);
    });
  } catch {}

  return {
    id: companyId, name: company.name,
    founder: { username: fUser, password: pw, token: founderToken },
    branches, products, customers,
    spec,
  };
}

module.exports = { provisionCompany, adminToken };
