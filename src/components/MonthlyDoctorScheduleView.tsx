import React, { useState, useMemo } from 'react';
import { useHemo } from '../context/HemoContext';
import { Doctor, DoctorShiftDuty } from '../types';
import { WhatsAppDispatcher } from '../domain/WhatsAppDispatcher';
import { GoogleSheetsService } from '../domain/GoogleSheetsService';
import {
  Stethoscope,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Award,
  Plus,
  Check,
  AlertCircle,
  Copy,
  ChevronRight,
  UserCheck,
  Download,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';

interface MonthlyDoctorScheduleViewProps {
  currentMonth: string;
}

export const MonthlyDoctorScheduleView: React.FC<MonthlyDoctorScheduleViewProps> = ({ currentMonth }) => {
  const {
    isAdmin,
    doctors,
    doctorDuties,
    setDoctorDuty,
    dispatchDoctorWhatsApp,
    showToast,
    selectDate,
    syncAllToGoogleSheets,
    settings,
  } = useHemo();

  const [selectedShiftForCopy, setSelectedShiftForCopy] = useState<'PAGI' | 'SIANG'>('PAGI');
  const [selectedDoctorForCopy, setSelectedDoctorForCopy] = useState<number | ''>('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);

  const handleSyncToSheets = async () => {
    if (!isAdmin) return;
    if (!settings.googleSheetWebhookUrl) {
      showToast('URL Google Apps Script belum diisi. Atur di menu Laporan & Sync.', 'error');
      return;
    }
    setIsSyncingSheets(true);
    await syncAllToGoogleSheets();
    setIsSyncingSheets(false);
  };

  // Month parsed
  const [yearStr, monthStr] = currentMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const totalDaysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  const daysArray = useMemo(() => {
    const days = [];
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const d = new Date(year, month - 1, day);
      const dayOfWeek = d.getDay();
      days.push({
        dayNumber: day,
        dateString: dateStr,
        dayName: dayNames[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isSunday: dayOfWeek === 0,
      });
    }
    return days;
  }, [year, month, totalDaysInMonth]);

  const activeDoctors = useMemo(() => {
    return doctors.filter((d) => d.isActive !== false);
  }, [doctors]);

  // Monthly stats for doctors
  const stats = useMemo(() => {
    let pagiCount = 0;
    let siangCount = 0;
    daysArray.forEach((d) => {
      const duty = doctorDuties[d.dateString];
      if (duty?.pagiDoctorName) pagiCount++;
      if (duty?.siangDoctorName) siangCount++;
    });
    return {
      pagiCount,
      siangCount,
      totalDays: totalDaysInMonth,
      coveragePercent: Math.round(((pagiCount + siangCount) / (totalDaysInMonth * 2)) * 100) || 0,
    };
  }, [daysArray, doctorDuties, totalDaysInMonth]);

  const handlePagiDoctorChange = (dateStr: string, doctorIdStr: string) => {
    if (!isAdmin) {
      showToast('Akses Dibatasi: Masuk sebagai Karu / Admin untuk merubah jadwal dokter jaga.', 'info');
      return;
    }
    if (doctorIdStr === '') {
      setDoctorDuty(dateStr, null, undefined);
    } else {
      const docId = Number(doctorIdStr);
      setDoctorDuty(dateStr, docId, undefined);
    }
  };

  const handleSiangDoctorChange = (dateStr: string, doctorIdStr: string) => {
    if (!isAdmin) {
      showToast('Akses Dibatasi: Masuk sebagai Karu / Admin untuk merubah jadwal dokter jaga.', 'info');
      return;
    }
    if (doctorIdStr === '') {
      setDoctorDuty(dateStr, undefined, null);
    } else {
      const docId = Number(doctorIdStr);
      setDoctorDuty(dateStr, undefined, docId);
    }
  };

  const handleNotesChange = (dateStr: string, notesVal: string) => {
    if (!isAdmin) return;
    setDoctorDuty(dateStr, undefined, undefined, notesVal);
  };

  // Bulk assign doctor to all weekdays or whole month
  const handleBulkAssign = (mode: 'ALL_DAYS' | 'WEEKDAYS') => {
    if (!isAdmin || !selectedDoctorForCopy) return;
    const docId = Number(selectedDoctorForCopy);
    const targetDays = daysArray.filter((d) => (mode === 'WEEKDAYS' ? !d.isSunday : true));

    targetDays.forEach((d) => {
      if (selectedShiftForCopy === 'PAGI') {
        setDoctorDuty(d.dateString, docId, undefined);
      } else {
        setDoctorDuty(d.dateString, undefined, docId);
      }
    });

    const docName = doctors.find((d) => d.id === docId)?.name || 'Dokter';
    showToast(
      `Berhasil menugaskan ${docName} pada Sif ${selectedShiftForCopy} untuk ${targetDays.length} hari!`,
      'success'
    );
    setIsBulkModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Banner / Stat Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                Jadwal Dokter Jaga Ruangan HD
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Terpisah dari mesin dialisis • Bertugas memantau hemodinamik pasien & visite ruangan
              </p>
            </div>
          </div>

          {/* Quick Bulk Assign Action, Google Sheets Sync & Export */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => GoogleSheetsService.exportDoctorScheduleToCSV(currentMonth, doctorDuties, doctors)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Ekspor jadwal dokter jaga bulan ini ke format CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Unduh CSV</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={handleSyncToSheets}
                disabled={isSyncingSheets}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                title="Kirim master dokter & jadwal dokter ke tab 'Data Dokter' dan 'Jadwal Dokter HD' di Google Sheets"
              >
                {isSyncingSheets ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>{isSyncingSheets ? 'Menyinkronkan...' : 'Sync Google Sheets'}</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(!isBulkModalOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Isi Jadwal Cepat</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Bulk Modal / Panel */}
        {isBulkModalOpen && (
          <div className="mt-4 p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/70 space-y-3">
            <div className="text-xs font-bold text-teal-900 dark:text-teal-200">
              ⚡ Pengisian Cepat Jadwal Dokter:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Pilih Dokter:
                </label>
                <select
                  value={selectedDoctorForCopy}
                  onChange={(e) => setSelectedDoctorForCopy(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
                >
                  <option value="">-- Pilih Dokter --</option>
                  {activeDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.role === 'DPJP' ? 'DPJP' : 'Dokter HD'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Pilih Sif:
                </label>
                <select
                  value={selectedShiftForCopy}
                  onChange={(e) => setSelectedShiftForCopy(e.target.value as 'PAGI' | 'SIANG')}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
                >
                  <option value="PAGI">Sif Pagi (07.00 - 14.00)</option>
                  <option value="SIANG">Sif Siang (12.00 - 19.00)</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  disabled={!selectedDoctorForCopy}
                  onClick={() => handleBulkAssign('WEEKDAYS')}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs"
                >
                  Isi Senin-Sabtu
                </button>
                <button
                  type="button"
                  disabled={!selectedDoctorForCopy}
                  onClick={() => handleBulkAssign('ALL_DAYS')}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs"
                >
                  Isi 1 Bulan Penuh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mini Stats Metrics */}
        <div className="grid grid-cols-3 gap-2.5 mt-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Sif Pagi Terjadwal</span>
            <span className="text-lg font-black text-sky-600 dark:text-sky-400">
              {stats.pagiCount} / {stats.totalDays} Hari
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Sif Siang Terjadwal</span>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
              {stats.siangCount} / {stats.totalDays} Hari
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Total Dokter HD</span>
            <span className="text-lg font-black text-teal-600 dark:text-teal-400">
              {activeDoctors.length} Dokter Aktif
            </span>
          </div>
        </div>
      </div>

      {/* Schedule Table / List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <th className="py-3 px-3 sm:px-4 font-bold text-slate-600 dark:text-slate-300 w-24">
                  Tanggal
                </th>
                <th className="py-3 px-3 sm:px-4 font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>Dokter Sif Pagi (07.00 - 14.00)</span>
                  </div>
                </th>
                <th className="py-3 px-3 sm:px-4 font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>Dokter Sif Siang (12.00 - 19.00)</span>
                  </div>
                </th>
                <th className="py-3 px-3 sm:px-4 font-bold text-slate-600 dark:text-slate-300 hidden md:table-cell w-56">
                  Catatan / Keterangan Jaga
                </th>
                <th className="py-3 px-3 font-bold text-slate-600 dark:text-slate-300 w-20 text-center">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {daysArray.map((day) => {
                const duty = doctorDuties[day.dateString];
                const pagiDoctor = activeDoctors.find((d) => d.id === duty?.pagiDoctorId) ||
                  (duty?.pagiDoctorName ? { name: duty.pagiDoctorName, id: -1, role: 'DOKTER_RUANGAN' as const, phone: '' } : undefined);
                const siangDoctor = activeDoctors.find((d) => d.id === duty?.siangDoctorId) ||
                  (duty?.siangDoctorName ? { name: duty.siangDoctorName, id: -1, role: 'DOKTER_RUANGAN' as const, phone: '' } : undefined);

                return (
                  <tr
                    key={day.dateString}
                    className={`transition-colors ${
                      day.isSunday
                        ? 'bg-rose-50/40 dark:bg-rose-950/10'
                        : day.isWeekend
                        ? 'bg-amber-50/30 dark:bg-amber-950/10'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Tanggal & Hari */}
                    <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                            day.isSunday
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                              : day.isWeekend
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {day.dayNumber}
                        </span>
                        <div>
                          <span
                            className={`font-bold block ${
                              day.isSunday
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {day.dayName}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Dokter Sif Pagi */}
                    <td className="py-2.5 px-3 sm:px-4 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <select
                          value={duty?.pagiDoctorId || (duty?.pagiDoctorName ? -1 : '')}
                          onChange={(e) => handlePagiDoctorChange(day.dateString, e.target.value)}
                          disabled={!isAdmin}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden disabled:bg-transparent disabled:border-transparent"
                        >
                          <option value="">-- Belum Ditentukan --</option>
                          {activeDoctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.name} {doc.role === 'DPJP' ? '(DPJP)' : ''}
                            </option>
                          ))}
                          {duty?.pagiDoctorName && !duty.pagiDoctorId && (
                            <option value="-1">{duty.pagiDoctorName} (Manual)</option>
                          )}
                        </select>

                        {pagiDoctor && pagiDoctor.id > 0 && pagiDoctor.phone && (
                          <button
                            type="button"
                            onClick={() => dispatchDoctorWhatsApp(pagiDoctor as Doctor, 'PAGI', day.dateString)}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-all shrink-0 cursor-pointer"
                            title={`Kirim notifikasi WA ke ${pagiDoctor.name}`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Dokter Sif Siang */}
                    <td className="py-2.5 px-3 sm:px-4 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <select
                          value={duty?.siangDoctorId || (duty?.siangDoctorName ? -1 : '')}
                          onChange={(e) => handleSiangDoctorChange(day.dateString, e.target.value)}
                          disabled={!isAdmin}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:bg-transparent disabled:border-transparent"
                        >
                          <option value="">-- Belum Ditentukan --</option>
                          {activeDoctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.name} {doc.role === 'DPJP' ? '(DPJP)' : ''}
                            </option>
                          ))}
                          {duty?.siangDoctorName && !duty.siangDoctorId && (
                            <option value="-1">{duty.siangDoctorName} (Manual)</option>
                          )}
                        </select>

                        {siangDoctor && siangDoctor.id > 0 && siangDoctor.phone && (
                          <button
                            type="button"
                            onClick={() => dispatchDoctorWhatsApp(siangDoctor as Doctor, 'SIANG', day.dateString)}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-all shrink-0 cursor-pointer"
                            title={`Kirim notifikasi WA ke ${siangDoctor.name}`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Catatan Jaga */}
                    <td className="py-2.5 px-3 sm:px-4 hidden md:table-cell">
                      <input
                        type="text"
                        defaultValue={duty?.notes || ''}
                        onBlur={(e) => handleNotesChange(day.dateString, e.target.value)}
                        placeholder="misal: On call / Visite 09.00"
                        disabled={!isAdmin}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </td>

                    {/* Link ke Tanggal di Harian */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => selectDate(day.dateString)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-teal-600 transition-colors inline-flex items-center justify-center"
                        title="Buka pembagian harian tanggal ini"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
