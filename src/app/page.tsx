'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load secret dari localStorage saat awal load
  useEffect(() => {
    const savedSecret = localStorage.getItem('airish_webhook_secret');
    if (savedSecret) {
      setSecret(savedSecret);
      runDiagnostics(savedSecret);
    }
  }, []);

  // Auto refresh log setiap 5 detik jika diaktifkan
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && secret) {
      interval = setInterval(() => {
        runDiagnostics(secret);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, secret]);

  const runDiagnostics = async (secretKey = secret) => {
    if (!secretKey) {
      setError('Masukkan Webhook Secret Anda terlebih dahulu!');
      return;
    }
    setError('');
    setLoading(true);
    try {
      localStorage.setItem('airish_webhook_secret', secretKey);
      const res = await fetch(`/api/diagnose?secret=${encodeURIComponent(secretKey)}`);
      if (!res.ok) {
        throw new Error('Gagal menghubungi API diagnose. Pastikan webhook secret benar.');
      }
      const data = await res.json();
      setDiagnostics(data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.');
      setDiagnostics(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'success') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          ONLINE
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          ERROR
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"></span>
        CHECKING
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-6 md:p-12 selection:bg-indigo-500/30">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-[350px] h-[350px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-zinc-800/80 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Airish Bot Dashboard
            </h1>
            <p className="text-zinc-400 mt-2 text-sm md:text-base">
              Monitor kesehatan sistem, debug eror, dan lacak chat log secara real-time.
            </p>
          </div>

          {/* Secret Input Control */}
          <div className="flex items-center gap-3">
            <input
              type="password"
              placeholder="Masukkan Webhook Secret..."
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 w-[240px] transition-all"
            />
            <button
              onClick={() => runDiagnostics()}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
            >
              {loading ? 'Diagnosing...' : 'Diagnose'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm mb-8 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Diagnostics Results */}
        {diagnostics ? (
          <div className="space-y-10">
            {/* Grid Status */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Telegram */}
              <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50 rounded-2xl p-6 hover:border-zinc-700/50 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-zinc-400 text-sm font-semibold tracking-wider">TELEGRAM API</span>
                  {getStatusBadge(diagnostics.telegram.status)}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                  {diagnostics.telegram.message}
                </p>
              </div>

              {/* Supabase */}
              <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50 rounded-2xl p-6 hover:border-zinc-700/50 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-zinc-400 text-sm font-semibold tracking-wider">SUPABASE DB</span>
                  {getStatusBadge(diagnostics.supabase.status)}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                  {diagnostics.supabase.message}
                </p>
              </div>

              {/* Gemini */}
              <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50 rounded-2xl p-6 hover:border-zinc-700/50 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-zinc-400 text-sm font-semibold tracking-wider">GEMINI AI</span>
                  {getStatusBadge(diagnostics.gemini.status)}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                  {diagnostics.gemini.message}
                </p>
              </div>

              {/* Fal.ai */}
              <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50 rounded-2xl p-6 hover:border-zinc-700/50 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-zinc-400 text-sm font-semibold tracking-wider">FAL.AI IMAGE</span>
                  {getStatusBadge(diagnostics.fal.status)}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                  {diagnostics.fal.message}
                </p>
              </div>
            </div>

            {/* SQL Snippet reminder if Log table doesn't exist */}
            {diagnostics.logs.length === 1 && diagnostics.logs[0].event === 'Logger DB Table Missing' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-sm text-amber-400">
                <h3 className="font-bold mb-2">⚠️ Tabel `bot_logs` Belum Dibuat di Supabase</h3>
                <p className="text-zinc-300 mb-4">
                  Untuk melihat aktivitas secara live di dashboard ini, jalankan SQL berikut ini di SQL Editor Supabase Anda:
                </p>
                <pre className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs overflow-x-auto text-zinc-400 select-all font-mono">
{`CREATE TABLE bot_logs (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT,
    level VARCHAR(10) DEFAULT 'INFO',
    event VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`}
                </pre>
              </div>
            )}

            {/* Logs & Chats Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Live Logs */}
              <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50 rounded-2xl p-6 flex flex-col h-[500px]">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800/50 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <h2 className="text-lg font-bold">Live System Logs</h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="rounded border-zinc-800 bg-zinc-950 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                      />
                      Auto Refresh (5s)
                    </label>
                    <button 
                      onClick={() => runDiagnostics()} 
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs pr-2">
                  {diagnostics.logs.length === 0 ? (
                    <p className="text-zinc-500 text-center py-20">Belum ada log terekam.</p>
                  ) : (
                    diagnostics.logs.map((log: any) => {
                      let lvlColor = 'text-blue-400';
                      if (log.level === 'WARN') lvlColor = 'text-amber-400';
                      if (log.level === 'ERROR') lvlColor = 'text-rose-400';

                      return (
                        <div key={log.id} className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/40 leading-relaxed">
                          <div className="flex items-center justify-between gap-4 mb-1.5">
                            <span className={`font-bold ${lvlColor}`}>[{log.level}] {log.event}</span>
                            <span className="text-zinc-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-zinc-400 whitespace-pre-wrap">{log.details}</p>
                          {log.telegram_id && (
                            <div className="mt-1 text-[10px] text-zinc-500">
                              User Telegram ID: {log.telegram_id}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Chat Tracker */}
              <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50 rounded-2xl p-6 flex flex-col h-[500px]">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800/50 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                    <h2 className="text-lg font-bold">Recent Conversations</h2>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {diagnostics.chats.length === 0 ? (
                    <p className="text-zinc-500 text-center py-20">Belum ada chat terekam.</p>
                  ) : (
                    diagnostics.chats.map((chat: any) => {
                      const isUser = chat.role === 'user';
                      return (
                        <div 
                          key={chat.id} 
                          className={`flex flex-col max-w-[85%] ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                        >
                          <div 
                            className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                              isUser 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none'
                            }`}
                          >
                            {chat.content}
                          </div>
                          <span className="text-[10px] text-zinc-500 mt-1 px-1">
                            {new Date(chat.created_at).toLocaleTimeString()} • ID {chat.telegram_id}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 bg-zinc-900/20 backdrop-blur-md border border-zinc-850 rounded-3xl p-8 max-w-lg mx-auto">
            <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
              🤖
            </div>
            <h2 className="text-xl font-bold mb-2">Belum Mendiagnosa</h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Masukkan Webhook Secret di sudut kanan atas lalu klik tombol <b>Diagnose</b> untuk melihat data sistem dan memecahkan masalah.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
