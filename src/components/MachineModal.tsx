import React, { useState, useEffect, useMemo } from 'react';
import {
  Machine,
  MachineCategory,
  MachineStatus,
  MachineOperationalShift,
  MACHINE_CATEGORY_INFO,
  MACHINE_STATUS_INFO,
  MACHINE_OPERATIONAL_SHIFT_INFO,
} from '../types';
import { useHemo } from '../context/HemoContext';
import {
  X,
  Cpu,
  Layers,
  Activity,
  Trash2,
  PlusCircle,
  Sun,
  Sunset,
  Clock,
  AlertCircle,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface MachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (machine: Omit<Machine, 'id'> | Machine) => void;
  onDelete?: (machine: Machine) => void;
  machine?: Machine | null;
  defaultBay?: string;
  defaultOperationalShift?: MachineOperationalShift;
}

export const MachineModal: React.FC<MachineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  machine,
  defaultBay,
  defaultOperationalShift = 'ALL',
}) => {
  const { bays: contextBays, machines, addBay } = useHemo();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [bay, setBay] = useState('Bay A (Reguler)');
  const [isCustomBay, setIsCustomBay] = useState(false);
  const [customBayInput, setCustomBayInput] = useState('');
  const [category, setCategory] = useState<MachineCategory>('REGULER');
  const [status, setStatus] = useState<MachineStatus>('AKTIF');
  const [operationalShift, setOperationalShift] = useState<MachineOperationalShift>('ALL');
  const [brandModel, setBrandModel] = useState('Fresenius 4008S');
  const [notes, setNotes] = useState('');

  // Dynamically resolve all bays created by user or assigned to machines
  const allAvailableBays = useMemo(() => {
    const set = new Set<string>();
    (contextBays || []).forEach((b) => set.add(b));
    machines.forEach((m) => {
      if (m.bay) set.add(m.bay);
    });
    if (machine?.bay) set.add(machine.bay);
    if (defaultBay) set.add(defaultBay);
    if (set.size === 0) {
      set.add('Bay A (Reguler)');
      set.add('Bay B (Reguler)');
      set.add('Bay C (Depan)');
      set.add('Bay C (Khusus & Isolasi)');
    }
    return Array.from(set);
  }, [contextBays, machines, machine, defaultBay]);

  // Helper function to auto-suggest next available code and name based on bay
  const generateSuggestedCodeAndName = (targetBay: string) => {
    // Extract letter prefix from bay if standard (e.g. 'Bay A' -> 'A', 'Bay B' -> 'B', 'Bay C' -> 'C')
    const match = targetBay.match(/Bay\s+([A-Za-z])/i);
    const prefix = match ? match[1].toUpperCase() : 'M-';

    let nextNumber = 1;
    if (prefix !== 'M-') {
      // Find highest number for this prefix
      const numbers = machines
        .map((m) => {
          const mCode = m.code.toUpperCase().trim();
          if (mCode.startsWith(prefix)) {
            const numPart = parseInt(mCode.replace(prefix, ''), 10);
            return isNaN(numPart) ? 0 : numPart;
          }
          return 0;
        })
        .filter((n) => n > 0);
      nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      const suggestedCode = `${prefix}${String(nextNumber).padStart(2, '0')}`;
      return {
        code: suggestedCode,
        name: `Mesin HD ${suggestedCode}`,
      };
    } else {
      // Generic M- prefix
      const numbers = machines
        .map((m) => {
          const mCode = m.code.toUpperCase().trim();
          if (mCode.startsWith('M-') || mCode.startsWith('M')) {
            const numPart = parseInt(mCode.replace(/[^0-9]/g, ''), 10);
            return isNaN(numPart) ? 0 : numPart;
          }
          return 0;
        })
        .filter((n) => n > 0);
      nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : machines.length + 1;
      const suggestedCode = `M-${String(nextNumber).padStart(2, '0')}`;
      return {
        code: suggestedCode,
        name: `Mesin HD ${String(nextNumber).padStart(2, '0')}`,
      };
    }
  };

  useEffect(() => {
    if (machine) {
      setCode(machine.code);
      setName(machine.name);
      setBay(machine.bay);
      setIsCustomBay(false);
      setCustomBayInput('');
      setCategory(machine.category);
      setStatus(machine.status);
      setOperationalShift(machine.operationalShift || 'ALL');
      setBrandModel(machine.brandModel || 'Fresenius 4008S');
      setNotes(machine.notes || '');
    } else {
      const initialBay = defaultBay || allAvailableBays[0] || 'Bay A (Reguler)';
      const suggestion = generateSuggestedCodeAndName(initialBay);
      setCode(suggestion.code);
      setName(suggestion.name);
      setBay(initialBay);
      setIsCustomBay(false);
      setCustomBayInput('');
      setCategory('REGULER');
      setStatus('AKTIF');
      setOperationalShift(defaultOperationalShift || 'ALL');
      setBrandModel('Fresenius 4008S');
      setNotes('');
    }
  }, [machine, isOpen, defaultBay, defaultOperationalShift]);

  // Check for duplicate code in real-time
  const normalizedCode = code.trim().toUpperCase();
  const duplicateMachine = useMemo(() => {
    if (!normalizedCode) return null;
    return machines.find(
      (m) =>
        m.code.trim().toUpperCase() === normalizedCode &&
        (!machine || m.id !== machine.id)
    );
  }, [normalizedCode, machines, machine]);

  // Quick auto-fill button handler
  const handleApplySuggestion = () => {
    const activeBay = isCustomBay && customBayInput.trim() ? customBayInput.trim() : bay;
    const suggestion = generateSuggestedCodeAndName(activeBay);
    setCode(suggestion.code);
    setName(suggestion.name);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = code.trim().toUpperCase();
    const finalName = name.trim();
    const finalBay = isCustomBay && customBayInput.trim() ? customBayInput.trim() : bay.trim();

    if (!finalCode || !finalName || !finalBay) return;
    if (duplicateMachine) return;

    // If new custom bay was created, register it into system
    if (isCustomBay && customBayInput.trim()) {
      addBay(finalBay, category, status);
    }

    if (machine) {
      onSave({
        ...machine,
        code: finalCode,
        name: finalName,
        bay: finalBay,
        category,
        status,
        operationalShift,
        brandModel: brandModel.trim() || 'Fresenius 4008S',
        notes: notes.trim(),
      });
    } else {
      onSave({
        code: finalCode,
        name: finalName,
        bay: finalBay,
        category,
        status,
        operationalShift,
        brandModel: brandModel.trim() || 'Fresenius 4008S',
        notes: notes.trim(),
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        id="machine-modal-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                {machine ? 'Ubah Data Mesin HD' : 'Tambah Mesin Dialisis'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {machine ? `Nomor ID #${machine.id} - ${machine.code}` : 'Pendaftaran Unit Mesin & Jadwal Sif'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-sm">
          {/* Duplicate Code Error Warning */}
          {duplicateMachine && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Kode Mesin Bentrok: </span>
                Kode <strong className="font-mono">{normalizedCode}</strong> sudah digunakan oleh{' '}
                <strong>{duplicateMachine.name}</strong> di {duplicateMachine.bay}. Silakan gunakan kode unik lain.
              </div>
            </div>
          )}

          {/* Quick Code & Name Generator */}
          {!machine && (
            <div className="flex items-center justify-between bg-indigo-50/60 border border-indigo-100 px-3 py-2 rounded-xl text-xs text-indigo-900">
              <div className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Saran penomoran otomatis aktif</span>
              </div>
              <button
                type="button"
                onClick={handleApplySuggestion}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
              >
                Terapkan Ulang Saran
              </button>
            </div>
          )}

          {/* Kode & Nama Mesin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kode Mesin <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => {
                  const val = e.target.value;
                  setCode(val);
                  // Auto-update name if name starts with Mesin HD or is empty
                  if (!machine && (name === '' || name.startsWith('Mesin HD'))) {
                    setName(val.trim() ? `Mesin HD ${val.trim().toUpperCase()}` : '');
                  }
                }}
                placeholder="misal: A01, B01, C05"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-mono font-bold text-slate-900 ${
                  duplicateMachine
                    ? 'border-rose-400 focus:ring-rose-400/20 focus:border-rose-500 text-rose-800'
                    : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Contoh: A01-A12, B01-B09, C01-C09
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Display Bed / Mesin <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="misal: Mesin HD A01"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-800"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Ditampilkan pada denah & pesan WhatsApp
              </span>
            </div>
          </div>

          {/* Bay & Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Zona / Ruang / Bay <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomBay(!isCustomBay)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>{isCustomBay ? 'Pilih dari List' : '+ Ketik Bay Baru'}</span>
                </button>
              </div>

              {isCustomBay ? (
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={customBayInput}
                    onChange={(e) => setCustomBayInput(e.target.value)}
                    placeholder="Ketik nama Bay baru..."
                    className="w-full pl-9 pr-3 py-2 bg-white border-2 border-indigo-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold"
                  />
                  <Layers className="w-4 h-4 text-indigo-600 absolute left-3 top-2.5" />
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={bay}
                    onChange={(e) => {
                      if (e.target.value === '__NEW_BAY__') {
                        setIsCustomBay(true);
                      } else {
                        const newBay = e.target.value;
                        setBay(newBay);
                        // If creating new machine, optionally update code suggestion for that bay
                        if (!machine) {
                          const suggestion = generateSuggestedCodeAndName(newBay);
                          setCode(suggestion.code);
                          setName(suggestion.name);
                        }
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 appearance-none font-medium cursor-pointer"
                  >
                    {allAvailableBays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="__NEW_BAY__">+ Tambah / Ketik Bay Baru...</option>
                  </select>
                  <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Infeksius / Khusus
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MachineCategory)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium cursor-pointer"
              >
                {Object.entries(MACHINE_CATEGORY_INFO).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Operasional & Operasional Sif */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status Kondisi Mesin
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MachineStatus)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium cursor-pointer"
                >
                  {Object.entries(MACHINE_STATUS_INFO).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
                <Activity className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jadwal Ketersediaan Sif
              </label>
              <div className="relative">
                <select
                  value={operationalShift}
                  onChange={(e) => setOperationalShift(e.target.value as MachineOperationalShift)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium cursor-pointer"
                >
                  <option value="ALL">☀️🌤️ Semua Sif (Pagi & Siang)</option>
                  <option value="PAGI">☀️ Khusus Sif Pagi Saja</option>
                  <option value="SIANG">🌤️ Khusus Sif Siang Saja</option>
                </select>
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Sif Quick Selector Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Pilihan Cepat Sif Mesin
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOperationalShift('ALL')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  operationalShift === 'ALL'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Semua Sif</span>
                <span className="text-[10px] font-normal text-slate-500">Pagi & Siang</span>
              </button>

              <button
                type="button"
                onClick={() => setOperationalShift('PAGI')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  operationalShift === 'PAGI'
                    ? 'bg-sky-50 border-sky-500 text-sky-800 ring-2 ring-sky-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sun className="w-4 h-4 text-sky-600" />
                <span>Khusus Pagi</span>
                <span className="text-[10px] font-normal text-slate-500">06:30 - 14:00</span>
              </button>

              <button
                type="button"
                onClick={() => setOperationalShift('SIANG')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  operationalShift === 'SIANG'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sunset className="w-4 h-4 text-amber-600" />
                <span>Khusus Siang</span>
                <span className="text-[10px] font-normal text-slate-500">13:30 - 21:00</span>
              </button>
            </div>
          </div>

          {/* Brand & Model */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Merk & Model Mesin
            </label>
            <input
              type="text"
              value={brandModel}
              onChange={(e) => setBrandModel(e.target.value)}
              placeholder="Fresenius 4008S, Nipro Surdial 55Plus, Gambro AK98, B.Braun"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan / Log Pemeliharaan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="misal: Kalibrasi pompa heparin, ganti filter RO, siap pakai..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <div>
              {machine && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDelete(machine);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors border border-rose-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Mesin
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={Boolean(duplicateMachine) || !code.trim() || !name.trim()}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  duplicateMachine || !code.trim() || !name.trim()
                    ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{machine ? 'Simpan Perubahan' : 'Simpan Mesin Baru'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
