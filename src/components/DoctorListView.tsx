import React, { useState, useMemo } from 'react';
import { useHemo } from '../context/HemoContext';
import { Doctor } from '../types';
import { DoctorModal } from './DoctorModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { WhatsAppDispatcher } from '../domain/WhatsAppDispatcher';
import {
  Stethoscope,
  Plus,
  Search,
  Phone,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Award,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export const DoctorListView: React.FC = () => {
  const {
    isAdmin,
    doctors,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    clearDefaultDoctors,
    clearAllDoctors,
    showToast,
  } = useHemo();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingDoctor, setDeletingDoctor] = useState<Doctor | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = doc.name.toLowerCase().includes(q);
        const matchesSip = (doc.sip || '').toLowerCase().includes(q);
        const matchesSpec = (doc.specialization || '').toLowerCase().includes(q);
        const matchesPhone = (doc.phone || '').toLowerCase().includes(q);
        if (!matchesName && !matchesSip && !matchesSpec && !matchesPhone) return false;
      }
      if (roleFilter !== 'ALL' && doc.role !== roleFilter) return false;
      return true;
    });
  }, [doctors, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    const total = doctors.length;
    const active = doctors.filter((d) => d.isActive !== false).length;
    const dpjp = doctors.filter((d) => d.role === 'DPJP').length;
    const ruangan = doctors.filter((d) => d.role === 'DOKTER_RUANGAN').length;
    return { total, active, dpjp, ruangan };
  }, [doctors]);

  const handleSave = (docData: Omit<Doctor, 'id'> | Doctor) => {
    if ('id' in docData && docData.id) {
      updateDoctor(docData as Doctor);
    } else {
      addDoctor(docData);
    }
    setIsModalOpen(false);
  };

  const handleTestWhatsApp = (doc: Doctor) => {
    if (!doc.phone) {
      showToast(`Dokter ${doc.name} belum memiliki nomor HP/WhatsApp terdaftar`, 'error');
      return;
    }
    const testMsg = `Halo Dokter ${doc.name}, ini adalah pesan uji integrasi sistem HemoShift Dialisis. Nomor Anda telah terdaftar sebagai Dokter Jaga HD.`;
    WhatsAppDispatcher.openWhatsApp(doc.phone, testMsg);
  };

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-soft">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider">
            <span>Total Dokter</span>
            <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {stats.total}
          </div>
          <div className="text-[11px] text-teal-600 dark:text-teal-400 font-bold mt-0.5">
            {stats.active} Aktif
          </div>
        </div>

        <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-soft">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider">
            <span>Dokter Ruangan</span>
            <Award className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {stats.ruangan}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Bersertifikat HD
          </div>
        </div>

        <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-soft">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider">
            <span>DPJP Konsultan</span>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {stats.dpjp}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Sp.PD-KGH / Sp.PD
          </div>
        </div>

        <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-soft">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider">
            <span>Jadwal Terintegrasi</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            Aktif
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
            Auto-Sync Cloud
          </div>
        </div>
      </div>

      {/* Action Controls & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-soft flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama dokter, SIP, spesialisasi, atau no HP..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Semua Peran</option>
            <option value="DOKTER_RUANGAN">Dokter Ruangan HD</option>
            <option value="DPJP">DPJP Konsultan</option>
          </select>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {doctors.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Hapus semua data dokter terdaftar"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua Dokter</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingDoctor(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-extrabold shadow-soft-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Dokter Jaga</span>
            </button>
          </div>
        )}
      </div>

      {/* Doctor Cards Grid */}
      {filteredDoctors.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 text-center border border-slate-200/80 dark:border-slate-800/80 shadow-soft space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center mx-auto text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Belum Ada Data Dokter Terdaftar
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Tambahkan dokter ruangan dialisis atau DPJP untuk menjadwalkan jaga pada sif pagi dan siang.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditingDoctor(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Daftarkan Dokter Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredDoctors.map((doc) => (
            <div
              key={doc.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-soft hover:shadow-soft-md transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-black text-sm flex items-center justify-center border border-teal-200 dark:border-teal-800 shrink-0">
                      {doc.role === 'DPJP' ? (
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Stethoscope className="w-5 h-5 text-teal-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm leading-tight">
                        {doc.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {doc.specialization || (doc.role === 'DPJP' ? 'Sp.PD-KGH' : 'Dokter Ruangan HD')}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg shrink-0 ${
                      doc.role === 'DPJP'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                    }`}
                  >
                    {doc.role === 'DPJP' ? 'DPJP' : 'Dokter HD'}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-1 text-xs pt-1">
                  {doc.sip && (
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                      <span className="text-slate-400">SIP:</span>
                      <span className="font-mono font-medium">{doc.sip}</span>
                    </div>
                  )}
                  {doc.phone && (
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                      <span className="text-slate-400">WhatsApp:</span>
                      <span className="font-mono font-medium">{doc.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleTestWhatsApp(doc)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  title="Uji kirim WhatsApp ke nomor dokter"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Kirim WA</span>
                </button>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDoctor(doc);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title="Ubah data dokter"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingDoctor(doc)}
                      className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 transition-colors cursor-pointer"
                      title="Hapus dokter"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Edit / Add */}
      <DoctorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        doctor={editingDoctor}
      />

      {/* Modal Delete Confirmation */}
      {deletingDoctor && (
        <DeleteConfirmModal
          isOpen={Boolean(deletingDoctor)}
          onClose={() => setDeletingDoctor(null)}
          onConfirm={() => {
            if (deletingDoctor) {
              deleteDoctor(deletingDoctor.id);
              setDeletingDoctor(null);
            }
          }}
          title="Hapus Data Dokter Jaga"
          message={`Apakah Anda yakin ingin menghapus dokter "${deletingDoctor?.name}" dari daftar tim dokter jaga HD? Data penugasan jaga terkait tidak akan dihapus otomatis.`}
        />
      )}

      {/* Modal Delete All Confirmation */}
      {isClearAllModalOpen && (
        <DeleteConfirmModal
          isOpen={isClearAllModalOpen}
          onClose={() => setIsClearAllModalOpen(false)}
          onConfirm={() => {
            clearAllDoctors();
            setIsClearAllModalOpen(false);
          }}
          title="Hapus Seluruh Data Dokter"
          message="Apakah Anda yakin ingin menghapus seluruh data dokter yang terdaftar? Tindakan ini akan menghapus daftar dokter dari sistem lokal dan cloud."
        />
      )}
    </div>
  );
};
