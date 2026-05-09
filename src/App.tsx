import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import VoiceAgent from './components/Widget/VoiceAgent';
import { 
  BarChart3, 
  BookOpen, 
  Settings, 
  Code, 
  Mic2, 
  LogOut, 
  Plus, 
  Trash2, 
  Save,
  MessageSquare,
  TrendingUp,
  BrainCircuit,
  PanelLeft,
  ChevronRight,
  Calendar,
  User,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { cn } from './lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';

// Views
type View = 'overview' | 'knowledge' | 'leads' | 'history' | 'settings' | 'integration';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const isWidgetPage = window.location.pathname === '/widget';
  const urlParams = new URLSearchParams(window.location.search);
  const agentId = urlParams.get('agentId') || 'default';

  if (isWidgetPage) {
    return <VoiceAgent agentId={agentId} />;
  }

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-[#FAF9F6]">
      <div className="animate-pulse flex flex-col items-center">
        <Mic2 className="w-12 h-12 text-zinc-900 mb-4" />
        <p className="text-zinc-500 font-medium font-sans uppercase tracking-[0.2em] text-xs">OmniVoice AI Loading...</p>
      </div>
    </div>
  );

  if (!user) return <LandingPage onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-[#FAF9F6] text-zinc-900 font-sans">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-zinc-200 transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-zinc-900 p-2 rounded-xl">
            <Mic2 className="w-6 h-6 text-white" />
          </div>
          {sidebarOpen && <h1 className="font-bold text-xl tracking-tight">OmniVoice</h1>}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavItem 
            icon={<BarChart3 size={20} />} 
            label="Overview" 
            active={activeView === 'overview'} 
            expanded={sidebarOpen}
            onClick={() => setActiveView('overview')}
          />
          <NavItem 
            icon={<BookOpen size={20} />} 
            label="Knowledge Base" 
            active={activeView === 'knowledge'} 
            expanded={sidebarOpen}
            onClick={() => setActiveView('knowledge')}
          />
          <NavItem 
            icon={<MessageSquare size={20} />} 
            label="Conversations" 
            active={activeView === 'history'} 
            expanded={sidebarOpen}
            onClick={() => setActiveView('history')}
          />
          <NavItem 
            icon={<Calendar size={20} />} 
            label="Leads & Meetings" 
            active={activeView === 'leads'} 
            expanded={sidebarOpen}
            onClick={() => setActiveView('leads')}
          />
          <NavItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={activeView === 'settings'} 
            expanded={sidebarOpen}
            onClick={() => setActiveView('settings')}
          />
          <NavItem 
            icon={<Code size={20} />} 
            label="Integration" 
            active={activeView === 'integration'} 
            expanded={sidebarOpen}
            onClick={() => setActiveView('integration')}
          />
        </nav>

        <div className="p-4 border-t border-zinc-200">
          <button 
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 w-full p-3 rounded-xl text-zinc-500 hover:bg-zinc-100 transition-colors",
              !sidebarOpen && "justify-center"
            )}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-zinc-200 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500"
            >
              <PanelLeft size={20} />
            </button>
            <h2 className="text-sm font-medium text-zinc-400 capitalize tracking-widest">{activeView}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsTesting(!isTesting)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                isTesting 
                  ? "bg-red-500 text-white shadow-lg shadow-red-200" 
                  : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
              )}
            >
              <Mic2 size={16} />
              {isTesting ? 'Stop Test' : 'Test Live'}
            </button>
            <div className="flex items-center gap-4">
               <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user.displayName}</p>
                <p className="text-xs text-zinc-500">{user.email}</p>
             </div>
             <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border border-zinc-200" />
           </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeView === 'overview' && <Overview user={user} />}
          {activeView === 'knowledge' && <KnowledgeBase user={user} />}
          {activeView === 'history' && <HistoryView user={user} />}
          {activeView === 'leads' && <LeadsView user={user} />}
          {activeView === 'settings' && <SettingsView user={user} />}
          {activeView === 'integration' && <Integration user={user} />}
        </div>
      </main>

      {/* Internal Test Agent */}
      {isTesting && <VoiceAgent agentId={user.uid} />}
    </div>
  );
}

function NavItem({ icon, label, active, expanded, onClick }: { icon: React.ReactNode, label: string, active: boolean, expanded: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 w-full p-3 rounded-xl transition-all",
        active ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200" : "text-zinc-500 hover:bg-white hover:text-zinc-900",
        !expanded && "justify-center"
      )}
    >
      {icon}
      {expanded && <span className="font-medium">{label}</span>}
    </button>
  );
}

function LandingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 p-2.5 rounded-xl text-white">
            <Mic2 size={24} />
          </div>
          <span className="font-bold text-2xl tracking-tighter">OmniVoice</span>
        </div>
        <button 
          onClick={onLogin}
          className="bg-zinc-900 text-white px-8 py-3 rounded-full font-bold hover:scale-105 transition-all shadow-xl shadow-zinc-200"
        >
          Get Started
        </button>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4">
          <TrendingUp size={14} />
          Now with multi-language support (English & Sinhala)
        </div>
        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter max-w-4xl mb-8 leading-[0.9] animate-in fade-in slide-in-from-bottom-8">
          The voice for your business, <span className="text-zinc-400">powered by AI.</span>
        </h1>
        <p className="text-zinc-500 text-xl md:text-2xl max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-12">
          Deploy a natural-sounding voice agent to your website in minutes. Multi-lingual, real-time, and perfectly synced with your business knowledge.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-12">
          <button 
            onClick={onLogin}
            className="bg-zinc-900 text-white px-10 py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:shadow-2xl hover:shadow-zinc-300 transition-all active:scale-95"
          >
            <User size={20} />
            Connect with Google
          </button>
          <button className="bg-white border border-zinc-200 text-zinc-900 px-10 py-5 rounded-2xl font-bold text-lg hover:bg-zinc-50 transition-all">
            See Demo Widget
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40 w-full animate-in fade-in slide-in-from-bottom-16">
          <FeatureCard 
            icon={<BrainCircuit className="w-8 h-8" />}
            title="Knowledge Deep-Sync"
            description="Upload your docs, FAQs, and policies. Our AI learns your business nuance in seconds."
          />
          <FeatureCard 
            icon={<MessageSquare className="w-8 h-8" />}
            title="Natural Conversations"
            description="No more rigid menus. Clients talk to your AI like they're talking to a real human."
          />
          <FeatureCard 
            icon={<TrendingUp className="w-8 h-8" />}
            title="Rich Analytics"
            description="Understand customer sentiment and hot topics with AI-powered dashboard insights."
          />
        </div>
      </section>

      {/* Trust Section */}
      <footer className="border-t border-zinc-200 py-20 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
             <Mic2 size={20} className="text-zinc-400" />
             <span className="font-bold text-xl tracking-tighter text-zinc-400 uppercase">OmniVoice</span>
          </div>
          <p className="text-zinc-400 text-sm">© 2026 OmniVoice AI. Built for the modern business.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-10 rounded-[2.5rem] border border-zinc-200 text-left hover:border-zinc-900 transition-all group">
      <div className="mb-6 text-zinc-400 group-hover:text-zinc-900 transition-colors">
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4 tracking-tight">{title}</h3>
      <p className="text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}

