import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHemo } from '../context/HemoContext';
import {
  Activity,
  Lock,
  Mail,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  HelpCircle,
  X,
  KeyRound,
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { signInWithEmail, sendPasswordResetLink } = useAuth();
  const { settings, showToast } = useHemo();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!email.trim() || !password) {
        throw new Error('Harap masukkan alamat email / ID akun dan kata sandi.');
      }
      await signInWithEmail(email.trim(), password);
      showToast('Berhasil masuk ke HemoShift HD!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('belum terdaftar')) {
        setError(msg);
      } else if (msg.includes('user-not-found')) {
        setError('Akun belum terdaftar di sistem. Pembuatan akun hanya dapat dilakukan oleh Administrator Sistem.');
      } else if (msg.includes('wrong-password') || msg.includes('tidak sesuai')) {
        setError('Kata sandi yang Anda masukkan salah. Silakan periksa kembali.');
      } else if (msg.includes('invalid-credential')) {
        setError('Email atau kata sandi tidak valid. Hubungi Administrator jika akun Anda belum dibuatkan.');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetMessage({ type: 'error', text: 'Harap masukkan alamat email Anda.' });
      return;
    }
    setIsResetting(true);
    setResetMessage(null);
    try {
      await sendPasswordResetLink(resetEmail.trim());
      setResetMessage({
        type: 'success',
        text: 'Tautan reset kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk atau folder spam Anda.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResetMessage({ type: 'error', text: msg || 'Gagal mengirim email reset kata sandi.' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-3 sm:p-6 antialiased relative">
      {/* Top Bar with Brand */}
      <div className="w-full max-w-lg mb-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-100">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base text-slate-900 tracking-tight block">
              HemoShift HD
            </span>
            <span className="text-[11px] text-slate-600 block -mt-0.5 font-medium">
              {settings.hospitalName || 'RSUD Dialysis Center'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden">
        {/* Card Header */}
        <div className="p-6 pb-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-800 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full border border-white/20">
              Gerbang Masuk Sistem
            </span>
            <span className="text-[11px] font-medium text-blue-100 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Dialisis Terpadu
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-3 tracking-tight">
            Selamat Datang di HemoShift
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 mt-1 leading-relaxed">
            Sistem penjadwalan sif perawat dan alokasi 25 mesin hemodialisa {settings.hospitalName}.
          </p>
        </div>

        {/* Info Banner Admin Only */}
        <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-snug">
            <span className="font-bold">Akses Terbatas:</span> Pembuatan akun baru hanya dapat dilakukan secara resmi oleh <b>Administrator Sistem</b> melalui menu Kelola Akun Staf.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Identifier (Email / Account ID) Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alamat Email atau ID Akun:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="nama@rsud.go.id, ID akun, atau email Anda"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Kata Sandi:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email.includes('@') ? email : '');
                    setResetMessage(null);
                    setShowResetModal(true);
                  }}
                  className="text-[11px] font-semibold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Masukkan kata sandi akun Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 top-2.5 cursor-pointer"
                  title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-500/25 transition-all active:scale-98 min-h-[44px] cursor-pointer mt-2"
            >
              <span>{isSubmitting ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Help note for unregistered staff */}
          <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200/70 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-blue-950 dark:text-blue-100">
              <UserCheck className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
              Belum Memiliki Akun Staf?
            </div>
            <p className="text-[11px] text-blue-800/90 dark:text-blue-300 leading-relaxed">
              Silakan hubungi <b>Kepala Ruangan</b> atau <b>Administrator IT Hemodialisa</b> untuk dibuatkan akun baru serta penetapan hak akses Anda.
            </p>
          </div>

          {/* Access Policy Note */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            <div className="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
              Aturan Hak Akses Pengguna:
            </div>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                <b>Kepala Ruang & Admin:</b> Akses penuh menyusun jadwal, mengalokasikan mesin, menambah serta menghapus mesin HD.
              </li>
              <li>
                <b>Perawat Staf:</b> Hanya dapat melihat Halaman Harian, Jadwal Bulanan, dan Mesin HD secara real-time tanpa dapat mengubah apapun.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-sky-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Reset Kata Sandi
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Bantuan pemulihan kata sandi staf HD
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  resetMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {resetMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <span>{resetMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSendReset} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Masukkan Alamat Email Terdaftar:
                </label>
                <input
                  type="email"
                  required
                  placeholder="contoh@rsud.go.id"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isResetting}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                {isResetting ? 'Mengirim email reset...' : 'Kirim Tautan Reset Sandi'}
              </button>
            </form>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Reset Langsung oleh Kepala Ruangan / Admin:
              </div>
              <p>
                Karu atau Administrator IT dapat langsung mengubah atau mereset kata sandi staf perawat melalui menu <b>Akun Saya → Kelola Akun Staf</b> tanpa perlu menunggu tautan email.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
