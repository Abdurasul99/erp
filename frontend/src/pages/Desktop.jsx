import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue } from 'framer-motion';
import { AuthContext } from '../App.jsx';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import Navbar from '../components/Navbar.jsx';
import { DockItem } from '../owner/Dock.jsx';
import '../owner/styles.css';
import WarehouseIncome from '../components/WarehouseIncome.jsx';
import WarehouseReturn from '../components/WarehouseReturn.jsx';
import WarehouseWriteoff from '../components/WarehouseWriteoff.jsx';
import WarehouseOutcome from '../components/WarehouseOutcome.jsx';
import WarehouseBalance from '../components/WarehouseBalance.jsx';
import CashIncome from '../components/CashIncome.jsx';
import CashExpense from '../components/CashExpense.jsx';
import CashReport from '../components/CashReport.jsx';
import CashProfit from '../components/CashProfit.jsx';
import UserManager from '../components/UserManager.jsx';
import CompanyManager from '../components/CompanyManager.jsx';
import GenDirDashboard from '../components/GenDirDashboard.jsx';
import GenDirUsers from '../components/GenDirUsers.jsx';
import AdminPanel from '../components/AdminPanel.jsx';
import TeamKPI from '../components/TeamKPI.jsx';
import CustomersManager from '../components/CustomersManager.jsx';
import SuppliersManager from '../components/SuppliersManager.jsx';
import OnlineOrders from '../components/OnlineOrders.jsx';
import MyTasks from '../components/MyTasks.jsx';

// Staff-оболочка /desktop (кассир, складовщик — владельцев и админа сюда не пускает
// RequireNotOwner). Wave Bento-канон: светлый Navbar + macOS-док с разделами
// вместо фиолетовых пилюль; вкладки раздела — сегмент-контрол. Рабочие экраны
// (приход, касса, остатки…) не менялись.

// Иконка и duotone-градиент раздела для дока (канон: без эмодзи).
const SECTION_META = {
  warehouse:        { icon: 'package',  grad: ['#32ADE6', '#0A84FF'] },
  cash:             { icon: 'wallet',   grad: ['#30D158', '#00A88E'] },
  orders:           { icon: 'cart',     grad: ['#FF375F', '#FF9F0A'] },
  'profit-section': { icon: 'trending', grad: ['#FF6B22', '#FFB340'] },
  customers:        { icon: 'client',   grad: ['#5E5CE6', '#32ADE6'] },
  suppliers:        { icon: 'cart',     grad: ['#FF9F0A', '#FF6B22'] },
  'team-kpi':       { icon: 'users',    grad: ['#BF5AF2', '#5E5CE6'] },
  users:            { icon: 'users',    grad: ['#BF5AF2', '#5E5CE6'] },
  overview:         { icon: 'home',     grad: ['#0A84FF', '#5E5CE6'] },
  'gen-users':      { icon: 'users',    grad: ['#BF5AF2', '#5E5CE6'] },
  admin:            { icon: 'settings', grad: ['#8E8E93', '#636366'] },
  tasks:            { icon: 'clipboard', grad: ['#00A88E', '#30D158'] },
};
const gradOf = (key) => {
  const g = (SECTION_META[key] || SECTION_META.overview).grad;
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
};

