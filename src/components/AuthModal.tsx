import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHemo } from '../context/HemoContext';
import { UserRole } from '../types';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Smartphone,
  LogOut,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    userProfile,
    isAuthenticated,
    signInWithEmail,
    logout,
  } = useAuth();

  const { showToast } = useHemo();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!email.trim() || !password) {
        throw new Error('Harap isi email/ID akun dan kata sandi.');
      }
      await signInWithEmail(email.trim(), password);
      showToast('Berhasil masuk ke HemoShift HD!', 'success');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('belum terdaftar')) {
        setError(msg);
      } else if (msg.includes('user-not-found')) {
        setError('Akun belum terdaftar. Pembuatan akun baru hanya dapat dilakukan oleh Administrator.');
      } else if (msg.includes('wrong-password') || msg.includes('tidak sesuai')) {
        setError('Kata sandi yang Anda masukkan salah. Silakan periksa kembali.');
      } else if (msg.includes('invalid-credential')) {
        setError('Akun belum terdaftar atau email/kata sandi salah.');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    showToast('Anda telah keluar.', 'info');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        id="auth-modal"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-sky-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                {isAuthenticated ? 'Akun Pengguna HD' : 'Masuk ke HemoShift'}
              </h3>
              <p className="text-[11px] text-blue-100">
                {isAuthenticated
                  ? 'Kelola profil & hak akses jadwal'
                  : 'Akses jadwal shift perawat & alokasi 25 mesin'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If Already Logged In */}
        {isAuthenticated && userProfile ? (
          <div className="p-6 space-y-5 overflow-y-auto text-slate-800 dark:text-slate-200">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {userProfile.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {userProfile.displayName}
                  </h4>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      userProfile.role === 'admin'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                    }`}
                  >
                    {userProfile.role === 'admin' ? '👑 Kepala Ruangan' : '👩‍⚕️ Perawat'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {userProfile.email}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Peran Sistem:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {userProfile.role === 'admin' ? 'Administrator / Karu' : 'Staf Perawat HD'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Hak Akses:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {userProfile.role === 'admin'
                    ? 'Administrator Sistem & Manajemen Akun'
                    : userProfile.role === 'karu'
                    ? 'Kepala Ruangan (Jadwal, Mesin & Perawat Ruang HD)'
                    : 'Melihat Jadwal Realtime & Tugas Shift'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs transition-colors min-h-[40px]"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar dari Akun (Logout)</span>
              </button>
            </div>
          </div>
        ) : (
          /* Login Form */
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
            {/* Form Header info */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-snug">
                Pendaftaran akun baru hanya dapat dilakukan oleh <b>Administrator Sistem</b> melalui menu Kelola Akun Staf.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Alamat Email / ID Akun:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="nama@rsud.go.id, ID akun, atau email Anda"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kata Sandi (Password):
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="Masukkan kata sandi"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-500/25 transition-all active:scale-98 min-h-[44px] cursor-pointer"
              >
                <span>{isSubmitting ? 'Memproses...' : 'Masuk Sekarang'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Belum memiliki akun?</span> Hubungi Kepala Ruangan atau Administrator IT untuk dibuatkan akun dan didaftarkan ke data dinas perawat.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
