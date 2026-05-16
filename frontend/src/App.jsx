import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, TrendingUp, Award, BarChart3, Building2, Search, 
  UploadCloud, AlertTriangle, MessageSquare, ChevronRight,
  Target, Shield, Zap, Globe, Layers, Command, LayoutGrid,
  Settings, User, Bell, ExternalLink, ArrowUpRight, CheckCircle2,
  Loader2, Trash2, X, AlertCircle, Info
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell
} from 'recharts';

const COLORS = {
  emerald: '#10b981',
  indigo: '#6366f1',
  rose: '#f43f5e',
  slate: '#0f172a'
};

const F = {
  mad: v => v ? (v/1e6).toFixed(1) + ' MDH' : '—',
  pct: v => v ? (v*100).toFixed(1) + '%' : '—',
  x:   v => v ? v.toFixed(2) + 'x' : '—'
};


const TABS = [
  { id: 'dash',   Icon: LayoutGrid, label: 'Tableau de bord' },
  { id: 'etats',  Icon: Layers, label: 'États Financiers' },
  { id: 'ratios', Icon: Activity, label: 'Ratios & Analyse' },
  { id: 'analyse',Icon: Shield, label: 'Assistant IA' },
  { id: 'docs',   Icon: Globe, label: 'Collecte & Rapports' }
];

const UPLOAD_STEPS = [
  { id: 'upload', label: 'Ingestion du PDF' },
  { id: 'extract', label: 'Extraction des Données' },
  { id: 'compute', label: 'Calcul des Ratios' },
  { id: 'ai', label: 'Synthèse Intelligente' }
];