export default function Desktop() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isGenDir = user?.role === 'director' || user?.role === 'founder';
  const isManager = user?.role === 'manager';
  const canSeeWarehouse = ['cashier', 'warehouse', 'manager'].includes(user?.role);
  const canSeeCash = ['cashier', 'manager'].includes(user?.role);
  const canSeeProfit = ['director', 'founder', 'manager'].includes(user?.role);
  const canSeeCustomers = ['cashier', 'manager', 'director', 'founder'].includes(user?.role);
  const canSeeSuppliers = ['warehouse', 'cashier', 'manager', 'director', 'founder'].includes(user?.role);
  const canSeeTasks = ['cashier', 'warehouse', 'manager'].includes(user?.role);

  // Счётчик активных «моих задач» — для подписи в доке (обновляется при открытии раздела)
  const [taskCount, setTaskCount] = useState(null);
  useEffect(() => {
    if (!canSeeTasks) return;
    api.get('/tasks/my').then(r => setTaskCount(r.data?.metrics?.active ?? 0)).catch(() => {});
  }, [canSeeTasks]);

  // Default section based on role
  const { t, lang } = useTranslation();
  const uz = lang === 'uz';
  const defaultSection = isAdmin ? 'admin' : isGenDir ? 'overview' : 'warehouse';
  const defaultTab     = isAdmin ? 'admin' : isGenDir ? 'overview' : 'income';

  const [section, setSection] = useState(defaultSection);
  const [tab, setTab] = useState(defaultTab);

  const warehouseTabs = [
    { key: 'income',   label: t('income') },
    { key: 'b2b',      label: uz ? 'B2B Chiqim' : 'B2B Продажа' },
    { key: 'returns',  label: uz ? 'Vozvrat' : 'Возврат' },
    { key: 'writeoff', label: uz ? 'Spisanie' : 'Списание' },
    { key: 'balance',  label: t('balance') },
  ];

  const cashTabs = [
    { key: 'cash-income',  label: t('income') },
    { key: 'cash-expense', label: t('outcome') },
    { key: 'cash-report',  label: uz ? 'Hisobot' : 'Отчёт' },
  ];

  const sections = isAdmin
    ? [
        { key: 'admin', label: t('adminPanel') },
      ]
    : isGenDir
    ? [
        { key: 'overview',        label: t('companyOverview') },
        { key: 'profit-section',  label: t('profit') },
        { key: 'team-kpi',        label: t('teamKpi') },
        { key: 'customers',       label: t('customers') || 'Клиенты' },
        { key: 'suppliers',       label: t('suppliers') || 'Поставщики' },
        { key: 'gen-users',       label: t('systemUsers') },
      ]
    : [
        ...(canSeeWarehouse ? [{ key: 'warehouse',       label: t('warehouse') }] : []),
        ...(canSeeCash      ? [{ key: 'cash',            label: t('cash') }] : []),
        // Заказы с интернет-магазина — кассир обрабатывает заявки на месте.
        ...(canSeeCash      ? [{ key: 'orders',          label: uz ? 'Saytdan buyurtmalar' : 'Заказы с сайта' }] : []),
        ...(canSeeTasks     ? [{ key: 'tasks',           label: (uz ? 'Vazifalar' : 'Задачи') + (taskCount ? ` (${taskCount})` : '') }] : []),
        ...(canSeeProfit    ? [{ key: 'profit-section',  label: t('profit') }] : []),
        ...(canSeeCustomers ? [{ key: 'customers',       label: t('customers') || 'Клиенты' }] : []),
        ...(canSeeSuppliers ? [{ key: 'suppliers',       label: t('suppliers') || 'Поставщики' }] : []),
        ...(isManager       ? [{ key: 'team-kpi',        label: t('teamKpi') }] : []),
        ...(isManager       ? [{ key: 'users',           label: t('staff') }] : []),
      ];

  const handleSectionChange = (s) => {
    setSection(s);
    const firstTab = {
      admin: 'admin', warehouse: 'income', cash: 'cash-income',
      overview: 'overview', companies: 'companies',
      'profit-section': 'profit', users: 'users',
      'gen-users': 'gen-users', 'team-kpi': 'team-kpi',
      customers: 'customers', suppliers: 'suppliers',
      orders: 'orders', tasks: 'tasks',
    };
    setTab(firstTab[s] || s);
  };

  const currentTabs = isAdmin ? [] : section === 'warehouse' ? warehouseTabs : section === 'cash' ? cashTabs : [];

  const renderContent = () => {
    switch (tab) {
      case 'admin': return <AdminPanel />;
      case 'overview': return <GenDirDashboard />;
      case 'gen-users': return <GenDirUsers />;
      case 'income': return <WarehouseIncome />;
      case 'b2b': return <WarehouseOutcome />;
      case 'returns': return <WarehouseReturn />;
      case 'writeoff': return <WarehouseWriteoff />;
      case 'balance': return <WarehouseBalance />;
      case 'cash-income': return <CashIncome />;
      case 'cash-expense': return <CashExpense />;
      case 'cash-report': return <CashReport />;
      case 'profit': return <CashProfit />;
      case 'users': return <UserManager />;
      case 'team-kpi': return <TeamKPI />;
      case 'companies': return <CompanyManager />;
      case 'customers': return <CustomersManager />;
      case 'suppliers': return <SuppliersManager />;
      case 'orders': return <OnlineOrders />;
      case 'tasks': return <MyTasks onCount={setTaskCount} />;
      default: return null;
    }
  };

  return (
    <StaffShell
      sections={sections}
      section={section}
      onSection={handleSectionChange}
      currentTabs={currentTabs}
      tab={tab}
      setTab={setTab}
    >
      {renderContent()}
    </StaffShell>
  );
}

// Оболочка: Navbar сверху, вкладки раздела сегмент-контролом, контент (со своим
// внутренним скроллом), macOS-док с разделами снизу.
function StaffShell({ sections, section, onSection, currentTabs, tab, setTab, children }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <div className="owner-shell dock-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Navbar activeView="desktop" onViewChange={() => {}} />

      <div style={{ width: '100%', padding: '16px clamp(14px, 2vw, 32px) 0', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, boxSizing: 'border-box' }}>
        {/* Вкладки текущего раздела — сегмент-контрол */}
        {currentTabs.length > 0 && (
          <div className="hub-tabs" role="tablist" style={{ marginBottom: 14, alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}>
            {currentTabs.map(tb => (
              <button key={tb.key} type="button" role="tab" aria-selected={tab === tb.key}
                className={'hub-tab' + (tab === tb.key ? ' active' : '')}
                onClick={() => setTab(tb.key)} style={{ whiteSpace: 'nowrap' }}>
                {tb.label}
              </button>
            ))}
          </div>
        )}

        {/* Контент — страница не скроллится; каждый экран скроллит себя сам.
            Снизу — клиренс под док. */}
        <div className="slide-up" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 86 }}>
          {children}
        </div>
      </div>

      {/* macOS-док: разделы роли */}
      <div className="dock-wrap">
        <motion.div
          className="dock"
          onMouseMove={(e) => mouseX.set(e.clientX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 38, delay: 0.1 }}
        >
          {sections.map(s => (
            <DockItem
              key={s.key}
              title={s.label}
              label={s.label}
              showLabel
              icon={(SECTION_META[s.key] || SECTION_META.overview).icon}
              bg={gradOf(s.key)}
              active={section === s.key}
              mouseX={mouseX}
              onClick={() => onSection(s.key)}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
