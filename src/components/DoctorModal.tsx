import React, { useState, useEffect } from 'react';
import { Doctor, DoctorRole } from '../types';
import { X, Stethoscope, Phone, ShieldCheck, Award, Trash2 } from 'lucide-react';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface DoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (doctor: Omit<Doctor, 'id'> | Doctor) => void;
  onDelete?: (id: number) => void;
  doctor?: Doctor | null;
}

export const DoctorModal: React.FC<DoctorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  doctor,
}) => {
  const [name, setName] = useState('');
  const [sip, setSip] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<DoctorRole>('DOKTER_RUANGAN');
  const [specialization, setSpecialization] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (doctor) {
      setName(doctor.name);
      setSip(doctor.sip || '');
      setPhone(doctor.phone || '');
      setRole(doctor.role || 'DOKTER_RUANGAN');
      setSpecialization(doctor.specialization || '');
      setIsActive(doctor.isActive !== false);
    } else {
      setName('');
      setSip('');
      setPhone('');
      setRole('DOKTER_RUANGAN');
      setSpecialization('Dokter Ruangan Bersertifikat Dialisis');
      setIsActive(true);
    }
  }, [doctor, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const doctorData = {
      ...(doctor ? { id: doctor.id } : {}),
      name: name.trim(),
      sip: sip.trim(),
      phone: phone.trim(),
      role,
      specialization: specialization.trim() || undefined,
      isActive,
    };

    onSave(doctorData as Doctor);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200/80 dark:border-teal-800/60">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {doctor ? 'Edit Data Dokter Jaga' : 'Tambah Dokter Jaga HD'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dokter Penanggung Jawab / Dokter Jaga Ruangan Hemodialisis
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Nama Dokter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Lengkap Dokter & Gelar <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="misal: dr. Hendra Pratama, Sp.PD-KGH"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden dark:text-white placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Peran Dokter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Kategori / Peran Medis
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole('DPJP')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    role === 'DPJP'
                      ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-200 ring-1 ring-teal-500'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>DPJP Utama / Konsultan</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Dokter Spesialis Penyakit Dalam / KGH
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('DOKTER_RUANGAN')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    role === 'DOKTER_RUANGAN'
                      ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-200 ring-1 ring-teal-500'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Award className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Dokter Ruangan HD</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Dokter Bersertifikat Pelatihan Dialisis
                  </span>
                </button>
              </div>
            </div>

            {/* SIP / NIP & No WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  SIP / NIP Dokter
                </label>
                <input
                  type="text"
                  value={sip}
                  onChange={(e) => setSip(e.target.value)}
                  placeholder="misal: SIP.446/012/HD/2024"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  No. WhatsApp Dokter
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="misal: 081234567890"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Spesialisasi / Keterangan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Keahlian / Keterangan Tambahan
              </label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="misal: Sp.PD-KGH / Dokter Jaga Sif Pagi / On Call"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden dark:text-white"
              />
            </div>

            {/* Status Aktif */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Status Aktif Praktik</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Dokter aktif dapat dijadwalkan pada sif jaga HD
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              {doctor && onDelete ? (
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Dokter
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-500/20 transition-all active:scale-95"
                >
                  {doctor ? 'Simpan Perubahan' : 'Tambah Dokter'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {doctor && onDelete && (
        <DeleteConfirmModal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onConfirm={() => {
            onDelete(doctor.id);
            setIsDeleteConfirmOpen(false);
            onClose();
          }}
          title="Hapus Data Dokter Jaga?"
          message={`Apakah Anda yakin ingin menghapus data "${doctor.name}"? Data jadwal jaga sebelumnya akan tetap tersimpan.`}
        />
      )}
    </>
  );
};