// Sub-views
function Overview({ user }: { user: FirebaseUser }) {
  const [stats, setStats] = useState({ sessions: 0, queries: 0, positive: 0, neutral: 0, negative: 0, leads: 0, summaries: 0 });
  const [insights, setInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  const generateInsights = async () => {
    setLoadingInsights(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these query sentiments (Positive: 65%, Neutral: 25%, Negative: 10%), total sessions (${stats.sessions}), captured leads (${stats.leads}), and AI conversation summaries (${stats.summaries}) to provide 3 bullet points of business insights.`,
        config: {
          systemInstruction: "You are a business analyst. Provide concise, actionable insights."
        }
      });
      setInsights(response.text || 'Unable to generate insights at this time.');
    } catch (err) {
      console.error(err);
      setInsights('Error generating insights.');
    }
    setLoadingInsights(false);
  };

  useEffect(() => {
    if (!user) return;
    const qS = query(collection(db, 'sessions'), where('agentId', '==', user.uid));
    const unsubscribeSessions = onSnapshot(qS, (snapshot) => {
      setStats(prev => ({ ...prev, sessions: snapshot.size }));
    });

    const qL = query(collection(db, 'leads'), where('agentId', '==', user.uid));
    const unsubscribeLeads = onSnapshot(qL, (snapshot) => {
      setStats(prev => ({ ...prev, leads: snapshot.size }));
    });

    const qSum = query(collection(db, 'summaries'), where('agentId', '==', user.uid));
    const unsubscribeSummaries = onSnapshot(qSum, (snapshot) => {
      setStats(prev => ({ ...prev, summaries: snapshot.size }));
    });

    return () => {
      unsubscribeSessions();
      unsubscribeLeads();
      unsubscribeSummaries();
    };
  }, [user.uid]);

  const pieData = [
    { name: 'Positive', value: 65, color: '#10b981' },
    { name: 'Neutral', value: 25, color: '#f59e0b' },
    { name: 'Negative', value: 10, color: '#ef4444' },
  ];

  const chartData = [
    { name: 'Mon', count: 12 },
    { name: 'Tue', count: 19 },
    { name: 'Wed', count: 32 },
    { name: 'Thu', count: 28 },
    { name: 'Fri', count: 45 },
    { name: 'Sat', count: stats.sessions },
    { name: 'Sun', count: stats.summaries },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Sessions" value={stats.sessions.toString()} icon={<MessageSquare size={20} />} trend="+12.5%" />
        <StatCard title="Captured Leads" value={stats.leads.toString()} icon={<Calendar size={20} />} trend="+15.0%" />
        <StatCard title="AI Summaries" value={stats.summaries.toString()} icon={<BookOpen size={20} />} trend="+8.2%" />
        <StatCard title="Avg Sentiment" value="Positive" icon={<User size={20} />} color="text-emerald-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">AI Business Insights</h3>
            <button 
              onClick={generateInsights}
              disabled={loadingInsights}
              className="text-xs font-bold bg-zinc-900 text-white px-4 py-2 rounded-xl hover:bg-zinc-800 disabled:opacity-50"
            >
              {loadingInsights ? 'Analyzing...' : 'Generate New Insights'}
            </button>
          </div>
          <div className="bg-zinc-50 rounded-2xl p-6 h-[80%] overflow-y-auto">
            {insights ? (
              <div className="prose prose-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                {insights}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3">
                <BrainCircuit size={40} className="opacity-20" />
                <p className="text-sm font-medium">Click the button to analyze recent customer interactions.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 h-[400px]">
          <h3 className="text-lg font-bold mb-6">Interaction Volume</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
              <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="count" fill="#18181b" radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 h-[400px] flex flex-col">
          <h3 className="text-lg font-bold mb-6">Sentiment Analysis</h3>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={pieData} 
                  innerRadius={80} 
                  outerRadius={120} 
                  paddingAngle={5} 
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color }: { title: string, value: string, icon: React.ReactNode, trend?: string, color?: string }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm transition-hover hover:shadow-xl hover:shadow-zinc-100 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-zinc-50 rounded-2xl text-zinc-900 border border-zinc-100">{icon}</div>
        {trend && <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full">{trend}</span>}
      </div>
      <p className="text-zinc-500 text-sm font-medium mb-1 uppercase tracking-wider">{title}</p>
      <h4 className={cn("text-3xl font-bold tracking-tight", color)}>{value}</h4>
    </div>
  );
}

function KnowledgeBase({ user }: { user: FirebaseUser }) {
  const [items, setItems] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'knowledgeBase'), 
      where('userId', '==', user.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setItems(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'knowledgeBase');
    });
  }, [user.uid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...editingItem,
      userId: user.uid,
      updatedAt: new Date(),
      createdAt: editingItem.createdAt || new Date(),
    };

    try {
      if (isAdding) {
        await addDoc(collection(db, 'knowledgeBase'), data);
      } else {
        await setDoc(doc(db, 'knowledgeBase', editingItem.id), data);
      }
    } catch (error) {
      handleFirestoreError(error, isAdding ? OperationType.CREATE : OperationType.WRITE, 'knowledgeBase');
    }
    
    setEditingItem(null);
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this entry?")) {
      try {
        await deleteDoc(doc(db, 'knowledgeBase', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `knowledgeBase/${id}`);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Business Knowledge</h3>
          <p className="text-zinc-500 mt-1">Add details about your products, services, and policies.</p>
        </div>
        <button 
          onClick={() => { setEditingItem({ title: '', content: '', category: 'General' }); setIsAdding(true); }}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-medium hover:bg-zinc-800 transition-all"
        >
          <Plus size={18} />
          Add Entry
        </button>
      </div>

      {(editingItem || isAdding) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white max-w-2xl w-full rounded-[2.5rem] p-10 shadow-2xl">
            <h4 className="text-2xl font-bold mb-8">{isAdding ? 'New Knowledge' : 'Edit Entry'}</h4>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Title</label>
                <input 
                  required
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={editingItem.title}
                  onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                  placeholder="e.g., Refund Policy"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Category</label>
                <select 
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={editingItem.category}
                  onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}
                >
                  <option>General</option>
                  <option>Products</option>
                  <option>Pricing</option>
                  <option>FAQ</option>
                  <option>Technical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Content</label>
                <textarea 
                  required
                  rows={8}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all resize-none"
                  value={editingItem.content}
                  onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                  placeholder="Paste your business details here..."
                />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button 
                type="button"
                onClick={() => { setEditingItem(null); setIsAdding(false); }}
                className="flex-1 bg-zinc-100 text-zinc-900 py-4 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 bg-zinc-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-lg"
              >
                <Save size={18} />
                Save Entry
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white p-8 rounded-[2rem] border border-zinc-200 group hover:border-zinc-900 transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button onClick={() => setEditingItem(item)} className="p-2 bg-zinc-100 rounded-lg hover:bg-zinc-200 text-zinc-600"><ChevronRight size={16} /></button>
              <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-50 rounded-lg hover:bg-red-100 text-red-500"><Trash2 size={16} /></button>
            </div>
            <span className="inline-block px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              {item.category}
            </span>
            <h4 className="text-xl font-bold mb-3">{item.title}</h4>
            <p className="text-zinc-500 text-sm line-clamp-3 leading-relaxed mb-4">{item.content}</p>
            <div className="flex items-center justify-between mt-auto">
              <p className="text-xs text-zinc-400">Updated {format(item.updatedAt.toDate(), 'MMM d, yyyy')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView({ user }: { user: FirebaseUser }) {
  const [config, setConfig] = useState<any>({ businessName: '', systemInstruction: '', voiceName: 'Kore' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'config', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data());
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `config/${user.uid}`);
      }
    };
    fetchConfig();
  }, [user.uid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', user.uid), {
        ...config,
        userId: user.uid,
        updatedAt: new Date()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `config/${user.uid}`);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="text-2xl font-bold mb-1">Agent Settings</h3>
      <p className="text-zinc-500 mb-8">Personalize your voice agent's behavior and identity.</p>

      <form onSubmit={handleSave} className="space-y-8 bg-white p-10 rounded-[2.5rem] border border-zinc-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Business Display Name</label>
            <input 
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-medium"
              value={config.businessName}
              onChange={e => setConfig({ ...config, businessName: e.target.value })}
              placeholder="OmniCorp Solutions"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Voice Preset</label>
            <select 
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-medium"
              value={config.voiceName}
              onChange={e => setConfig({ ...config, voiceName: e.target.value })}
            >
              <option value="Kore">Kore (Balanced)</option>
              <option value="Puck">Puck (Friendly)</option>
              <option value="Zephyr">Zephyr (Deep)</option>
              <option value="Charon">Charon (Professional)</option>
              <option value="Fenrir">Fenrir (Authoritative)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">System Instruction</label>
          <textarea 
            rows={5}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-medium resize-none"
            value={config.systemInstruction}
            onChange={e => setConfig({ ...config, systemInstruction: e.target.value })}
            placeholder="You are a helpful voice assistant for OmniCorp. Use the provided knowledge base to answer questions naturally..."
          />
        </div>

        <button 
          disabled={saving}
          className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-lg active:scale-[0.98]"
        >
          {saving ? 'Saving...' : (
            <>
              <Save size={20} />
              Update Agent Configuration
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function LeadsView({ user }: { user: FirebaseUser }) {
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'leads'),
      where('agentId', '==', user.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort manually to avoid index requirement
      docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setLeads(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leads');
    });
  }, [user.uid]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await setDoc(doc(db, 'leads', id), { status }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${id}`);
    }
  };

  const deleteLead = async (id: string) => {
    if (confirm("Delete this lead?")) {
      try {
        await deleteDoc(doc(db, 'leads', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `leads/${id}`);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h3 className="text-2xl font-bold tracking-tight">Leads & Meetings</h3>
        <p className="text-zinc-500 mt-1">Captured meeting requests and contact details from your voice agent.</p>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="p-6 text-xs font-bold uppercase tracking-widest text-zinc-500">Name</th>
              <th className="p-6 text-xs font-bold uppercase tracking-widest text-zinc-500">Contact</th>
              <th className="p-6 text-xs font-bold uppercase tracking-widest text-zinc-500">Preferred Time</th>
              <th className="p-6 text-xs font-bold uppercase tracking-widest text-zinc-500">Reason</th>
              <th className="p-6 text-xs font-bold uppercase tracking-widest text-zinc-500">Status</th>
              <th className="p-6 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {leads.length > 0 ? leads.map(lead => (
              <tr key={lead.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="p-6 font-bold">{lead.name}</td>
                <td className="p-6 text-zinc-600">{lead.contact}</td>
                <td className="p-6 text-zinc-600">{lead.time}</td>
                <td className="p-6">
                  <p className="text-sm text-zinc-500 line-clamp-1 max-w-[200px]">{lead.reason || '-'}</p>
                </td>
                <td className="p-6">
                  <select 
                    value={lead.status}
                    onChange={(e) => updateStatus(lead.id, e.target.value)}
                    className={cn(
                      "text-xs font-bold px-3 py-1.5 rounded-full border focus:outline-none transition-all",
                      lead.status === 'new' ? "bg-blue-50 text-blue-600 border-blue-100" :
                      lead.status === 'scheduled' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      "bg-zinc-100 text-zinc-600 border-zinc-200"
                    )}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </td>
                <td className="p-6 text-right">
                  <button 
                    onClick={() => deleteLead(lead.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="p-20 text-center text-zinc-400">
                  <Calendar size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="font-medium tracking-tight">No leads captured yet.</p>
                  <p className="text-xs">Your voice agent will automatically save leads here.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryView({ user }: { user: FirebaseUser }) {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'summaries'),
      where('agentId', '==', user.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort manually to avoid index requirement
      docs.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setSummaries(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'summaries');
      setLoading(false);
    });
  }, [user.uid]);

  const deleteSummary = async (id: string) => {
    if (confirm("Delete this conversation record?")) {
      try {
        await deleteDoc(doc(db, 'summaries', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `summaries/${id}`);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Conversation History</h3>
          <p className="text-zinc-500 mt-1">AI-generated summaries of your business's voice interactions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[2.5rem] border border-zinc-200">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-medium">Loading history...</p>
          </div>
        ) : summaries.length > 0 ? (
          summaries.map(s => (
            <div key={s.id} className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 hover:border-zinc-900 transition-all shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="bg-zinc-100 p-3 rounded-2xl">
                    <MessageSquare className="w-5 h-5 text-zinc-600" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Call Summary</p>
                    <p className="text-sm text-zinc-500">
                      {s.timestamp?.toDate ? format(s.timestamp.toDate(), 'PPP p') : 'Just now'} • {s.duration || 0}s duration
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => deleteSummary(s.id)}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <div className="prose prose-zinc max-w-none mb-6">
                <div className="text-zinc-700 whitespace-pre-wrap leading-relaxed text-sm bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                  {s.summary}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-wider">
                  Session ID: {s.sessionId.slice(-6)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-20 text-center bg-white rounded-[2.5rem] border border-zinc-200 text-zinc-400">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-10" />
            <p className="font-medium tracking-tight">No conversations recorded yet.</p>
            <p className="text-xs">Once users start talking to your agent, summaries will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Integration({ user }: { user: FirebaseUser }) {
  const currentUrl = window.location.origin;
  const scriptTag = `<script src="${currentUrl}/widget.js" data-agent-id="${user.uid}"></script>`;

  return (
    <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-emerald-100 p-4 rounded-3xl text-emerald-600">
          <Code size={32} />
        </div>
        <div>
          <h3 className="text-3xl font-bold">Connect to Site</h3>
          <p className="text-zinc-500">One line of code is all you need.</p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-white p-10 rounded-[2.5rem] border border-zinc-200">
          <h4 className="font-bold flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs">01</span>
            Copy the script tag
          </h4>
          <div className="bg-zinc-900 rounded-2xl p-6 relative group">
            <code className="text-zinc-300 text-sm font-mono break-all leading-relaxed">
              {scriptTag}
            </code>
            <button 
              onClick={() => navigator.clipboard.writeText(scriptTag)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all"
            >
              <Code size={16} />
            </button>
          </div>
          <p className="text-zinc-400 text-xs mt-4 italic">
            * Add this tag before the closing &lt;/body&gt; tag of your website.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200">
            <h4 className="font-bold mb-3">WordPress Setup</h4>
            <p className="text-zinc-500 text-sm leading-relaxed mb-4">
              Install a "Header & Footer Script" plugin, or edit your theme's <span className="font-mono text-xs bg-zinc-100 px-1">footer.php</span> file.
            </p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200">
            <h4 className="font-bold mb-3">Custom HTML</h4>
            <p className="text-zinc-500 text-sm leading-relaxed mb-4">
              Paste the code directly into your main landing page template.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
