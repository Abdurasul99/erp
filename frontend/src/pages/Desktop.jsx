import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { useTranslation } from '../useTranslation.js';
import Navbar from '../components/Navbar.jsx';
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

export default function Desktop() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isGenDir = user?.role === 'gen_dir' || user?.role === 'founder';
  const isManager = user?.role === 'manager';
  const canSeeWarehouse = ['cashier', 'warehouse', 'manager'].includes(user?.role);
  const canSeeCash = ['cashier', 'manager'].includes(user?.role);
  const canSeeProfit = ['gen_dir', 'founder', 'manager'].includes(user?.role);
  const canSeeCustomers = ['cashier', 'manager', 'gen_dir', 'founder'].includes(user?.role);
  const canSeeSuppliers = ['warehouse', 'cashier', 'manager', 'gen_dir', 'founder'].includes(user?.role);

  // Default section based on role
  const { t, lang } = useTranslation();
  const uz = lang === 'uz';
  const defaultSection = isAdmin ? 'admin' : isGenDir ? 'overview' : 'warehouse';
  const defaultTab     = isAdmin ? 'admin' : isGenDir ? 'overview' : 'income';

  const [section, setSection] = useState(defaultSection);
  const [tab, setTab] = useState(defaultTab);


  const warehouseTabs = [
    { key: 'income',   label: t('income') },
    { key: 'b2b',      label: '🏢 ' + (uz ? 'B2B Chiqim' : 'B2B Продажа') },
    { key: 'returns',  label: '↩️ ' + (uz ? 'Vozvrat' : 'Возврат') },
    { key: 'writeoff', label: '🗑️ ' + (uz ? 'Spisanie' : 'Списание') },
    { key: 'balance',  label: t('balance') },
  ];

  const cashTabs = [
    { key: 'cash-income',  label: t('income') },
    { key: 'cash-expense', label: t('outcome') },
    { key: 'cash-report',  label: '📊 ' + (uz ? 'Hisobot' : 'Отчёт') },
  ];

  const sections = isAdmin
    ? [
        { key: 'admin', label: `⚙️ ${t('adminPanel')}` },
      ]
    : isGenDir
    ? [
        { key: 'overview',        label: t('companyOverview') },
        { key: 'profit-section',  label: t('profit') },
        { key: 'team-kpi',        label: '👥 ' + t('teamKpi') },
        { key: 'customers',       label: '🧑 ' + (t('customers') || 'Клиенты') },
        { key: 'suppliers',       label: '📦 ' + (t('suppliers') || 'Поставщики') },
        { key: 'gen-users',       label: t('systemUsers') },
      ]
    : [
        ...(canSeeWarehouse ? [{ key: 'warehouse',       label: t('warehouse') }] : []),
        ...(canSeeCash      ? [{ key: 'cash',            label: t('cash') }] : []),
        ...(canSeeProfit    ? [{ key: 'profit-section',  label: t('profit') }] : []),
        ...(canSeeCustomers ? [{ key: 'customers',       label: '🧑 ' + (t('customers') || 'Клиенты') }] : []),
        ...(canSeeSuppliers ? [{ key: 'suppliers',       label: '📦 ' + (t('suppliers') || 'Поставщики') }] : []),
        ...(isManager       ? [{ key: 'team-kpi',        label: '👥 ' + t('teamKpi') }] : []),
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
      default: return null;
    }
  };

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Navbar activeView="desktop" onViewChange={() => {}} />

      <div style={{ width: '100%', margin: '0 auto', padding: '20px clamp(16px, 2.2vw, 40px)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, boxSizing: 'border-box' }}>
        {/* Section tabs — responsive wrap */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {sections.map(s => (
            <button key={s.key} onClick={() => handleSectionChange(s.key)} style={{
              padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: '14px',
              background: section === s.key ? 'linear-gradient(135deg, #5B4FE8, #3D33C4)' : 'var(--surface)',
              color: section === s.key ? '#fff' : 'var(--text2)',
              boxShadow: section === s.key ? '0 4px 15px rgba(91,79,232,.3)' : 'var(--shadow)',
              transition: 'all .2s', whiteSpace: 'nowrap',
            }}>{s.label}</button>
          ))}
        </div>

        {/* Sub tabs */}
        {currentTabs.length > 0 && (
          <div className="tabs" style={{ marginBottom: '16px', overflowX: 'auto', flexWrap: 'nowrap' }}>
            {currentTabs.map(tb => (
              <button key={tb.key} className={`tab${tab === tb.key ? ' active' : ''}`} onClick={() => setTab(tb.key)} style={{ whiteSpace: 'nowrap' }}>
                {tb.label}
              </button>
            ))}
          </div>
        )}

        {/* Content — main page NEVER scrolls; each section manages its own internal scroll. */}
        <div className="slide-up" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