function Badge({ children, type = 'emerald' }) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    indigo: 'bg-emerald-50 text-emerald-600 border-indigo-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${styles[type]}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, Icon, trend = null }) {
  return (
    <div className="premium-card p-6 stagger-item">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
          <Icon size={20}/>
        </div>
        {trend && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${trend.startsWith('+') ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            <TrendingUp size={12} className={trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500 rotate-180'}/>
            <span className={`text-[10px] font-bold ${trend.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>{trend}</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

const Modal = ({ show, title, message, onConfirm, onCancel, type = 'info' }) => {
  if (!show) return null;
  const isDanger = type === 'danger';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onCancel} />
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden reveal-up">
        <div className={`h-2 ${isDanger ? 'bg-rose-500' : 'bg-emerald-500'}`} />
        <div className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDanger ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {isDanger ? <AlertCircle size={24}/> : <Info size={24}/>}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{message}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-6 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-all">
              {onConfirm ? 'Annuler' : 'Fermer'}
            </button>
            {onConfirm && (
              <button onClick={onConfirm} className={`flex-1 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg transition-all ${isDanger ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'}`}>
                Confirmer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const customTooltip = { 
  backgroundColor: '#fff', 
  border: '1px solid #f1f5f9', 
  borderRadius: '12px', 
  fontSize: '12px', 
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' 
};

export default function App() {
  const [board, setBoard] = useState([]);
  const [co, setCo] = useState(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('dash');

  // DOCUMENTS & SCRAPING STATE
  const [documents, setDocuments] = useState([]);
  const [sources, setSources] = useState([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  
  // CHAT STATE
  const [chatMsg, setChatMsg] = useState('');
  const [chatResp, setChatResp] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  
  // STEPWISE LOADING STATE
  const [ingesting, setIngesting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0 to 3
  
  // MODAL STATE
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info', onConfirm: null });

  // AUTH STATE
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('cdg_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [updateUsername, setUpdateUsername] = useState('');
  const [updatePassword, setUpdatePassword] = useState('');
  const [updateConfirmPassword, setUpdateConfirmPassword] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  // ALERTS STATE
  const [alerts, setAlerts] = useState([]);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);

  const ref = useRef();

  useEffect(() => { 
    if (user) {
      loadBoard(); 
      loadAlerts();
    }
    const interval = setInterval(() => {
      if (user) loadAlerts();
    }, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [user]);

  const loadDocuments = async () => {
    try {
      const r = await fetch('http://localhost:8000/api/documents');
      const d = await r.json();
      setDocuments(d);
    } catch (e) {
      console.error("Error loading documents:", e);
    }
  };

  const loadSources = async () => {
    try {
      const r = await fetch('http://localhost:8000/api/sources');
      const d = await r.json();
      setSources(d);
    } catch (e) {
      console.error("Error loading sources:", e);
    }
  };

  useEffect(() => {
    if (tab === 'docs') {
      loadDocuments();
      loadSources();
    }
  }, [tab]);

  const handleAddSource = async (e) => {
    e.preventDefault();
    if (!newSourceName || !newSourceUrl) return;
    try {
      const r = await fetch('http://localhost:8000/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSourceName, url: newSourceUrl })
      });
      const d = await r.json();
      if (r.ok) {
        setSources(prev => [...prev, d]);
        setNewSourceName('');
        setNewSourceUrl('');
        setShowAddSource(false);
        setModal({
          show: true,
          title: 'Source Ajoutée',
          message: 'La source de collecte automatique a été ajoutée avec succès.',
          type: 'info'
        });
      } else {
        setModal({
          show: true,
          title: 'Erreur',
          message: d.detail || "Impossible d'ajouter la source.",
          type: 'danger'
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSource = async (sourceId) => {
    setModal({
      show: true,
      title: 'Supprimer la source',
      message: 'Voulez-vous vraiment supprimer cette source de collecte automatique ?',
      type: 'danger',
      onConfirm: async () => {
        try {
          const r = await fetch(`http://localhost:8000/api/sources/${sourceId}`, { method: 'DELETE' });
          if (r.ok) {
            setSources(prev => prev.filter(s => s.id !== sourceId));
            setModal(p => ({ ...p, show: false }));
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
  };

  const handleTriggerScraping = async () => {
    setScrapingLoading(true);
    try {
      const r = await fetch('http://localhost:8000/api/sources/trigger', { method: 'POST' });
      const d = await r.json();
      if (r.ok) {
        setModal({
          show: true,
          title: 'Collecte Lancée',
          message: 'La collecte automatique a été démarrée en arrière-plan. Les nouveaux rapports PDF trouvés apparaîtront sous peu.',
          type: 'info'
        });
        setTimeout(() => {
          loadSources();
          loadDocuments();
          loadBoard();
          loadAlerts();
        }, 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScrapingLoading(false);
    }
  };

  const handleDownloadDocument = (docId, filename) => {
    window.open(`http://localhost:8000/api/documents/${docId}/download`, '_blank');
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError('');
    setSignupSuccess('');
    
    if (signupPassword !== signupConfirmPassword) {
      setSignupError("Les mots de passe ne correspondent pas.");
      return;
    }
    
    try {
      const r = await fetch('http://localhost:8000/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: signupUsername, password: signupPassword })
      });
      const d = await r.json();
      if (r.ok && d.status === 'success') {
        setSignupSuccess("Compte créé avec succès ! Connexion en cours...");
        setTimeout(() => {
          const userData = { username: d.username, role: d.role };
          setUser(userData);
          localStorage.setItem('cdg_user', JSON.stringify(userData));
          setSignupUsername('');
          setSignupPassword('');
          setSignupConfirmPassword('');
          setSignupSuccess('');
        }, 1500);
      } else {
        setSignupError(d.detail || "Erreur lors de l'inscription.");
      }
    } catch (err) {
      console.error(err);
      setSignupError("Erreur de connexion au serveur.");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdateError('');
    setUpdateSuccess('');
    
    if (updatePassword && updatePassword !== updateConfirmPassword) {
      setUpdateError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    
    try {
      const r = await fetch('http://localhost:8000/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          new_username: updateUsername || null,
          new_password: updatePassword || null
        })
      });
      const d = await r.json();
      if (r.ok && d.status === 'success') {
        setUpdateSuccess("Profil mis à jour avec succès !");
        const updatedUser = { username: d.username, role: d.role };
        setTimeout(() => {
          setUser(updatedUser);
          localStorage.setItem('cdg_user', JSON.stringify(updatedUser));
          setShowProfileModal(false);
          setUpdateUsername('');
          setUpdatePassword('');
          setUpdateConfirmPassword('');
          setUpdateSuccess('');
        }, 1500);
      } else {
        setUpdateError(d.detail || "Erreur lors de la mise à jour.");
      }
    } catch (err) {
      console.error(err);
      setUpdateError("Erreur de connexion au serveur.");
    }
  };

  const openProfileModal = () => {
    setUpdateUsername(user?.username || '');
    setUpdatePassword('');
    setUpdateConfirmPassword('');
    setUpdateError('');
    setUpdateSuccess('');
    setShowProfileModal(true);
    setShowProfileDropdown(false);
  };

  const loadAlerts = async () => {
    try {
      const r = await fetch('http://localhost:8000/api/alerts');
      const d = await r.json();
      setAlerts(d);
    } catch (e) {
      console.error("Error loading alerts:", e);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const r = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const d = await r.json();
      if (r.ok && d.status === 'success') {
        const userData = { username: d.username, role: d.role };
        setUser(userData);
        localStorage.setItem('cdg_user', JSON.stringify(userData));
        setShowLoginModal(false);
        setLoginUsername('');
        setLoginPassword('');
      } else {
        setLoginError(d.detail || "Nom d'utilisateur ou mot de passe incorrect.");
      }
    } catch (err) {
      console.error(err);
      setLoginError("Erreur de connexion au serveur.");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cdg_user');
    setShowProfileDropdown(false);
  };

  const handleMarkAlertRead = async (alertId) => {
    try {
      const r = await fetch(`http://localhost:8000/api/alerts/${alertId}/read`, { method: 'POST' });
      if (r.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: 1 } : a));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAlertsRead = async () => {
    try {
      const r = await fetch('http://localhost:8000/api/alerts/read-all', { method: 'POST' });
      if (r.ok) {
        setAlerts(prev => prev.map(a => ({ ...a, is_read: 1 })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAlert = async (e, alertId) => {
    e.stopPropagation();
    try {
      const r = await fetch(`http://localhost:8000/api/alerts/${alertId}`, { method: 'DELETE' });
      if (r.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    } catch (e) {
      console.error("Error deleting alert:", e);
    }
  };

  const handleClearAlerts = async (onlyRead = false) => {
    try {
      const r = await fetch(`http://localhost:8000/api/alerts?only_read=${onlyRead}`, { method: 'DELETE' });
      if (r.ok) {
        if (onlyRead) {
          setAlerts(prev => prev.filter(a => !a.is_read));
        } else {
          setAlerts([]);
        }
      }
    } catch (e) {
      console.error("Error clearing alerts:", e);
    }
  };


  const loadBoard = async () => {
    try {
      const r = await fetch('http://localhost:8000/companies');
      const d = await r.json();
      setBoard(d);
      if (d.length > 0 && !co) pick(d[0].company_name);
    } catch (e) { console.error(e); }
  };

  const pick = async (name) => {
    try {
      const r = await fetch(`http://localhost:8000/analysis/${encodeURIComponent(name)}`);
      const d = await r.json();
      setCo(d);
    } catch (e) { console.error(e); }
  };

  const remove = async (e, name) => {
    e.stopPropagation();
    setModal({
      show: true,
      title: 'Supprimer l\'Analyse',
      message: `Êtes-vous sûr de vouloir supprimer l'analyse de ${name} ? Cette action est irréversible.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await fetch(`http://localhost:8000/analysis/${name}`, { method: 'DELETE' });
          const r = await fetch('http://localhost:8000/companies');
          const d = await r.json();
          setBoard(d);
          if (co?.name === name) {
            if (d.length > 0) {
              await pick(d[0].company_name);
            } else {
              setCo(null);
            }
          }
          setModal(p => ({ ...p, show: false }));
        } catch (err) { console.error(err); }
      }
    });
  };

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIngesting(true);
    setCurrentStep(0); // Uploading
    
    const fd = new FormData();
    fd.append('file', file);
    
    try {
      // Use the ingestion endpoint to save to DB
      const r = await fetch('http://localhost:8000/api/ingest/pdf', { method:'POST', body:fd });
      const d = await r.json();
      
      if (d.status === 'success') {
        setCurrentStep(3); // Complete
        setTimeout(async () => {
          await loadBoard();
          await pick(d.company_name);
          await loadAlerts();
          setIngesting(false);
        }, 1000);
      } else {
        throw new Error(d.detail || 'Erreur d\'ingestion');
      }

    } catch (err) { 
      console.error(err); 
      setIngesting(false);
      setModal({
        show: true,
        title: 'Erreur d\'Ingestion',
        message: err.message,
        type: 'danger'
      });
    }
  };

  const ask = async () => {
    if (!chatMsg || !co) return;
    setChatLoading(true);
    setChatResp(null);
    try {
      const r = await fetch(`http://localhost:8000/chat?question=${encodeURIComponent(chatMsg)}&company_name=${encodeURIComponent(co.name)}`, { method: 'POST' });
      const d = await r.json();
      setChatResp(d.answer);
    } catch (e) { console.error(e); }
    setChatLoading(false);
  };

  const lr = Array.isArray(co?.ratios) ? co.ratios[co.ratios.length - 1] : null;
  const pr = Array.isArray(co?.ratios) ? co.ratios[co.ratios.length - 2] : null;
  
  const la = co?.ai_analysis || co?.executive_summary; // Support both structures
  const chartData = Array.isArray(co?.ratios) ? co.ratios.map(r => ({ y: r.year, ROE: (r.roe||0)*100, EBITDA: (r.ebitda_margin||0)*100 })) : [];
  const radarData = lr ? [
    { m: 'ROE', v: (lr.roe||0)*100 },
    { m: 'ROA', v: (lr.roa||0)*100 },
    { m: 'Profit', v: (lr.net_margin||0)*100 },
    { m: 'EBITDA', v: (lr.ebitda_margin||0)*100 },
    { m: 'Solvabilité', v: lr.debt_to_equity ? (1/lr.debt_to_equity)*25 : 0 } 
  ] : [];

  // DYNAMIC TREND CALCULATION
  const getTrend = (curr, prev) => {
    if (!curr || !prev) return null;
    const diff = ((curr - prev) / prev) * 100;
    return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
  };

  if (!user) {
    return (
      <div className="flex h-screen w-screen overflow-hidden font-sans">
        <div className="bg-mesh" />
        
        {/* Split grid layout: left column highlights features, right column handles forms */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 h-full w-full">
          
          {/* LEFT PANEL: Platform Pitch & Features */}
          <div className="hidden lg:flex lg:col-span-7 bg-slate-950 flex-col justify-between p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,#047857,transparent_55%)] opacity-30 pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(15,23,42,0.8))] pointer-events-none" />
            
            {/* Header branding */}
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-900/30">
                <Globe size={24} className="text-white animate-pulse"/>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white font-display">CDG Capital</h1>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">Intelligence Financière</p>
              </div>
            </div>

            {/* Core pitch */}
            <div className="max-w-xl relative z-10">
              <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-6">
                L'analyse financière propulsée par l'intelligence artificielle.
              </h2>
              <p className="text-slate-400 text-base font-medium leading-relaxed mb-12">
                Conçu exclusivement pour les analystes et professionnels de l'investissement. Automatisez l'extraction de vos bilans comptables et comptes de produits et charges (CPC) en conformité avec les normes PCGE marocaines.
              </p>

              {/* Grid of features */}
              <div className="grid grid-cols-2 gap-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <UploadCloud size={20}/>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Ingestion PDF Automatisée</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-normal">Extraction instantanée des liasses fiscales et états financiers.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <Activity size={20}/>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Calculateur de Ratios</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-normal">Génération dynamique des ratios de rentabilité, liquidité et solvabilité.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <Shield size={20}/>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Analyse Synthétique IA</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-normal">Points de vigilance et rapports sectoriels rédigés par Claude 3.5.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <MessageSquare size={20}/>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Assistant Interactif</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-normal">Chat intelligent pour poser vos questions complexes sur les rapports financiers.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-widest relative z-10 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Terminal Sécurisé — Accès Réservé CDG Capital & Portefeuille Global
            </div>
          </div>
          
          {/* RIGHT PANEL: Auth Card */}
          <div className="lg:col-span-5 flex items-center justify-center p-8 bg-slate-50/50 backdrop-blur-md">
            <div className="w-full max-w-md premium-card p-10 bg-white shadow-2xl reveal-up border border-slate-100 relative">
              <div className="absolute top-0 inset-x-0 h-2 bg-emerald-600 rounded-t-[24px]" />
              
              {/* Branding for mobile/tablet screens */}
              <div className="flex items-center gap-3 mb-8 lg:hidden justify-center">
                <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                  <Globe size={18}/>
                </div>
                <h1 className="text-lg font-bold text-slate-900">CDG Capital</h1>
              </div>

              {/* Welcome text */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {authMode === 'login' ? 'Bienvenue sur le Terminal' : 'Créer votre compte'}
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                  {authMode === 'login' ? 'Connectez-vous pour continuer' : 'Rejoindre la plateforme financière'}
                </p>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 mb-8">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setLoginError(''); setSignupError(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${authMode === 'login' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setLoginError(''); setSignupError(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${authMode === 'signup' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  S'inscrire
                </button>
              </div>

              {/* Forms */}
              {authMode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">Identifiant</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={loginUsername}
                        onChange={e => setLoginUsername(e.target.value)}
                        required
                        placeholder="Ex: admin"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50/50 focus:border-emerald-500 transition-all text-slate-800"
                      />
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">Mot de passe</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50/50 focus:border-emerald-500 transition-all text-slate-800"
                      />
                      <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                    </div>
                  </div>

                  {loginError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <AlertCircle size={14} className="shrink-0"/>
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-100 hover:shadow-emerald-200 active:scale-98 transition-all flex items-center justify-center gap-2 mt-4"
                  >
                    <span>Se connecter</span>
                    <ChevronRight size={14}/>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignup} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">Identifiant</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={signupUsername}
                        onChange={e => setSignupUsername(e.target.value)}
                        required
                        placeholder="Créer un identifiant..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50/50 focus:border-emerald-500 transition-all text-slate-800"
                      />
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">Mot de passe</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        value={signupPassword}
                        onChange={e => setSignupPassword(e.target.value)}
                        required
                        placeholder="Créer un mot de passe..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50/50 focus:border-emerald-500 transition-all text-slate-800"
                      />
                      <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">Confirmer le mot de passe</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        value={signupConfirmPassword}
                        onChange={e => setSignupConfirmPassword(e.target.value)}
                        required
                        placeholder="Confirmer votre mot de passe..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50/50 focus:border-emerald-500 transition-all text-slate-800"
                      />
                      <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                    </div>
                  </div>

                  {signupError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <AlertCircle size={14} className="shrink-0"/>
                      <span>{signupError}</span>
                    </div>
                  )}

                  {signupSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-semibold text-emerald-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <CheckCircle2 size={14} className="shrink-0"/>
                      <span>{signupSuccess}</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-100 hover:shadow-emerald-200 active:scale-98 transition-all flex items-center justify-center gap-2 mt-4"
                  >
                    <span>S'inscrire</span>
                    <ChevronRight size={14}/>
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="bg-mesh" />
      
      {/* ── SIDEBAR ── */}
      <aside className="w-[280px] bg-white border-r border-slate-100 flex flex-col z-50 shrink-0 h-full">
        {/* Sidebar Header */}
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Globe size={22} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">CDG Capital</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Intelligence Financière</p>
            </div>
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Entités du Portefeuille</div>
          
          {/* SEARCH BAR IN SIDEBAR */}
          <div className="px-2 mb-6">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-50 focus-within:border-emerald-200 transition-all">
              <Search size={14} className="text-slate-400"/>
              <input 
                value={q} 
                onChange={e=>setQ(e.target.value)} 
                onKeyDown={e=>e.key==='Enter'&&pick(q)}
                placeholder="Rechercher..."
                className="bg-transparent border-none outline-none text-[11px] font-bold w-full placeholder:text-slate-400 text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Company List */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-1">
          {board
            .filter(item => item.company_name.toLowerCase().includes(q.toLowerCase()) || (item.ticker && item.ticker.toLowerCase().includes(q.toLowerCase())))
            .map((item, i) => {
            const active = co?.name === item.company_name;
            return (
              <div 
                key={i} 
                onClick={() => pick(item.company_name)}
                className={`w-full group nav-item cursor-pointer relative ${active ? 'nav-item-active' : 'nav-item-inactive'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-600' : 'bg-slate-200'}`}/>
                <span className="truncate flex-1 text-left">{item.company_name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {active && <ChevronRight size={14} className="opacity-40 group-hover:hidden"/>}
                  <button 
                    onClick={(e) => remove(e, item.company_name)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all text-slate-400"
                  >
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer (Fixed) */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100">
          
          <input type="file" ref={ref} onChange={upload} accept="application/pdf" className="hidden"/>
          <button 
            onClick={()=>ref.current?.click()} 
            disabled={ingesting}
            className="w-full py-3 btn-primary flex items-center justify-center gap-2"
          >
            {ingesting ? <Loader2 size={16} className="animate-spin text-white/60"/> : <UploadCloud size={16}/>}
            <span className="text-xs uppercase tracking-wider">{ingesting ? 'Analyse...' : 'Importer PDF'}</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        
        {/* STEPWISE OVERLAY */}
        {ingesting && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-[100] flex items-center justify-center">
            <div className="w-[400px] bg-white premium-card p-10 reveal-up">
              <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                <Loader2 className="animate-spin text-emerald-600" size={24}/>
                Analyse Intelligente en Cours
              </h3>
              <div className="space-y-6">
                {UPLOAD_STEPS.map((step, idx) => {
                  const done = idx < currentStep;
                  const active = idx === currentStep;
                  return (
                    <div key={step.id} className={`flex items-center gap-4 transition-opacity duration-500 ${!active && !done ? 'opacity-40' : 'opacity-100'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 ${done ? 'bg-emerald-100 text-emerald-600' : active ? 'bg-emerald-600 text-white scale-110 shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                        {done ? <CheckCircle2 size={14}/> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                      </div>
                      <span className={`text-sm font-bold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</span>
                      {active && <div className="ml-auto w-1 h-1 bg-emerald-600 rounded-full animate-ping"/>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-10 gap-8 shrink-0 sticky top-0 z-40">
          <div className="flex-1 flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
              <Command size={20}/>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate">
                  {co ? co.name : 'Système Prêt'}
                </h2>
                {co && <Badge type="slate">{co.ticker}</Badge>}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1"><Globe size={11}/> Portefeuille Global</span>
                <div className="w-1 h-1 rounded-full bg-slate-200"/>
                <span className="text-emerald-500 flex items-center gap-1"><Shield size={11}/> Analyse Sécurisée</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 relative">
            
            {/* BELL BUTTON & DROPDOWN */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowAlertsDropdown(!showAlertsDropdown);
                  setShowProfileDropdown(false);
                }} 
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all relative ${showAlertsDropdown ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-100 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
              >
                <Bell size={18}/>
                {alerts.filter(a => !a.is_read).length > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 min-w-5 h-5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center px-1 text-[9px] font-bold text-white">
                    {alerts.filter(a => !a.is_read).length}
                  </div>
                )}
              </button>

              {showAlertsDropdown && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-[100] overflow-hidden">
                  <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Alertes & Notifications</span>
                    <div className="flex items-center gap-2.5">
                      {alerts.filter(a => !a.is_read).length > 0 && (
                        <button 
                          onClick={handleMarkAllAlertsRead}
                          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider transition-colors"
                        >
                          Tout lire
                        </button>
                      )}
                      {alerts.length > 0 && (
                        <button 
                          onClick={() => handleClearAlerts(false)}
                          className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider transition-colors"
                        >
                          Effacer tout
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {alerts.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 font-medium">
                        Aucune notification pour le moment.
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div 
                          key={alert.id} 
                          onClick={() => !alert.is_read && handleMarkAlertRead(alert.id)}
                          className={`p-4 flex gap-3 cursor-pointer transition-colors relative group ${alert.is_read ? 'opacity-60 bg-white hover:bg-slate-50/30' : 'bg-emerald-50/20 hover:bg-emerald-50/40'}`}
                        >
                          <div className="shrink-0 mt-0.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${alert.type === 'danger' ? 'bg-rose-500' : alert.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <div className="text-xs font-bold text-slate-800 truncate">{alert.title}</div>
                            <div className="text-[11px] font-semibold text-slate-500 mt-0.5 leading-normal">{alert.message}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                              {new Date(alert.created_at).toLocaleString('fr-FR', {day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                          <button 
                            onClick={(e) => handleDeleteAlert(e, alert.id)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100/50"
                            title="Supprimer la notification"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* USER BUTTON & DROPDOWN */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowProfileDropdown(!showProfileDropdown);
                  setShowAlertsDropdown(false);
                }}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all text-xs font-bold ${showProfileDropdown ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-100 hover:bg-emerald-700'}`}
              >
                {user.username.substring(0, 2).toUpperCase()}
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in duration-200">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <User size={12} className="text-emerald-600"/>
                      <span className="truncate">{user.username}</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 ml-5">{user.role}</div>
                  </div>
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={openProfileModal}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-all flex items-center gap-2"
                    >
                      <Settings size={14}/>
                      Mettre à jour le profil
                    </button>
                    <div className="h-px bg-slate-100 my-1 mx-2" />
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all flex items-center gap-2"
                    >
                      <X size={14}/>
                      Se Déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* SUB NAVIGATION */}
        <nav className="h-14 bg-white border-b border-slate-50 flex items-end px-10 gap-2 shrink-0">
          {TABS.map(({id,Icon,label}) => (
            <button 
              key={id} 
              onClick={() => setTab(id)}
              className={`px-4 pb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all relative ${tab === id ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Icon size={14}/>
              {label}
              {tab === id && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-t-full shadow-lg shadow-emerald-200"/>}
            </button>
          ))}
        </nav>

        {/* SCROLL VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-10">
          
          {tab === 'docs' ? (
            <div className="space-y-10 reveal-up animate-in fade-in duration-300">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                {/* LEFT COLUMN: Sources & Scraping */}
                <div className="xl:col-span-4 space-y-8 animate-in slide-in-from-left duration-500">
                  
                  {/* TRIGGER COLLECTE CARD */}
                  <div className="premium-card p-8 bg-slate-900 text-white relative overflow-hidden shadow-xl shadow-slate-950/10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        <Globe className="text-emerald-400" size={24}/>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-100">Collecte Web Directe</h4>
                      </div>
                      <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-6">
                        Lancez un scan intelligent des sites officiels pour découvrir, télécharger et ingérer automatiquement les nouveaux rapports PDF.
                      </p>
                      
                      <button 
                        onClick={handleTriggerScraping}
                        disabled={scrapingLoading}
                        className="w-full btn-primary py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl transition-all shadow-lg shadow-emerald-950/50"
                      >
                        {scrapingLoading ? (
                          <>
                            <Loader2 size={16} className="animate-spin"/>
                            <span>Collecte en cours...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={16} className="text-emerald-300 animate-pulse"/>
                            <span>Lancer la collecte</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* CONFIG SOURCES CARD */}
                  <div className="premium-card p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Sources de collecte</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Sites cibles à analyser</p>
                      </div>
                      <button 
                        onClick={() => setShowAddSource(!showAddSource)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 uppercase hover:bg-slate-50 transition-all"
                      >
                        {showAddSource ? 'Fermer' : 'Ajouter'}
                      </button>
                    </div>

                    {showAddSource && (
                      <form onSubmit={handleAddSource} className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 reveal-up">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nom de la source</label>
                          <input 
                            type="text"
                            value={newSourceName}
                            onChange={e => setNewSourceName(e.target.value)}
                            placeholder="ex: Bourse de Casablanca"
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">URL de la page</label>
                          <input 
                            type="url"
                            value={newSourceUrl}
                            onChange={e => setNewSourceUrl(e.target.value)}
                            placeholder="https://..."
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <button 
                          type="submit"
                          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-slate-200"
                        >
                          Sauvegarder la source
                        </button>
                      </form>
                    )}

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {sources.map(source => (
                        <div key={source.id} className="p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 flex items-start justify-between transition-colors">
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-bold text-slate-800 truncate">{source.name}</div>
                            <a href={source.url} target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 font-semibold hover:underline flex items-center gap-0.5 mt-0.5 truncate">
                              {source.url} <ExternalLink size={8}/>
                            </a>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge type={source.status === 'success' ? 'emerald' : source.status === 'failed' ? 'rose' : 'slate'}>
                                {source.status === 'success' ? 'Actif' : source.status === 'failed' ? 'Échec' : 'Jamais Scanné'}
                              </Badge>
                              {source.last_scraped && (
                                <span className="text-[9px] text-slate-400 font-bold">
                                  {new Date(source.last_scraped).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDeleteSource(source.id)}
                            className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      ))}
                    </div>

                  </div>

                </div>

                {/* RIGHT COLUMN: Documents Ingested Table */}
                <div className="xl:col-span-8 space-y-8 animate-in slide-in-from-right duration-500">
                  
                  <div className="premium-card overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Archive des Liasses et Rapports PDF</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Documents originaux conservés sur le serveur</p>
                      </div>
                      <Badge type="indigo">{documents.length} PDF stockés</Badge>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entreprise</th>
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fichier PDF</th>
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date d'import</th>
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provenance</th>
                            <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {documents.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-8 py-12 text-center text-xs text-slate-400 font-semibold">
                                Aucun rapport PDF n'a été collecté ou importé pour le moment.
                              </td>
                            </tr>
                          ) : (
                            documents.map((doc, idx) => (
                              <tr key={doc.id || idx} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-8 py-5">
                                  <div className="text-xs font-bold text-slate-900">{doc.company_name}</div>
                                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{doc.ticker}</div>
                                </td>
                                <td className="px-8 py-5">
                                  <div className="text-xs font-bold text-slate-700 truncate max-w-[200px]" title={doc.filename}>
                                    {doc.filename}
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <div className="text-xs text-slate-500 font-semibold">
                                    {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  {doc.source_url ? (
                                    <a href={doc.source_url} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold uppercase tracking-wider flex items-center gap-0.5">
                                      Web Link <ExternalLink size={10}/>
                                    </a>
                                  ) : (
                                    <Badge type="slate">Saisie Manuelle / Ingest</Badge>
                                  )}
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <button 
                                    onClick={() => handleDownloadDocument(doc.id, doc.filename)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm"
                                  >
                                    Télécharger
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                  </div>

                </div>

              </div>
            </div>
          ) : !co ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto reveal-up">
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-8 animate-pulse">
                <UploadCloud size={32} className="text-emerald-600"/>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">Aucun Profil Actif</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">Sélectionnez une entreprise dans le panneau de gauche ou importez un nouveau rapport PDF pour initialiser l'analyse automatisée.</p>
              <button 
                onClick={()=>ref.current?.click()} 
                className="btn-primary"
              >
                Importer un Rapport PDF
              </button>
            </div>
          ) : (
            <div className="space-y-10 reveal-up">
              
              {tab === 'dash' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="Chiffre d'Affaires" value={F.mad(lr?.chiffre_affaires)} Icon={Zap} trend={getTrend(lr?.chiffre_affaires, pr?.chiffre_affaires)}/>
                    <StatCard label="EBITDA" value={F.mad(lr?.ebitda)} Icon={Activity} trend={getTrend(lr?.ebitda, pr?.ebitda)}/>
                    <StatCard label="Résultat Net" value={F.mad(lr?.resultat_net)} Icon={TrendingUp} trend={getTrend(lr?.resultat_net, pr?.resultat_net)}/>
                    <StatCard label="Total Actif" value={F.mad(lr?.actif)} Icon={Layers}/>
                  </div>

                  <div className="grid grid-cols-3 gap-8">
                    <div className="col-span-2 premium-card p-8">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h4 className="text-lg font-bold text-slate-900 tracking-tight">Historique de Performance</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Évolution du ROE vs Croissance</p>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase">
                            <div className="w-2 h-2 rounded-full bg-emerald-600"/> ROE
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                            <div className="w-2 h-2 rounded-full bg-slate-900"/> EBITDA
                          </div>
                        </div>
                      </div>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="gEmerald" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.1}/>
                                <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="y" tick={{fontSize:10,fill:'#94a3b8',fontWeight:700}} axisLine={false} tickLine={false} dy={10}/>
                            <YAxis tick={{fontSize:10,fill:'#94a3b8',fontWeight:700}} axisLine={false} tickLine={false} dx={-10}/>
                            <Tooltip contentStyle={customTooltip}/>
                            <Area type="monotone" dataKey="ROE" stroke={COLORS.emerald} strokeWidth={3} fill="url(#gEmerald)" animationDuration={1000}/>
                            <Area type="monotone" dataKey="EBITDA" stroke={COLORS.slate} strokeWidth={2} fill="transparent" strokeDasharray="5 5"/>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="premium-card p-8">
                      <h4 className="text-lg font-bold text-slate-900 tracking-tight mb-8">Metric Distribution</h4>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="#f1f5f9" />
                            <PolarAngleAxis dataKey="m" tick={{fontSize:9,fill:'#64748b',fontWeight:800}}/>
                            <Radar dataKey="v" stroke={COLORS.emerald} fill={COLORS.emerald} fillOpacity={0.1} strokeWidth={2}/>
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="premium-card overflow-hidden">
                    <div className="p-8 flex items-center justify-between border-b border-slate-50">
                      <h4 className="text-lg font-bold text-slate-900">Classement Sectoriel</h4>
                      <Badge type="emerald">Performances Comparées</Badge>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entité</th>
                          <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance (ROE)</th>
                          <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rang</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {board.slice(0, 5).map((item, i) => {
                          const isMe = item.company_name === co.name;
                          const currentRank = board.findIndex(b => b.company_name === item.company_name) + 1;
                          return (
                            <tr key={i} onClick={() => pick(item.company_name)} className={`group cursor-pointer hover:bg-slate-50 transition-colors ${isMe ? 'bg-emerald-50/30' : ''}`}>
                              <td className="px-8 py-5">
                                <div className={`text-sm font-bold ${isMe ? 'text-emerald-600' : 'text-slate-900'}`}>{item.company_name}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">{item.ticker}</div>
                              </td>
                              <td className="px-8 py-5 text-right font-mono text-sm font-bold text-emerald-600">{F.pct(item.value)}</td>
                              <td className="px-8 py-5 text-right font-mono text-sm font-bold text-slate-300">#{String(currentRank).padStart(2, '0')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'ratios' && (
                <div className="grid grid-cols-2 gap-8">
                  <div className="premium-card p-8">
                    <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <TrendingUp size={20} className="text-emerald-600"/>
                      Ratios de Rentabilité
                    </h4>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      {[
                        { label: "Chiffre d'Affaires", value: F.mad(lr?.chiffre_affaires), sub: "Revenus totaux", color: "text-emerald-600" },
                        { label: "EBITDA", value: F.mad(lr?.ebitda), sub: "Profitabilité brute", color: "text-blue-600" },
                        { label: "Résultat Net", value: F.mad(lr?.resultat_net), sub: "Bénéfice net", color: "text-indigo-600" },
                        { label: "Dettes Totales", value: F.mad(lr?.dettes_totales), sub: "Endettement global", color: "text-amber-600" }
                      ].map((s, i) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className={`text-2xl font-bold ${s.color} font-mono truncate`}>{s.value}</div>
                          <div className="text-xs font-bold text-slate-900 mt-1">{s.label}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">{s.sub}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-6">
                      {[
                        { label: 'ROE', value: F.pct(lr?.roe), formula: 'Résultat Net / Capitaux Propres ('+F.mad(lr?.capitaux_propres)+')', desc: 'Capacité à générer du profit avec les fonds propres.' },
                        { label: 'Marge Nette', value: F.pct(lr?.net_margin), formula: 'Résultat Net / CA', desc: 'Part du CA restant après toutes les charges.' }
                      ].map((r, i) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-bold text-slate-900">{r.label}</span>
                            <span className="text-lg font-bold text-emerald-600 font-mono">{r.value}</span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{r.formula}</div>
                          <p className="text-[11px] text-slate-500 font-medium">{r.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="premium-card p-8">
                    <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <Shield size={20} className="text-indigo-600"/>
                      Ratios de Solvabilité
                    </h4>
                    <div className="space-y-6">
                      {[
                        { label: 'Liquidité Générale', value: F.x(lr?.current_ratio), formula: 'Actif Circulant / Dettes CT', desc: 'Capacité à faire face aux dettes de court terme.' },
                        { label: 'Levier (D/E)', value: F.x(lr?.debt_to_equity), formula: 'Dettes / Capitaux Propres', desc: 'Niveau d\'endettement par rapport aux fonds propres.' }
                      ].map((r, i) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-bold text-slate-900">{r.label}</span>
                            <span className="text-lg font-bold text-indigo-600 font-mono">{r.value}</span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{r.formula}</div>
                          <p className="text-[11px] text-slate-500 font-medium">{r.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}


              {tab === 'etats' && (
                <div className="space-y-8">
                  <div className="premium-card overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900">Bilan Simplifié</h3>
                      <Badge type="emerald">Données Auditées</Badge>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                      <div className="p-8">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Actif</h4>
                        <div className="space-y-4">
                           <div className="flex justify-between items-center">
                             <span className="text-sm font-medium text-slate-600">Total Actif</span>
                             <span className="text-sm font-bold text-slate-900">{F.mad(lr?.actif)}</span>
                           </div>
                           <div className="h-px bg-slate-50 w-full" />
                           <div className="flex justify-between items-center">
                             <span className="text-sm font-medium text-slate-400 italic">Dont Actif Circulant</span>
                             <span className="text-sm font-medium text-slate-400 italic">Inclus</span>
                           </div>
                        </div>
                      </div>
                      <div className="p-8">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Passif</h4>
                        <div className="space-y-4">
                           <div className="flex justify-between items-center">
                             <span className="text-sm font-medium text-slate-600">Total Passif</span>
                             <span className="text-sm font-bold text-slate-900">{F.mad(lr?.passif)}</span>
                           </div>
                           <div className="h-px bg-slate-50 w-full" />
                           <div className="flex justify-between items-center">
                             <span className="text-sm font-medium text-slate-600">Capitaux Propres</span>
                             <span className="text-sm font-bold text-slate-900">{F.mad(lr?.capitaux_propres)}</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="premium-card overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900">Compte de Produits et Charges (CPC)</h3>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{lr?.year}</div>
                    </div>
                    <div className="p-8 space-y-6">
                       <div className="flex justify-between items-center">
                         <div>
                           <div className="text-sm font-bold text-slate-900">Chiffre d'Affaires</div>
                           <div className="text-[10px] text-slate-400">Revenus d'exploitation totaux</div>
                         </div>
                         <span className="text-xl font-bold text-slate-900 font-mono">{F.mad(lr?.chiffre_affaires)}</span>
                       </div>
                       
                       <div className="flex justify-between items-center">
                         <div>
                           <div className="text-sm font-bold text-slate-900">Résultat Net</div>
                           <div className="text-[10px] text-slate-400">Bénéfice ou perte de l'exercice</div>
                         </div>
                         <span className={`text-xl font-bold font-mono ${lr?.resultat_net > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{F.mad(lr?.resultat_net)}</span>
                       </div>

                       <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                              <Activity size={18} className="text-emerald-600"/>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">Marge Nette Calculée</div>
                              <div className="text-[10px] text-slate-400">Rentabilité pure du CA</div>
                            </div>
                          </div>
                          <div className="text-lg font-bold text-emerald-600 font-mono">{F.pct(lr?.net_margin)}</div>
                       </div>
                    </div>
                  </div>
                </div>
              )}


              {tab === 'analyse' && (
                <div className="space-y-8">
                  {la ? (
                    <>
                      <div className="premium-card p-10 bg-slate-900 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                        <div className="relative z-10">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10">
                              <MessageSquare size={24} className="text-emerald-400"/>
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Synthèse Exécutive</h3>
                          </div>
                          <p className="text-xl font-medium text-slate-300 leading-relaxed italic">
                            "{la.summary}"
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="premium-card p-8 border-l-4 border-emerald-500">
                          <div className="flex items-center gap-3 mb-4">
                            <TrendingUp size={20} className="text-emerald-500"/>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Analyse Sectorielle</span>
                          </div>
                          <p className="text-sm font-medium text-slate-600 leading-relaxed">
                            {la.peer_comparison}
                          </p>
                        </div>
                        <div className="premium-card p-8 border-l-4 border-rose-500">
                          <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle size={20} className="text-rose-500"/>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Points de Vigilance</span>
                          </div>
                          <p className="text-sm font-medium text-slate-600 leading-relaxed">
                            {la.anomalies}
                          </p>
                        </div>
                      </div>

                      {/* INTERACTIVE CHANT SECTION */}
                      <div className="premium-card p-8 bg-emerald-50/50 border-emerald-100">
                        <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                          <Zap size={20} className="text-emerald-600"/>
                          Poser une question à l'Assistant
                        </h4>
                        <div className="flex gap-4">
                          <input 
                            value={chatMsg}
                            onChange={e=>setChatMsg(e.target.value)}
                            onKeyDown={e=>e.key==='Enter'&&ask()}
                            placeholder="Ex: Analyse la solvabilité de l'entreprise..."
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                          />
                          <button 
                            onClick={ask}
                            disabled={chatLoading}
                            className="btn-primary px-8 flex items-center gap-2"
                          >
                            {chatLoading ? <Loader2 size={16} className="animate-spin"/> : <ChevronRight size={18}/>}
                            <span>{chatLoading ? 'Analyse...' : 'Analyser'}</span>
                          </button>
                        </div>
                        {chatResp && (
                          <div className="mt-6 p-6 bg-white rounded-2xl border border-emerald-100 shadow-sm reveal-up">
                            <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                              <Shield size={12}/> Réponse de l'Assistant
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                              {chatResp}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="premium-card p-20 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <Shield size={28} className="text-slate-200"/>
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">Analyse en Attente</h4>
                      <p className="text-sm text-slate-400 font-medium max-w-xs mt-2">Activez l'intelligence artificielle en important un rapport financier PDF.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      <Modal 
        show={modal.show}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal(p => ({ ...p, show: false }))}
      />

      {/* ── PROFILE UPDATE MODAL ── */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowProfileModal(false)} />
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden reveal-up">
            <div className="h-2 bg-emerald-600" />
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Modifier mon profil</h3>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Espace utilisateur</p>
                </div>
                <button 
                  onClick={() => setShowProfileModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
                >
                  <X size={16}/>
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">Nouvel Identifiant</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={updateUsername}
                      onChange={e => setUpdateUsername(e.target.value)}
                      required
                      placeholder="Identifiant"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all text-slate-800"
                    />
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={12}/>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">Nouveau mot de passe (facultatif)</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value={updatePassword}
                      onChange={e => setUpdatePassword(e.target.value)}
                      placeholder="Nouveau mot de passe..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all text-slate-800"
                    />
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={12}/>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">Confirmer le nouveau mot de passe</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value={updateConfirmPassword}
                      onChange={e => setUpdateConfirmPassword(e.target.value)}
                      placeholder="Confirmer le nouveau mot de passe..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all text-slate-800"
                    />
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={12}/>
                  </div>
                </div>

                {updateError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0"/>
                    <span>{updateError}</span>
                  </div>
                )}

                {updateSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-semibold text-emerald-600 flex items-center gap-2">
                    <CheckCircle2 size={14} className="shrink-0"/>
                    <span>{updateSuccess}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-100 hover:shadow-emerald-200 transition-all"
                >
                  Sauvegarder
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
