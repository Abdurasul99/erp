import React from 'react';
import { t } from '../i18n.js';

// Catches uncaught React render errors and shows a friendly fallback instead of a white screen.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI crash:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
    window.location.href = '/';
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F4F5FA',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', fontFamily: "'Nunito', sans-serif",
      }}>
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '32px',
          maxWidth: '480px', width: '100%',
          boxShadow: '0 12px 40px rgba(0,0,0,.1)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontWeight: 800, fontSize: '20px', color: '#1A1B2E', marginBottom: '8px' }}>
            {t('somethingWrong')}
          </div>
          <div style={{ fontSize: '13px', color: '#9EA3BF', marginBottom: '20px', fontFamily: 'monospace', wordBreak: 'break-word' }}>
            {String(this.state.error?.message || this.state.error || 'Unknown')}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={this.reload}
              style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #4338ca, #6366f1)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 800, fontSize: '14px', fontFamily: "'Nunito', sans-serif", boxShadow: '0 4px 12px rgba(67,56,202,.3)' }}>
              🔄 {t('reload')}
            </button>
            <button onClick={this.reset}
              style={{ padding: '10px 20px', background: '#fff', color: '#6B6F8A', border: '1.5px solid #E2E4F0', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: "'Nunito', sans-serif" }}>
              {t('login')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
