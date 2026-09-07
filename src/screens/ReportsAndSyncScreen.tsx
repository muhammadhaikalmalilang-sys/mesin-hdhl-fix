import React, { useState, useMemo } from 'react';
import { useHemo } from '../context/HemoContext';
import { FairSchedulerEngine } from '../domain/FairSchedulerEngine';
import { GoogleSheetsService } from '../domain/GoogleSheetsService';
import { GoogleScriptGuideModal } from '../components/GoogleScriptGuideModal';
import { ImportScheduleModal } from '../components/ImportScheduleModal';
import { ReadOnlyBanner } from '../components/ReadOnlyBanner';
import {
  FileSpreadsheet,
  Award,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  ExternalLink,
  Save,
  RotateCcw,
  Sparkles,
  Database,
  Building,
  Cloud,
  ShieldCheck,
  Laptop,
  Lock,
  Server,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const ReportsAndSyncScreen: React.FC = () => {
  const {
    isAdmin,
    currentMonth,
    nurses,
    machines,
    assignments,
    doctors,
    doctorDuties,
    settings,
    updateSettings,
    syncWithGoogleSheets,
    syncAllToGoogleSheets,
    fetchDataFromGoogleSheets,
    syncAllDataToCloud,
    fetchDataFromCloud,
    isCloudConnected,
    isCloudLoaded,
    resetToInitialData,
    showToast,
  } = useHemo();

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingAllSheets, setIsSyncingAllSheets] = useState(false);
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [showCloudAdvanced, setShowCloudAdvanced] = useState(false);

  // Editable settings form
  const [hospitalName, setHospitalName] = useState(settings.hospitalName);
  const [roomName, setRoomName] = useState(settings.roomName);
  const [headNurseName, setHeadNurseName] = useState(settings.headNurseName);
  const [headNursePhone, setHeadNursePhone] = useState(settings.headNursePhone);
  const [googleSheetWebhookUrl, setGoogleSheetWebhookUrl] = useState(
    settings.googleSheetWebhookUrl
  );
  const [googleSpreadsheetIdOrUrl, setGoogleSpreadsheetIdOrUrl] = useState(
    settings.googleSpreadsheetIdOrUrl
  );
  const [autoSync, setAutoSync] = useState(settings.autoSyncGoogleSheets);

  // Compute fairness report for current month
  const fairnessReport = useMemo(() => {
    return FairSchedulerEngine.calculateFairnessReport(
      currentMonth,
      nurses,
      machines,
      assignments
    );
  }, [currentMonth, nurses, machines, assignments]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    updateSettings({
      ...settings,
      hospitalName: hospitalName.trim(),
      roomName: roomName.trim(),
      headNurseName: headNurseName.trim(),
      headNursePhone: headNursePhone.trim(),
      googleSheetWebhookUrl: googleSheetWebhookUrl.trim(),
      googleSpreadsheetIdOrUrl: googleSpreadsheetIdOrUrl.trim(),
      autoSyncGoogleSheets: autoSync,
    });
    showToast('Pengaturan sistem & integrasi berhasil disimpan', 'success');
  };

  const handleManualSync = async () => {
    if (!isAdmin) return;
    setIsSyncing(true);
    const success = await syncWithGoogleSheets();
    setIsSyncing(false);
    if (success) {
      showToast('Sinkronisasi data ke Google Sheets berhasil!', 'success');
    } else {
      showToast('Sinkronisasi gagal. Periksa URL Webhook Google Apps Script.', 'error');
    }
  };

  const handleSyncAllToGoogleSheets = async () => {
    if (!isAdmin) return;
    setIsSyncingAllSheets(true);
    await syncAllToGoogleSheets(googleSheetWebhookUrl);
    setIsSyncingAllSheets(false);
  };

  const handleFetchAllFromGoogleSheets = async () => {
    setIsFetchingSheets(true);
    await fetchDataFromGoogleSheets(googleSheetWebhookUrl);
    setIsFetchingSheets(false);
  };

  const handleExportJSON = () => {
    const data = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      nurses,
      machines,
      assignments,
      settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hemo-shift-backup-${currentMonth}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File backup JSON berhasil diunduh', 'success');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.nurses && parsed.machines && parsed.assignments) {
          localStorage.setItem('hemo_nurses_v1', JSON.stringify(parsed.nurses));
          localStorage.setItem('hemo_machines_v1', JSON.stringify(parsed.machines));
          localStorage.setItem('hemo_assignments_v1', JSON.stringify(parsed.assignments));
          if (parsed.settings) {
            localStorage.setItem('hemo_settings_v1', JSON.stringify(parsed.settings));
          }
          showToast('Data berhasil dipulihkan dari backup. Memuat ulang...', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          showToast('Format file backup tidak valid', 'error');
        }
      } catch {
        showToast('Gagal membaca file backup', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="pb-24 space-y-5">
      <ReadOnlyBanner actionDescription="menyinkronkan data cloud, merubah pengaturan unit, atau memulihkan/mereset database" />

      {/* Google Sheets Integration & 2-Way Master Sync (Primary Sync Hub) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200/90 dark:border-slate-800 space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/60">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Integrasi Google Sheets (Sinkronisasi 2-Arah)
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Bebas Kuota (100% Selalu Muncul)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sinkronisasi master perawat, 25 mesin HD, dan jadwal shift dengan spreadsheet Google Drive tanpa batasan kuota Firebase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors min-h-[40px]"
            >
              Panduan Setup <ExternalLink className="w-3.5 h-3.5" />
            </button>
            {googleSpreadsheetIdOrUrl && (
              <a
                href={
                  googleSpreadsheetIdOrUrl.startsWith('http')
                    ? googleSpreadsheetIdOrUrl
                    : `https://docs.google.com/spreadsheets/d/${googleSpreadsheetIdOrUrl}/edit`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors min-h-[40px]"
              >
                Buka Spreadsheet <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* 2-Way Sync Quick Action Bar */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-slate-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Aksi Sinkronisasi Data Perawat, Mesin & Jadwal
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Tarik data ke perangkat ini atau kirim data lokal saat ini ke Google Sheets:
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-white/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900">
              <span>{nurses.length} Perawat</span>
              <span>•</span>
              <span>{machines.length} Mesin</span>
              <span>•</span>
              <span>{doctors.length} Dokter HD</span>
              <span>•</span>
              <span>{Object.keys(doctorDuties).length} Jadwal Dokter</span>
              <span>•</span>
              <span>{assignments.length} Jadwal Perawat</span>
            </div>
          </div>

          {/* Info Banner Dokter Google Sheets */}
          <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-3 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="text-[11px] leading-relaxed">
                Mencakup tab otomatis: <b>Matriks Jadwal HD</b>, <b>Data Dokter</b>, <b>Jadwal Dokter HD</b>, <b>Data Perawat</b>, dan <b>Data Mesin</b>. Jika tab dokter belum muncul, perbarui script ke versi terbaru via Panduan.
              </span>
            </div>
            <button
              onClick={() => setIsGuideOpen(true)}
              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 underline hover:text-emerald-800 dark:hover:text-white shrink-0 ml-4 sm:ml-0"
            >
              Lihat Cara Update Script &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {/* 1. Tarik dari Google Sheets */}
            <button
              onClick={handleFetchAllFromGoogleSheets}
              disabled={isFetchingSheets || !googleSheetWebhookUrl}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 active:scale-95 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 min-h-[44px]"
              title="Tarik data perawat, mesin, dokter, dan matriks jadwal (.xlsx) dari Google Sheets ke perangkat ini"
            >
              <Download className={`w-4 h-4 ${isFetchingSheets ? 'animate-bounce' : 'text-emerald-600'}`} />
              <span>{isFetchingSheets ? 'Menarik Data...' : 'Tarik dari Google Sheets'}</span>
            </button>

            {/* 2. Kirim Semua ke Google Sheets */}
            {isAdmin && (
              <button
                onClick={handleSyncAllToGoogleSheets}
                disabled={isSyncingAllSheets || !googleSheetWebhookUrl}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/25 transition-all disabled:opacity-50 min-h-[44px]"
                title="Kirim seluruh perawat, mesin, dokter, dan matriks jadwal format .xlsx kalender ke Google Sheets"
              >
                <Upload className={`w-4 h-4 ${isSyncingAllSheets ? 'animate-bounce' : ''}`} />
                <span>{isSyncingAllSheets ? 'Mengekspor...' : 'Kirim Semua ke Sheets (.xlsx)'}</span>
              </button>
            )}

            {/* 3. Sync Jadwal Saja */}
            {isAdmin && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing || !googleSheetWebhookUrl}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 active:scale-95 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 min-h-[44px]"
                title="Sinkronkan matriks jadwal kalender bulan aktif dan jadwal dokter ke Google Sheets"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Sync Matriks Jadwal'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync Status Banner */}
        {settings.lastSyncTimestamp && (
          <div className="flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Terakhir disinkronkan:{' '}
                <b>{new Date(settings.lastSyncTimestamp).toLocaleString('id-ID')}</b>
              </span>
            </div>
            <span className="font-mono text-[11px] bg-emerald-100/70 dark:bg-emerald-900/60 px-2 py-0.5 rounded-lg max-w-xs truncate">
              {settings.lastSyncStatus || 'OK (200)'}
            </span>
          </div>
        )}
      </div>

      {/* Cloud Firestore (Latar Belakang & Diagnostik Drawer) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-xs border border-slate-200/90 dark:border-slate-800 transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200/80 dark:border-sky-800/60 shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Database Cloud Firestore (Latar Belakang)
                </h4>
                {isCloudConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Terhubung Real-Time (Auto-Sync)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Menghubungkan...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Perubahan jadwal, mesin, dan perawat otomatis tersimpan di latar belakang ke Cloud Firestore.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCloudAdvanced(!showCloudAdvanced)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors shrink-0"
          >
            <span>{showCloudAdvanced ? 'Tutup Diagnostik Cloud' : 'Opsi Lanjutan / Diagnostik Cloud'}</span>
            {showCloudAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Advanced Cloud Controls */}
        {showCloudAdvanced && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in duration-150">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl text-xs text-amber-900 dark:text-amber-300">
              <span className="font-bold block mb-0.5">Catatan Diagnostik:</span>
              Tombol manual di bawah ini digunakan untuk sinkronisasi paksa ke database Firebase. Untuk sinkronisasi harian tanpa risiko batasan kuota harian, gunakan tombol <b>Google Sheets</b> di atas.
            </div>

            {/* Cloud Status Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  Jadwal di Cloud
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {assignments.length} Sif Terkunci
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  Data Perawat
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {nurses.length} Perawat
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  Mesin HD
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {machines.length} Mesin
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                onClick={async () => {
                  setIsSyncingCloud(true);
                  await fetchDataFromCloud();
                  setIsSyncingCloud(false);
                }}
                disabled={isSyncingCloud}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-2xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 min-h-[44px]"
                title="Tarik dan perbarui data dari Cloud Firestore ke perangkat ini"
              >
                <Download className="w-4 h-4 text-sky-600" />
                <span>{isSyncingCloud ? 'Menarik...' : 'Tarik Manual dari Cloud'}</span>
              </button>

              <button
                onClick={async () => {
                  setIsSyncingCloud(true);
                  await syncAllDataToCloud();
                  setIsSyncingCloud(false);
                }}
                disabled={isSyncingCloud}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-2xl font-bold text-xs shadow-md shadow-sky-500/25 transition-all disabled:opacity-50 min-h-[44px]"
                title="Unggah dan simpan seluruh data lokal ke Cloud Firestore"
              >
                <Upload className={`w-4 h-4 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
                <span>{isSyncingCloud ? 'Menyinkronkan...' : 'Unggah Manual ke Cloud'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fairness & Workload Analysis Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200/90 dark:border-slate-800 space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/60">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Laporan Analisis Beban Kerja & Keadilan Sif
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Periode Bulan: <b className="text-slate-800 dark:text-slate-200">{currentMonth}</b> &bull; Evaluasi
                  distribusi sif dan alokasi mesin perawat
                </p>
              </div>
            </div>
          </div>

          {/* Fairness Score Badge */}
          <div className="flex items-center gap-3 bg-emerald-50/80 dark:bg-emerald-950/40 px-4 py-2 rounded-2xl border border-emerald-200 dark:border-emerald-800">
            <div className="text-right">
              <span className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300 block">
                Skor Keadilan Algoritma
              </span>
              <span className="text-xl font-black text-emerald-900 dark:text-emerald-200">
                {fairnessReport.fairnessScorePercent}%
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Mini stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Rata-rata Sif Kerja</span>
            <div className="font-bold text-slate-800 dark:text-white text-base mt-0.5">
              {fairnessReport.avgShiftsPerNurse} Sif / Orang
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Rentang Beban Sif</span>
            <div className="font-bold text-slate-800 dark:text-white text-base mt-0.5">
              Min: {fairnessReport.minShifts} | Max: {fairnessReport.maxShifts}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Rata-rata Alokasi Mesin</span>
            <div className="font-bold text-slate-800 dark:text-white text-base mt-0.5">
              {fairnessReport.avgMachinesPerNurse} Mesin / Sif
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Total Hari Libur Tim</span>
            <div className="font-bold text-slate-800 dark:text-white text-base mt-0.5">
              {fairnessReport.totalOffDays} Hari
            </div>
          </div>
        </div>

        {/* Nurse Fairness Distribution Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Nama Perawat</th>
                  <th className="py-2.5 px-2 text-center">Jabatan</th>
                  <th className="py-2.5 px-2 text-center text-sky-700 dark:text-sky-400">Pagi</th>
                  <th className="py-2.5 px-2 text-center text-amber-700 dark:text-amber-400">Siang</th>
                  <th className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400">Libur</th>
                  <th className="py-2.5 px-2 text-center text-teal-700 dark:text-teal-400">Cuti</th>
                  <th className="py-2.5 px-2 text-center font-bold text-slate-900 dark:text-white">Total Dinas</th>
                  <th className="py-2.5 px-2 text-center font-bold text-blue-700 dark:text-blue-400">Total Mesin</th>
                  <th className="py-2.5 px-2 text-center font-bold text-purple-700 dark:text-purple-400">Mesin Isolasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fairnessReport.nurseStats.map((stat, idx) => (
                  <tr key={stat.nurseId} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/40 dark:bg-slate-800/40'}>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{stat.nurseName}</td>
                    <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400">{stat.role}</td>
                    <td className="py-2.5 px-2 text-center font-semibold text-sky-700 dark:text-sky-400">
                      {stat.pagiCount}
                    </td>
                    <td className="py-2.5 px-2 text-center font-semibold text-amber-700 dark:text-amber-400">
                      {stat.siangCount}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400">{stat.liburCount}</td>
                    <td className="py-2.5 px-2 text-center text-teal-700 dark:text-teal-400">{stat.cutiCount}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-900 dark:text-white">
                      {stat.totalWorkingShifts}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-blue-700 dark:text-blue-400">
                      {stat.totalMachinesAssigned}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-purple-700 dark:text-purple-400">
                      {stat.isolationMachinesHandled}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Import Jadwal dari Excel / Sheets */}
      <div className="bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-emerald-600/5 dark:from-emerald-950/40 dark:to-slate-900 rounded-3xl p-5 border border-emerald-300/60 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Import Jadwal Bulanan dari Excel / Sheet
              </h3>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                Fitur Baru
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Unggah file (.xlsx, .xls, .csv), tautkan Google Sheets, atau salin-tempel matriks jadwal perawat.
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-98 shrink-0 min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            <span>Buka Pengimpor Jadwal</span>
          </button>
        )}
      </div>

      {/* Google Sheets Webhook Configuration & Unit Identity */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200/90 dark:border-slate-800 space-y-4 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/60">
            <Building className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Pengaturan Webhook & Identitas Unit
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              URL deployment Google Apps Script, tautan spreadsheet, dan identitas ruangan untuk laporan WhatsApp.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Google Apps Script Web App URL (GET & POST):
            </label>
            <input
              type="url"
              value={googleSheetWebhookUrl}
              onChange={(e) => setGoogleSheetWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800 dark:text-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              URL Web App yang diperoleh dari deployment Apps Script (akhiran /exec). Digunakan untuk membaca dan menulis data perawat, mesin, serta jadwal.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tautan / ID Spreadsheet (Untuk Akses Langsung):
            </label>
            <input
              type="text"
              value={googleSpreadsheetIdOrUrl}
              onChange={(e) => setGoogleSpreadsheetIdOrUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Otomatis sinkron ke Google Sheets saat generate jadwal atau edit sif
              </span>
            </label>
          </div>

          {/* Unit Settings */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-3 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Identitas Unit & Rumah Sakit
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Rumah Sakit</label>
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Ruangan / Unit</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Kepala Ruangan (KARU)
                </label>
                <input
                  type="text"
                  value={headNurseName}
                  onChange={(e) => setHeadNurseName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor WhatsApp KARU (Untuk Laporan)
                </label>
                <input
                  type="tel"
                  value={headNursePhone}
                  onChange={(e) => setHeadNursePhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-md shadow-blue-500/25 transition-all min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                Simpan Pengaturan
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Backup & Restore Data Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200/90 dark:border-slate-800 space-y-4 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl">
            <Database className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Backup & Pemulihan Data</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Simpan cadangan offline data perawat, 25 mesin, dan jadwal sif ke format JSON
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-colors min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            Unduh Backup JSON
          </button>

          <button
            onClick={() => GoogleSheetsService.exportDoctorsToCSV(doctors)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold rounded-2xl transition-colors min-h-[44px]"
            title="Unduh daftar master data dokter jaga ke file CSV"
          >
            <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Unduh CSV Dokter
          </button>

          <button
            onClick={() => GoogleSheetsService.exportDoctorScheduleToCSV(currentMonth, doctorDuties, doctors)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold rounded-2xl transition-colors min-h-[44px]"
            title="Unduh jadwal dokter jaga bulan aktif ke file CSV"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Unduh CSV Jadwal Dokter
          </button>

          {isAdmin && (
            <>
              <label className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl cursor-pointer transition-colors min-h-[44px]">
                <Upload className="w-4 h-4" />
                Pulihkan dari Backup JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'PERINGATAN: Apakah Anda yakin ingin mereset data? Data perawat akan dikosongkan dan susunan 30 mesin HD (A01-A12, C01-C04, B01-B09, C05-C09) akan disiapkan kembali.'
                    )
                  ) {
                    resetToInitialData();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold rounded-2xl transition-colors ml-auto min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Data Ruangan
              </button>
            </>
          )}
        </div>
      </div>

      {/* Guide Modal */}
      <GoogleScriptGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Import Schedule Modal */}
      {isImportModalOpen && (
        <ImportScheduleModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          defaultMonth={currentMonth}
        />
      )}
    </div>
  );
};
