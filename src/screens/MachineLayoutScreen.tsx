import React, { useState, useMemo } from 'react';
import { useHemo } from '../context/HemoContext';
import {
  Machine,
  MachineStatus,
  MachineCategory,
  MachineOperationalShift,
  MACHINE_CATEGORY_INFO,
  MACHINE_STATUS_INFO,
  MACHINE_OPERATIONAL_SHIFT_INFO,
  ShiftType,
  getMachineStatusForShift,
} from '../types';
import { MachineModal } from '../components/MachineModal';
import { ManageBayModal } from '../components/ManageBayModal';
import { RegenerateMachineAllocationModal } from '../components/RegenerateMachineAllocationModal';
import { WhatsAppBroadcastModal } from '../components/WhatsAppBroadcastModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { ReadOnlyBanner } from '../components/ReadOnlyBanner';
import { WhatsAppDispatcher } from '../domain/WhatsAppDispatcher';
import { FairSchedulerEngine } from '../domain/FairSchedulerEngine';
import {
  Cpu,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Activity,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Sunset,
  CheckCircle2,
  Wrench,
  PowerOff,
  Sparkles,
  RotateCcw,
  LayoutGrid,
  List,
  Search,
  Check,
  ArrowRight,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Share2,
  Columns,
  SlidersHorizontal,
  Clock,
  UserCheck,
  UserX,
} from 'lucide-react';

type MachineScreenTab = 'PAGI' | 'SIANG' | 'COMPARE' | 'MASTER';
type ShiftStatusFilter = 'ALL' | 'ASSIGNED' | 'UNASSIGNED' | 'ISOLASI';

export const MachineLayoutScreen: React.FC = () => {
  const {
    isAdmin,
    machines,
    dailyAssignments,
    selectedDate,
    selectDate,
    bays: contextBays,
    updateMachine,
    updateMachineShiftStatus,
    toggleMachineStatus,
    addMachine,
    deleteMachine,
    loadDefaultMachines,
    reallocateMachinesForDate,
    updateAssignment,
    isGenerating,
    showToast,
  } = useHemo();

  // Primary Screen Tab: Sif Pagi, Sif Siang, Perbandingan Dua Sif, atau Master Mesin
  const [activeTab, setActiveTab] = useState<MachineScreenTab>('PAGI');

  // Secondary Display Options
  const [viewMode, setViewMode] = useState<'BY_BAY' | 'GRID' | 'TABLE'>('BY_BAY');
  const [compareViewMode, setCompareViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBayFilter, setSelectedBayFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedShiftOperationalFilter, setSelectedShiftOperationalFilter] = useState<string>('ALL');
  const [shiftStatusFilter, setShiftStatusFilter] = useState<ShiftStatusFilter>('ALL');
  const [compareDisparityFilter, setCompareDisparityFilter] = useState<'ALL' | 'INCOMPLETE' | 'DIFFERENT' | 'COMPLETE'>('ALL');

  // Modals
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [modalDefaultBay, setModalDefaultBay] = useState<string | undefined>(undefined);
  const [modalDefaultShift, setModalDefaultShift] = useState<MachineOperationalShift>('ALL');
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);
  const [assigningState, setAssigningState] = useState<{
    machine: Machine;
    targetShift: 'PAGI' | 'SIANG';
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReallocateModalOpen, setIsReallocateModalOpen] = useState(false);
  const [reallocateTargetShift, setReallocateTargetShift] = useState<'ALL' | 'PAGI' | 'SIANG'>('ALL');
  const [isBayModalOpen, setIsBayModalOpen] = useState(false);
  const [selectedBayToManage, setSelectedBayToManage] = useState<string | undefined>(undefined);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastInitialShift, setBroadcastInitialShift] = useState<'PAGI' | 'SIANG' | null>(null);

  // Parse Date for Quick Navigator
  const dateObj = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    } catch {
      // fallback
    }
    return new Date();
  }, [selectedDate]);

  const handlePrevDay = () => {
    const prev = new Date(dateObj);
    prev.setDate(prev.getDate() - 1);
    const dStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(
      prev.getDate()
    ).padStart(2, '0')}`;
    selectDate(dStr);
  };

  const handleNextDay = () => {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + 1);
    const dStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
      next.getDate()
    ).padStart(2, '0')}`;
    selectDate(dStr);
  };

  const handleToday = () => {
    const today = new Date();
    const dStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    selectDate(dStr);
  };

  // Group machines by Bay for visual floor plan layout in room sequence
  const bays = useMemo(() => {
    const deletedBays = new Set<string>(
      JSON.parse(localStorage.getItem('hemo_deleted_bays_v1') || '[]').map((b: string) => b.trim().toLowerCase())
    );
    const bayOrder: string[] = [];
    (contextBays || []).forEach((b) => {
      const trimmed = b?.trim();
      if (trimmed && !deletedBays.has(trimmed.toLowerCase()) && !bayOrder.includes(trimmed)) {
        bayOrder.push(trimmed);
      }
    });
    WhatsAppDispatcher.getSortedMachines(machines).forEach((m) => {
      const trimmed = m.bay?.trim();
      if (trimmed && !deletedBays.has(trimmed.toLowerCase()) && !bayOrder.includes(trimmed)) {
        bayOrder.push(trimmed);
      }
    });
    return bayOrder;
  }, [contextBays, machines]);

  // Helper map builder for machine assignments on a specific shift
  const buildShiftMachineNurseMap = (shiftType: 'PAGI' | 'SIANG') => {
    const map = new Map<
      number | string,
      { nurseName: string; isLeader: boolean; nurseId: number; specialDuty?: string | null; assignmentId: string }
    >();
    const shiftAssignments = dailyAssignments.filter((a) => a.shiftType === shiftType);

    shiftAssignments.forEach((assignment) => {
      const assignedMachines = WhatsAppDispatcher.getAssignedMachinesForAssignment(assignment, machines);
      assignedMachines.forEach((m) => {
        const info = {
          nurseName: assignment.nurseName,
          isLeader: assignment.isLeader,
          nurseId: assignment.nurseId,
          specialDuty: assignment.specialDuty,
          assignmentId: assignment.id,
        };
        map.set(m.id, info);
        map.set(String(m.id), info);
        if (m.code) {
          map.set(m.code.toUpperCase(), info);
          map.set(m.code.toLowerCase(), info);
        }
      });

      (assignment.assignedMachineIds || []).forEach((mId) => {
        const info = {
          nurseName: assignment.nurseName,
          isLeader: assignment.isLeader,
          nurseId: assignment.nurseId,
          specialDuty: assignment.specialDuty,
          assignmentId: assignment.id,
        };
        map.set(mId, info);
        map.set(Number(mId), info);
        map.set(String(mId), info);
      });
    });
    return map;
  };

  const pagiMachineNurseMap = useMemo(() => buildShiftMachineNurseMap('PAGI'), [dailyAssignments, machines]);
  const siangMachineNurseMap = useMemo(() => buildShiftMachineNurseMap('SIANG'), [dailyAssignments, machines]);

  // Active Map depending on current tab
  const currentActiveShift: 'PAGI' | 'SIANG' = activeTab === 'SIANG' ? 'SIANG' : 'PAGI';
  const currentMachineNurseMap = activeTab === 'SIANG' ? siangMachineNurseMap : pagiMachineNurseMap;

  // Nurses on shifts
  const pagiNurses = useMemo(() => dailyAssignments.filter((a) => a.shiftType === 'PAGI'), [dailyAssignments]);
  const siangNurses = useMemo(() => dailyAssignments.filter((a) => a.shiftType === 'SIANG'), [dailyAssignments]);
  const currentShiftNurses = currentActiveShift === 'SIANG' ? siangNurses : pagiNurses;

  // Machines operational for Pagi / Siang / Master
  const machinesForCurrentShift = useMemo(() => {
    // Show all unit machines so users can configure & view status for Sif Pagi, Sif Siang, or Master
    return machines;
  }, [machines]);

  // Filtered machines according to activeTab and user filters
  const filteredMachines = useMemo(() => {
    const list = machinesForCurrentShift.filter((m) => {
      const effectiveStatus =
        activeTab === 'PAGI'
          ? getMachineStatusForShift(m, 'PAGI')
          : activeTab === 'SIANG'
          ? getMachineStatusForShift(m, 'SIANG')
          : m.status;

      if (selectedBayFilter !== 'ALL' && m.bay !== selectedBayFilter) return false;
      if (selectedCategoryFilter !== 'ALL' && m.category !== selectedCategoryFilter) return false;
      if (selectedStatusFilter !== 'ALL' && effectiveStatus !== selectedStatusFilter) return false;
      if (selectedShiftOperationalFilter !== 'ALL' && (m.operationalShift || 'ALL') !== selectedShiftOperationalFilter) return false;

      // Filter by assignment status in shift mode
      if (activeTab === 'PAGI' || activeTab === 'SIANG') {
        const assigned =
          currentMachineNurseMap.get(m.id) ||
          currentMachineNurseMap.get(String(m.id)) ||
          (m.code ? currentMachineNurseMap.get(m.code.toUpperCase()) || currentMachineNurseMap.get(m.code.toLowerCase()) : undefined);

        if (shiftStatusFilter === 'ASSIGNED' && !assigned) return false;
        if (shiftStatusFilter === 'UNASSIGNED') {
          const isOper = effectiveStatus === 'AKTIF';
          if (!isOper || assigned) return false;
        }
        if (shiftStatusFilter === 'ISOLASI' && m.category !== 'ISOLASI' && m.category !== 'HEPATITIS_B' && m.category !== 'HEPATITIS_C') {
          return false;
        }
      }

      // Filter by compare disparity
      if (activeTab === 'COMPARE') {
        const pagiAssigned = pagiMachineNurseMap.get(m.id) || (m.code ? pagiMachineNurseMap.get(m.code.toUpperCase()) : undefined);
        const siangAssigned = siangMachineNurseMap.get(m.id) || (m.code ? siangMachineNurseMap.get(m.code.toUpperCase()) : undefined);
        const pagiActive = getMachineStatusForShift(m, 'PAGI') === 'AKTIF';
        const siangActive = getMachineStatusForShift(m, 'SIANG') === 'AKTIF';

        if (compareDisparityFilter === 'INCOMPLETE') {
          const pagiNeeds = pagiActive && !pagiAssigned;
          const siangNeeds = siangActive && !siangAssigned;
          if (!pagiNeeds && !siangNeeds) return false;
        } else if (compareDisparityFilter === 'COMPLETE') {
          const pagiOk = !pagiActive || !!pagiAssigned;
          const siangOk = !siangActive || !!siangAssigned;
          if (!pagiOk || !siangOk) return false;
        } else if (compareDisparityFilter === 'DIFFERENT') {
          if (!pagiAssigned || !siangAssigned) return false;
          if (pagiAssigned.nurseName === siangAssigned.nurseName) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = m.code.toLowerCase().includes(q);
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesBay = m.bay.toLowerCase().includes(q);
        const matchesBrand = (m.brandModel || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesBay && !matchesBrand) return false;
      }

      return true;
    });

    return WhatsAppDispatcher.getSortedMachines(list);
  }, [
    machinesForCurrentShift,
    selectedBayFilter,
    selectedCategoryFilter,
    selectedStatusFilter,
    selectedShiftOperationalFilter,
    shiftStatusFilter,
    compareDisparityFilter,
    searchQuery,
    activeTab,
    currentMachineNurseMap,
    pagiMachineNurseMap,
    siangMachineNurseMap,
  ]);

  // Group filtered machines by Bay
  const machinesByBay = useMemo(() => {
    const grouped: { [bay: string]: Machine[] } = {};
    bays.forEach((bay) => {
      grouped[bay] = [];
    });
    filteredMachines.forEach((m) => {
      if (!grouped[m.bay]) grouped[m.bay] = [];
      grouped[m.bay].push(m);
    });
    return grouped;
  }, [filteredMachines, bays]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalAll = machines.length;
    const activeAll = machines.filter((m) => m.status === 'AKTIF').length;
    const maintenanceAll = machines.filter((m) => m.status === 'MAINTENANCE').length;
    const brokenAll = machines.filter((m) => m.status === 'RUSAK').length;

    // Sif Pagi stats
    const pagiActive = machines.filter((m) => getMachineStatusForShift(m, 'PAGI') === 'AKTIF');
    const pagiAssigned = pagiActive.filter((m) => {
      return (
        pagiMachineNurseMap.get(m.id) ||
        pagiMachineNurseMap.get(String(m.id)) ||
        (m.code ? pagiMachineNurseMap.get(m.code.toUpperCase()) : undefined)
      );
    });
    const pagiUnassigned = pagiActive.length - pagiAssigned.length;

    // Sif Siang stats
    const siangActive = machines.filter((m) => getMachineStatusForShift(m, 'SIANG') === 'AKTIF');
    const siangAssigned = siangActive.filter((m) => {
      return (
        siangMachineNurseMap.get(m.id) ||
        siangMachineNurseMap.get(String(m.id)) ||
        (m.code ? siangMachineNurseMap.get(m.code.toUpperCase()) : undefined)
      );
    });
    const siangUnassigned = siangActive.length - siangAssigned.length;

    // Compare stats
    const fullyAllocatedBothShifts = machines.filter((m) => {
      const isPagiActive = getMachineStatusForShift(m, 'PAGI') === 'AKTIF';
      const isSiangActive = getMachineStatusForShift(m, 'SIANG') === 'AKTIF';
      const isPagiOk = !isPagiActive || pagiMachineNurseMap.get(m.id);
      const isSiangOk = !isSiangActive || siangMachineNurseMap.get(m.id);
      return isPagiOk && isSiangOk;
    }).length;

    return {
      totalAll,
      activeAll,
      maintenanceAll,
      brokenAll,
      pagiEligibleCount: machines.length,
      pagiActiveCount: pagiActive.length,
      pagiAssignedCount: pagiAssigned.length,
      pagiUnassignedCount: pagiUnassigned,
      pagiNurseCount: pagiNurses.length,
      siangEligibleCount: machines.length,
      siangActiveCount: siangActive.length,
      siangAssignedCount: siangAssigned.length,
      siangUnassignedCount: siangUnassigned,
      siangNurseCount: siangNurses.length,
      fullyAllocatedBothShifts,
    };
  }, [machines, pagiMachineNurseMap, siangMachineNurseMap, pagiNurses, siangNurses]);

  // Status toggle handler
  const handleToggleStatus = (machine: Machine, targetShift?: 'PAGI' | 'SIANG') => {
    if (!isAdmin) return;
    const shift = targetShift || (activeTab === 'SIANG' ? 'SIANG' : activeTab === 'PAGI' ? 'PAGI' : undefined);

    if (shift) {
      const currentStatus = getMachineStatusForShift(machine, shift);
      const nextStatus: MachineStatus =
        currentStatus === 'AKTIF'
          ? 'TIDAK_DIGUNAKAN'
          : currentStatus === 'TIDAK_DIGUNAKAN'
          ? 'MAINTENANCE'
          : currentStatus === 'MAINTENANCE'
          ? 'RUSAK'
          : 'AKTIF';

      updateMachineShiftStatus(machine.id, shift, nextStatus);
      showToast(
        `Status ${machine.code} Sif ${shift === 'PAGI' ? 'Pagi' : 'Siang'} diubah menjadi: ${MACHINE_STATUS_INFO[nextStatus].label}`,
        'info'
      );
    } else {
      const nextStatus: MachineStatus =
        machine.status === 'AKTIF'
          ? 'TIDAK_DIGUNAKAN'
          : machine.status === 'TIDAK_DIGUNAKAN'
          ? 'MAINTENANCE'
          : machine.status === 'MAINTENANCE'
          ? 'RUSAK'
          : 'AKTIF';

      updateMachine({
        ...machine,
        status: nextStatus,
      });
      showToast(`Status master ${machine.code} diubah menjadi ${MACHINE_STATUS_INFO[nextStatus].label}`, 'info');
    }
  };

  // Quick toggle between Aktif and Tidak Digunakan for specific shift
  const handleQuickToggleActiveForShift = (machine: Machine, shift: 'PAGI' | 'SIANG') => {
    if (!isAdmin) return;
    const current = getMachineStatusForShift(machine, shift);
    const next: MachineStatus = current === 'AKTIF' ? 'TIDAK_DIGUNAKAN' : 'AKTIF';
    updateMachineShiftStatus(machine.id, shift, next);
    showToast(
      `${machine.code} di Sif ${shift === 'PAGI' ? 'Pagi' : 'Siang'} sekarang: ${MACHINE_STATUS_INFO[next].label}`,
      next === 'AKTIF' ? 'success' : 'info'
    );
  };

  // Open Add Machine Modal with optional shift & bay context
  const handleOpenAddMachine = (targetShift?: 'PAGI' | 'SIANG' | 'ALL', targetBay?: string) => {
    if (!isAdmin) {
      showToast('Hanya Kepala Ruangan / Admin yang dapat menambah unit mesin HD.', 'error');
      return;
    }
    setEditingMachine(null);
    setModalDefaultBay(targetBay);
    if (targetShift) {
      setModalDefaultShift(targetShift);
    } else if (activeTab === 'PAGI') {
      setModalDefaultShift('PAGI');
    } else if (activeTab === 'SIANG') {
      setModalDefaultShift('SIANG');
    } else {
      setModalDefaultShift('ALL');
    }
    setIsModalOpen(true);
  };

  // Save machine handler
  const handleSaveMachine = (m: Omit<Machine, 'id'> | Machine) => {
    if (!isAdmin) {
      showToast('Hanya Kepala Ruangan / Admin yang dapat mengelola unit mesin HD.', 'error');
      return;
    }
    if ('id' in m) {
      updateMachine(m as Machine);
    } else {
      addMachine(m);
    }
    setIsModalOpen(false);
    setEditingMachine(null);
    setModalDefaultBay(undefined);
  };

  // Manual Assign handler
  const handleManualAssign = (nurseAssignmentId: string, machineId: number, targetShift: 'PAGI' | 'SIANG') => {
    if (!isAdmin) return;
    const targetAssignment = dailyAssignments.find((a) => a.id === nurseAssignmentId);
    if (!targetAssignment) return;

    // Check if machine is already assigned to someone else on this shift and unassign it
    dailyAssignments.forEach((a) => {
      if (a.shiftType === targetShift && a.assignedMachineIds.includes(machineId) && a.id !== targetAssignment.id) {
        const remaining = a.assignedMachineIds.filter((id) => id !== machineId);
        updateAssignment(a, a.shiftType, remaining, a.isLeader, a.notes, a.specialDuty);
      }
    });

    const targetMachine = machines.find((m) => m.id === machineId);
    const isIso = targetMachine ? FairSchedulerEngine.isIsolationMachine(targetMachine) : false;
    let newSpecialDuty = targetAssignment.specialDuty;

    if (isIso && !FairSchedulerEngine.hasCitoDuty(targetAssignment)) {
      newSpecialDuty = newSpecialDuty && newSpecialDuty.trim() !== '' ? `${newSpecialDuty.trim()}, CITO` : 'CITO';
      showToast(`Mesin Isolasi dialokasikan ke ${targetAssignment.nurseName} (Tugas Khusus CITO ditambahkan)`, 'success');
    } else {
      showToast(`Mesin dialokasikan ke ${targetAssignment.nurseName} untuk Sif ${targetShift === 'PAGI' ? 'Pagi' : 'Siang'}!`, 'success');
    }

    const updatedMachines = Array.from(new Set([...targetAssignment.assignedMachineIds, machineId]));
    updateAssignment(
      targetAssignment,
      targetAssignment.shiftType,
      updatedMachines,
      targetAssignment.isLeader,
      targetAssignment.notes,
      newSpecialDuty
    );
    setAssigningState(null);
  };

  return (
    <div className="pb-24 space-y-4">
      <ReadOnlyBanner actionDescription="menambah data mesin, merubah status operasional, atau mengalokasikan mesin HD" />

      {/* TOP HEADER & NAVIGATION BAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
        {/* Title, Subtitle, & Date Navigator */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 ring-4 ring-blue-50 shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Pengelolaan & Denah Mesin HD
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Pemisahan operasional mesin per sif, penugasan perawat, dan zonasi infeksius
              </p>
            </div>
          </div>

          {/* Quick Date Navigator Bar */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs self-start lg:self-auto">
            <button
              onClick={handlePrevDay}
              className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-all"
              title="Hari Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 font-extrabold text-slate-800">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{WhatsAppDispatcher.formatIndonesianDate(selectedDate)}</span>
            </div>
            <button
              onClick={handleToday}
              className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 font-bold rounded-lg border border-slate-200 shadow-2xs transition-all"
              title="Kembali ke Hari Ini"
            >
              Hari Ini
            </button>
            <button
              onClick={handleNextDay}
              className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-all"
              title="Hari Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRIMARY SHIFT TABS: PAGI vs SIANG vs PERBANDINGAN DUA SIF vs MASTER */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          {/* Tab 1: Sif Pagi */}
          <button
            onClick={() => setActiveTab('PAGI')}
            className={`p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden cursor-pointer ${
              activeTab === 'PAGI'
                ? 'bg-sky-50/80 border-sky-500 text-sky-950 shadow-sm ring-2 ring-sky-500/20'
                : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    activeTab === 'PAGI' ? 'bg-sky-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block">Mesin Sif Pagi</span>
                  <span className="text-[10px] text-slate-500 font-medium">06:30 - 14:00 WIB</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  stats.pagiUnassignedCount === 0
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                {stats.pagiAssignedCount}/{stats.pagiActiveCount} Bed
              </span>
            </div>
          </button>

          {/* Tab 2: Sif Siang */}
          <button
            onClick={() => setActiveTab('SIANG')}
            className={`p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden cursor-pointer ${
              activeTab === 'SIANG'
                ? 'bg-amber-50/80 border-amber-500 text-amber-950 shadow-sm ring-2 ring-amber-500/20'
                : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    activeTab === 'SIANG' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Sunset className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block">Mesin Sif Siang</span>
                  <span className="text-[10px] text-slate-500 font-medium">13:30 - 21:00 WIB</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  stats.siangUnassignedCount === 0
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                {stats.siangAssignedCount}/{stats.siangActiveCount} Bed
              </span>
            </div>
          </button>

          {/* Tab 3: Perbandingan Dua Sif (Compare) */}
          <button
            onClick={() => setActiveTab('COMPARE')}
            className={`p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden cursor-pointer ${
              activeTab === 'COMPARE'
                ? 'bg-indigo-50/80 border-indigo-500 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20'
                : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    activeTab === 'COMPARE' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Columns className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block">Perbandingan Dua Sif</span>
                  <span className="text-[10px] text-slate-500 font-medium">Rekap Pagi vs Siang</span>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                Berdampingan
              </span>
            </div>
          </button>

          {/* Tab 4: Master Unit Mesin */}
          <button
            onClick={() => setActiveTab('MASTER')}
            className={`p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden cursor-pointer ${
              activeTab === 'MASTER'
                ? 'bg-slate-100 border-slate-700 text-slate-900 shadow-sm ring-2 ring-slate-400/20'
                : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    activeTab === 'MASTER' ? 'bg-slate-800 text-white shadow-2xs' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block">Kelola Unit Mesin</span>
                  <span className="text-[10px] text-slate-500 font-medium">Spesifikasi & Master Bay</span>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                {stats.totalAll} Unit
              </span>
            </div>
          </button>
        </div>

        {/* SHIFT-SPECIFIC ACTION BANNER (PAGI) */}
        {activeTab === 'PAGI' && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-amber-300 shadow-inner">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-2">
                  <span>Operasional Mesin Sif Pagi</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/20 border border-white/30">
                    06:30 - 14:00 WIB
                  </span>
                </h3>
                <p className="text-xs text-sky-100 font-medium">
                  {stats.pagiNurseCount} perawat bertugas memegang {stats.pagiAssignedCount} dari {stats.pagiActiveCount} mesin aktif.
                  {stats.pagiUnassignedCount > 0 ? (
                    <span className="font-black text-amber-200 ml-1">
                      ⚠️ {stats.pagiUnassignedCount} mesin belum ada penanggung jawab!
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-200 ml-1">
                      ✓ Semua mesin aktif telah teralokasikan.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-end">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setReallocateTargetShift('PAGI');
                      setIsReallocateModalOpen(true);
                    }}
                    disabled={isGenerating}
                    className="px-3.5 py-2 bg-white text-blue-700 hover:bg-blue-50 font-black rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Alokasikan mesin khusus Sif Pagi secara adil tanpa mengubah Sif Siang"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isGenerating ? 'Mengalokasikan...' : 'Alokasi Otomatis Pagi'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenAddMachine('PAGI')}
                    className="px-3.5 py-2 bg-sky-800/80 hover:bg-sky-800 text-white font-bold rounded-xl text-xs shadow-xs border border-sky-400/40 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Tambah unit mesin baru khusus Sif Pagi"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Mesin</span>
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setBroadcastInitialShift('PAGI');
                  setIsBroadcastModalOpen(true);
                }}
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold rounded-xl text-xs backdrop-blur-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Buka atau bagikan format WhatsApp jadwal mesin Sif Pagi"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Kirim Rekap WA Pagi</span>
              </button>
            </div>
          </div>
        )}

        {/* SHIFT-SPECIFIC ACTION BANNER (SIANG) */}
        {activeTab === 'SIANG' && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-amber-200 shadow-inner">
                <Sunset className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-2">
                  <span>Operasional Mesin Sif Siang</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/20 border border-white/30">
                    13:30 - 21:00 WIB
                  </span>
                </h3>
                <p className="text-xs text-amber-100 font-medium">
                  {stats.siangNurseCount} perawat bertugas memegang {stats.siangAssignedCount} dari {stats.siangActiveCount} mesin aktif.
                  {stats.siangUnassignedCount > 0 ? (
                    <span className="font-black text-yellow-200 ml-1">
                      ⚠️ {stats.siangUnassignedCount} mesin belum ada penanggung jawab!
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-200 ml-1">
                      ✓ Semua mesin aktif telah teralokasikan.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-end">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setReallocateTargetShift('SIANG');
                      setIsReallocateModalOpen(true);
                    }}
                    disabled={isGenerating}
                    className="px-3.5 py-2 bg-white text-orange-700 hover:bg-orange-50 font-black rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Alokasikan mesin khusus Sif Siang secara adil tanpa mengubah Sif Pagi"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isGenerating ? 'Mengalokasikan...' : 'Alokasi Otomatis Siang'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenAddMachine('SIANG')}
                    className="px-3.5 py-2 bg-amber-800/80 hover:bg-amber-800 text-white font-bold rounded-xl text-xs shadow-xs border border-amber-400/40 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Tambah unit mesin baru khusus Sif Siang"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Mesin</span>
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setBroadcastInitialShift('SIANG');
                  setIsBroadcastModalOpen(true);
                }}
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold rounded-xl text-xs backdrop-blur-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Buka atau bagikan format WhatsApp jadwal mesin Sif Siang"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Kirim Rekap WA Siang</span>
              </button>
            </div>
          </div>
        )}

        {/* SHIFT-SPECIFIC ACTION BANNER (COMPARE) */}
        {activeTab === 'COMPARE' && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-700 via-purple-700 to-slate-800 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-indigo-200 shadow-inner">
                <Columns className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                  Perbandingan & Rekapitulasi Dua Sif Berdampingan
                </h3>
                <p className="text-xs text-indigo-100 font-medium">
                  {stats.fullyAllocatedBothShifts} dari {stats.totalAll} mesin terisi penanggung jawab di kedua sif (Pagi & Siang).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-end">
              {isAdmin && (
                <button
                  onClick={() => {
                    setReallocateTargetShift('ALL');
                    setIsReallocateModalOpen(true);
                  }}
                  disabled={isGenerating}
                  className="px-3.5 py-2 bg-white text-indigo-800 hover:bg-indigo-50 font-black rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Alokasi mesin untuk kedua sif sekaligus"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Alokasikan Kedua Sif</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* MASTER UNIT MESIN BANNER */}
        {activeTab === 'MASTER' && (
          <div className="p-4 rounded-xl bg-slate-900 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                  Master Data Mesin Hemodialisis
                </h3>
                <p className="text-xs text-slate-300 font-medium">
                  Atur spesifikasi, bay ruangan, jadwal ketersediaan sif (Pagi/Siang), serta status maintenance mesin.
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-end">
                <button
                  onClick={() => {
                    setSelectedBayToManage(undefined);
                    setIsBayModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Kelola Bay</span>
                </button>

                <button
                  onClick={loadDefaultMachines}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Pulihkan seluruh 30 mesin dialisis bawaan"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Pulihkan 30 Mesin</span>
                </button>

                <button
                  onClick={() => handleOpenAddMachine('ALL')}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Mesin</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* SHIFT-SPECIFIC KPI STATS (For PAGI or SIANG) */}
        {(activeTab === 'PAGI' || activeTab === 'SIANG') && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Mesin Operasional
              </span>
              <div className="text-xl font-black text-slate-900 mt-0.5">
                {activeTab === 'PAGI' ? stats.pagiEligibleCount : stats.siangEligibleCount} Bed
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Sif {activeTab === 'PAGI' ? 'Pagi' : 'Siang'}
              </span>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-300 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Aktif Siap Pakai
              </span>
              <div className="text-xl font-black text-emerald-900 mt-0.5">
                {activeTab === 'PAGI' ? stats.pagiActiveCount : stats.siangActiveCount} Bed
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold">Siap Pelayanan</span>
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-300 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                Sudah Ada PJ
              </span>
              <div className="text-xl font-black text-blue-900 mt-0.5">
                {activeTab === 'PAGI' ? stats.pagiAssignedCount : stats.siangAssignedCount} Bed
              </div>
              <span className="text-[10px] text-blue-700 font-semibold">
                {Math.round(
                  ((activeTab === 'PAGI' ? stats.pagiAssignedCount : stats.siangAssignedCount) /
                    Math.max(1, activeTab === 'PAGI' ? stats.pagiActiveCount : stats.siangActiveCount)) *
                    100
                )}
                % teralokasi
              </span>
            </div>

            <div
              className={`p-3 rounded-xl border shadow-2xs ${
                (activeTab === 'PAGI' ? stats.pagiUnassignedCount : stats.siangUnassignedCount) > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider block">
                Belum Ada PJ
              </span>
              <div
                className={`text-xl font-black mt-0.5 ${
                  (activeTab === 'PAGI' ? stats.pagiUnassignedCount : stats.siangUnassignedCount) > 0
                    ? 'text-amber-900'
                    : 'text-slate-700'
                }`}
              >
                {activeTab === 'PAGI' ? stats.pagiUnassignedCount : stats.siangUnassignedCount} Bed
              </div>
              <span className="text-[10px] font-medium">
                {(activeTab === 'PAGI' ? stats.pagiUnassignedCount : stats.siangUnassignedCount) > 0
                  ? 'Perlu Ditugaskan'
                  : 'Semua Ber-PJ'}
              </span>
            </div>

            <div className="bg-purple-50 p-3 rounded-xl border border-purple-300 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider block">
                Perawat Dinas Sif
              </span>
              <div className="text-xl font-black text-purple-900 mt-0.5">
                {currentShiftNurses.length} Orang
              </div>
              <span className="text-[10px] text-purple-800 font-bold">
                ~
                {currentShiftNurses.length > 0
                  ? (
                      (activeTab === 'PAGI' ? stats.pagiAssignedCount : stats.siangAssignedCount) /
                      currentShiftNurses.length
                    ).toFixed(1)
                  : 0}{' '}
                bed/perawat
              </span>
            </div>
          </div>
        )}

        {/* QUICK FILTER PILLS FOR CURRENT SHIFT */}
        {(activeTab === 'PAGI' || activeTab === 'SIANG') && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-bold text-[11px] mr-1">Filter Penugasan Sif:</span>
            <button
              onClick={() => setShiftStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                shiftStatusFilter === 'ALL'
                  ? activeTab === 'PAGI'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Semua Mesin Sif ({machinesForCurrentShift.length})
            </button>

            <button
              onClick={() => setShiftStatusFilter('UNASSIGNED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                shiftStatusFilter === 'UNASSIGNED'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : (activeTab === 'PAGI' ? stats.pagiUnassignedCount : stats.siangUnassignedCount) > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>
                Belum Ada PJ ({activeTab === 'PAGI' ? stats.pagiUnassignedCount : stats.siangUnassignedCount})
              </span>
            </button>

            <button
              onClick={() => setShiftStatusFilter('ASSIGNED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                shiftStatusFilter === 'ASSIGNED'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Sudah Ada PJ ({activeTab === 'PAGI' ? stats.pagiAssignedCount : stats.siangAssignedCount})
            </button>

            <button
              onClick={() => setShiftStatusFilter('ISOLASI')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                shiftStatusFilter === 'ISOLASI'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Ruang Isolasi & Hep</span>
            </button>

            {/* Quick Filter Status Sif */}
            <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

            <button
              onClick={() => setSelectedStatusFilter((prev) => (prev === 'AKTIF' ? 'ALL' : 'AKTIF'))}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedStatusFilter === 'AKTIF'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Tampilkan hanya mesin aktif pada sif ini"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Aktif Sif ({activeTab === 'PAGI' ? stats.pagiActiveCount : stats.siangActiveCount})</span>
            </button>

            <button
              onClick={() => setSelectedStatusFilter((prev) => (prev === 'TIDAK_DIGUNAKAN' ? 'ALL' : 'TIDAK_DIGUNAKAN'))}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedStatusFilter === 'TIDAK_DIGUNAKAN'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="Tampilkan mesin yang tidak digunakan pada sif ini"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>
                Off ({machines.filter((m) => getMachineStatusForShift(m, activeTab as 'PAGI' | 'SIANG') === 'TIDAK_DIGUNAKAN').length})
              </span>
            </button>
          </div>
        )}

        {/* TOOLBAR: SEARCH, BAY SELECTOR, CATEGORY & VIEW MODE */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-200">
          {/* View Mode Switcher */}
          {activeTab !== 'COMPARE' ? (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0">
              <button
                onClick={() => setViewMode('BY_BAY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'BY_BAY'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Per Ruangan (Bay)</span>
              </button>

              <button
                onClick={() => setViewMode('GRID')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'GRID'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                <span>Grid Lengkap</span>
              </button>

              <button
                onClick={() => setViewMode('TABLE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5 text-blue-600" />
                <span>Daftar Tabel</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0">
              <button
                onClick={() => setCompareViewMode('TABLE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  compareViewMode === 'TABLE'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tabel Komparasi</span>
              </button>
              <button
                onClick={() => setCompareViewMode('CARDS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  compareViewMode === 'CARDS'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns className="w-3.5 h-3.5 text-indigo-600" />
                <span>Kartu Split</span>
              </button>
            </div>
          )}

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs flex-1 justify-end">
            <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari mesin, kode, bay..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={selectedBayFilter}
              onChange={(e) => setSelectedBayFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
            >
              <option value="ALL">Semua Bay ({bays.length})</option>
              {bays.map((bay) => (
                <option key={bay} value={bay}>
                  {bay}
                </option>
              ))}
            </select>

            {activeTab === 'COMPARE' ? (
              <select
                value={compareDisparityFilter}
                onChange={(e) => setCompareDisparityFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
              >
                <option value="ALL">Semua Status Sif</option>
                <option value="INCOMPLETE">Belum Lengkap (Ada yang Kosong)</option>
                <option value="COMPLETE">Lengkap Kedua Sif</option>
                <option value="DIFFERENT">PJ Pagi ≠ PJ Siang</option>
              </select>
            ) : (
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="REGULER">Reguler</option>
                <option value="HEPATITIS_B">Hepatitis B</option>
                <option value="HEPATITIS_C">Hepatitis C</option>
                <option value="ISOLASI">Isolasi Khusus</option>
              </select>
            )}

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
            >
              <option value="ALL">Semua Status Mesin</option>
              <option value="AKTIF">🟢 Aktif (Siap Pakai)</option>
              <option value="TIDAK_DIGUNAKAN">⚪ Tidak Digunakan (Off)</option>
              <option value="MAINTENANCE">🟡 Maintenance</option>
              <option value="RUSAK">🔴 Rusak</option>
            </select>

            {activeTab === 'MASTER' && (
              <select
                value={selectedShiftOperationalFilter}
                onChange={(e) => setSelectedShiftOperationalFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
              >
                <option value="ALL">Semua Jadwal Sif</option>
                <option value="ALL">Pagi & Siang (Penuh)</option>
                <option value="PAGI">Hanya Sif Pagi</option>
                <option value="SIANG">Hanya Sif Siang</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* EMPTY FILTER STATE */}
      {filteredMachines.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-slate-900 text-base">Tidak Ada Mesin yang Cocok</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tidak ditemukan mesin yang memenuhi kriteria filter atau pencarian Anda pada{' '}
            {activeTab === 'PAGI' ? 'Sif Pagi' : activeTab === 'SIANG' ? 'Sif Siang' : 'menu ini'}.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedBayFilter('ALL');
                setSelectedCategoryFilter('ALL');
                setSelectedStatusFilter('ALL');
                setShiftStatusFilter('ALL');
                setCompareDisparityFilter('ALL');
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              Reset Filter
            </button>
            <button
              onClick={loadDefaultMachines}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm"
            >
              Pulihkan 30 Mesin HD
            </button>
          </div>
        </div>
      )}

      {/* TAB VIEW 1 & 2: SIF PAGI ATAU SIF SIANG ATAU MASTER */}
      {activeTab !== 'COMPARE' && filteredMachines.length > 0 && (
        <>
          {/* VIEW: BY BAY / ROOM GROUPED */}
          {viewMode === 'BY_BAY' && (
            <div className="space-y-6">
              {bays.map((bay) => {
                const bayMachines = machinesByBay[bay] || [];
                if (bayMachines.length === 0) return null;

                const isIsolationBay = bay.toLowerCase().includes('isolasi') || bay.toLowerCase().includes('cito');
                const isHepBay = bay.toLowerCase().includes('hepatitis');

                return (
                  <div
                    key={bay}
                    className={`rounded-2xl border-2 overflow-hidden shadow-xs ${
                      isIsolationBay
                        ? 'bg-rose-50/40 border-rose-300'
                        : isHepBay
                        ? 'bg-purple-50/40 border-purple-300'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    {/* Bay Header */}
                    <div
                      className={`px-4 py-3 flex items-center justify-between border-b ${
                        isIsolationBay
                          ? 'bg-rose-100/90 border-rose-300 text-rose-950'
                          : isHepBay
                          ? 'bg-purple-100/90 border-purple-300 text-purple-950'
                          : 'bg-slate-100 border-slate-300 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                            isIsolationBay
                              ? 'bg-rose-600 text-white'
                              : isHepBay
                              ? 'bg-purple-600 text-white'
                              : activeTab === 'SIANG'
                              ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {bay.charAt(0)}
                        </span>
                        <div>
                          <h3 className="font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-2">
                            {bay}
                            {isIsolationBay && (
                              <span className="text-[10px] font-black uppercase bg-rose-600 text-white px-2 py-0.5 rounded-full">
                                Ruang Isolasi (Wajib CITO)
                              </span>
                            )}
                          </h3>
                          <span className="text-[11px] font-medium text-slate-600">
                            {bayMachines.length} Mesin HD terdaftar di area ini
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs font-bold hidden sm:block">
                          <span className="text-emerald-700">
                            {bayMachines.filter((m) => m.status === 'AKTIF').length} Aktif
                          </span>
                          {bayMachines.filter((m) => m.status !== 'AKTIF').length > 0 && (
                            <span className="text-rose-700 ml-2">
                              • {bayMachines.filter((m) => m.status !== 'AKTIF').length} Non-Aktif
                            </span>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenAddMachine(activeTab === 'PAGI' ? 'PAGI' : activeTab === 'SIANG' ? 'SIANG' : 'ALL', bay)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              title={`Tambah unit mesin baru di ${bay}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">+ Mesin</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBayToManage(bay);
                                setIsBayModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 hover:border-blue-400 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                              title={`Atur Status, Nama, dan Kategori untuk ${bay}`}
                            >
                              <Settings className="w-3.5 h-3.5 text-slate-600" />
                              <span>Atur Bay</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bay Machines Grid */}
                    <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {bayMachines.map((machine) => (
                        <MachineCard
                          key={machine.id}
                          machine={machine}
                          activeShiftView={currentActiveShift}
                          machineNurseMap={currentMachineNurseMap}
                          isMasterMode={activeTab === 'MASTER'}
                          isAdmin={isAdmin}
                          onEdit={() => {
                            setEditingMachine(machine);
                            setIsModalOpen(true);
                          }}
                          onToggleStatus={() => handleToggleStatus(machine, activeTab === 'MASTER' ? undefined : currentActiveShift)}
                          onQuickToggleActive={() => handleQuickToggleActiveForShift(machine, currentActiveShift)}
                          onDelete={() => setMachineToDelete(machine)}
                          onAssign={() =>
                            setAssigningState({
                              machine,
                              targetShift: currentActiveShift,
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW: FLAT ALL MACHINES GRID */}
          {viewMode === 'GRID' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredMachines.map((machine) => (
                <MachineCard
                  key={machine.id}
                  machine={machine}
                  activeShiftView={currentActiveShift}
                  machineNurseMap={currentMachineNurseMap}
                  isMasterMode={activeTab === 'MASTER'}
                  isAdmin={isAdmin}
                  onEdit={() => {
                    setEditingMachine(machine);
                    setIsModalOpen(true);
                  }}
                  onToggleStatus={() => handleToggleStatus(machine, activeTab === 'MASTER' ? undefined : currentActiveShift)}
                  onQuickToggleActive={() => handleQuickToggleActiveForShift(machine, currentActiveShift)}
                  onDelete={() => setMachineToDelete(machine)}
                  onAssign={() =>
                    setAssigningState({
                      machine,
                      targetShift: currentActiveShift,
                    })
                  }
                />
              ))}
            </div>
          )}

          {/* VIEW: COMPACT TABLE VIEW */}
          {viewMode === 'TABLE' && (
            <div className="bg-white rounded-2xl border-2 border-slate-300 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-300">
                      <th className="py-3 px-3">Kode Bed</th>
                      <th className="py-3 px-3">Nama Mesin</th>
                      <th className="py-3 px-3">Ruangan / Bay</th>
                      <th className="py-3 px-3">Kategori Infeksius</th>
                      <th className="py-3 px-3">
                        {activeTab === 'MASTER' ? 'Status Mesin Master' : `Status Sif ${activeTab === 'PAGI' ? 'Pagi' : 'Siang'}`}
                      </th>
                      <th className="py-3 px-3">Status Sif Lain</th>
                      <th className="py-3 px-3">Jadwal Sif</th>
                      {activeTab !== 'MASTER' && (
                        <th className="py-3 px-3">PJ Perawat ({activeTab === 'PAGI' ? 'Sif Pagi' : 'Sif Siang'})</th>
                      )}
                      {isAdmin && <th className="py-3 px-3 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredMachines.map((m) => {
                      const assigned =
                        currentMachineNurseMap.get(m.id) ||
                        currentMachineNurseMap.get(String(m.id)) ||
                        (m.code
                          ? currentMachineNurseMap.get(m.code.toUpperCase()) || currentMachineNurseMap.get(m.code.toLowerCase())
                          : undefined);
                      const catInfo = MACHINE_CATEGORY_INFO[m.category];
                      const shiftInfo = MACHINE_OPERATIONAL_SHIFT_INFO[m.operationalShift || 'ALL'];
                      const isIso = m.category === 'ISOLASI';

                      const effectiveStatus =
                        activeTab === 'PAGI'
                          ? getMachineStatusForShift(m, 'PAGI')
                          : activeTab === 'SIANG'
                          ? getMachineStatusForShift(m, 'SIANG')
                          : m.status;
                      const statusInfo = MACHINE_STATUS_INFO[effectiveStatus];

                      const otherShift = activeTab === 'PAGI' ? 'SIANG' : 'PAGI';
                      const otherStatus = getMachineStatusForShift(m, otherShift);
                      const otherStatusInfo = MACHINE_STATUS_INFO[otherStatus];

                      return (
                        <tr
                          key={m.id}
                          className={`hover:bg-slate-50 font-medium ${
                            isIso ? 'bg-rose-50/40' : effectiveStatus !== 'AKTIF' ? 'bg-slate-50/70 opacity-80' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-black text-slate-900 text-sm">
                            <span className="inline-flex items-center gap-1">
                              {m.code}
                              {isIso && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{m.name}</div>
                            <div className="text-[10px] text-slate-500">{m.brandModel}</div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{m.bay}</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${catInfo.badgeClass}`}>
                              {catInfo.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-bold border inline-flex items-center gap-1 ${statusInfo.colorClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                                {statusInfo.label}
                              </span>
                              {isAdmin && activeTab !== 'MASTER' && (
                                <button
                                  onClick={() => handleQuickToggleActiveForShift(m, activeTab as 'PAGI' | 'SIANG')}
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-colors ${
                                    effectiveStatus === 'AKTIF'
                                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                  }`}
                                  title={`Klik untuk ubah status di Sif ${activeTab === 'PAGI' ? 'Pagi' : 'Siang'}`}
                                >
                                  {effectiveStatus === 'AKTIF' ? 'Set Off' : 'Set Aktif'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {activeTab === 'MASTER' ? (
                              <div className="text-[10px] space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-slate-600">Pagi:</span>
                                  <span className={MACHINE_STATUS_INFO[getMachineStatusForShift(m, 'PAGI')].label}>
                                    {MACHINE_STATUS_INFO[getMachineStatusForShift(m, 'PAGI')].label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-slate-600">Siang:</span>
                                  <span className={MACHINE_STATUS_INFO[getMachineStatusForShift(m, 'SIANG')].label}>
                                    {MACHINE_STATUS_INFO[getMachineStatusForShift(m, 'SIANG')].label}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-600">
                                Sif {otherShift === 'PAGI' ? 'Pagi' : 'Siang'}:{' '}
                                <span className={otherStatus === 'AKTIF' ? 'text-emerald-700 font-black' : 'text-slate-500'}>
                                  {otherStatusInfo.label}
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${shiftInfo.badgeClass}`}>
                              {shiftInfo.shortLabel}
                            </span>
                          </td>
                          {activeTab !== 'MASTER' && (
                            <td className="py-2.5 px-3">
                              {assigned ? (
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className={`w-5 h-5 rounded-md text-white font-black text-[10px] flex items-center justify-center ${
                                      activeTab === 'SIANG' ? 'bg-amber-600' : 'bg-blue-600'
                                    }`}
                                  >
                                    {assigned.nurseName.charAt(0)}
                                  </div>
                                  <span className="font-extrabold text-slate-900">{assigned.nurseName}</span>
                                  {assigned.isLeader && (
                                    <span className="text-[9px] font-black px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">
                                      KATIM
                                    </span>
                                  )}
                                  {isAdmin && (
                                    <button
                                      onClick={() =>
                                        setAssigningState({
                                          machine: m,
                                          targetShift: currentActiveShift,
                                        })
                                      }
                                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold ml-1"
                                    >
                                      Ubah
                                    </button>
                                  )}
                                </div>
                              ) : effectiveStatus === 'AKTIF' ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                    Belum Ada PJ
                                  </span>
                                  {isAdmin && (
                                    <button
                                      onClick={() =>
                                        setAssigningState({
                                          machine: m,
                                          targetShift: currentActiveShift,
                                        })
                                      }
                                      className="text-[10px] font-black px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                      Tugaskan
                                    </button>
                                  )}
                                </div>
                              ) : effectiveStatus === 'TIDAK_DIGUNAKAN' ? (
                                <span className="text-[11px] text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded font-medium">
                                  Tidak Digunakan ({activeTab === 'PAGI' ? 'Pagi' : 'Siang'})
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">Non-Aktif</span>
                              )}
                            </td>
                          )}
                          {isAdmin && (
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingMachine(m);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit Mesin"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(m, activeTab === 'MASTER' ? undefined : (activeTab as 'PAGI' | 'SIANG'))}
                                  className="p-1 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  title={`Ganti Status Sif ${activeTab === 'MASTER' ? 'Master' : activeTab}`}
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setMachineToDelete(m)}
                                  className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                  title="Hapus Mesin"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB VIEW 3: PERBANDINGAN DUA SIF (COMPARE VIEW) */}
      {activeTab === 'COMPARE' && filteredMachines.length > 0 && (
        <div className="space-y-4">
          {compareViewMode === 'TABLE' ? (
            <div className="bg-white rounded-2xl border-2 border-slate-300 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-300">
                      <th className="py-3 px-3 w-28">Kode Bed</th>
                      <th className="py-3 px-3">Mesin & Ruangan</th>
                      <th className="py-3 px-3">Status Mesin</th>
                      <th className="py-3 px-4 bg-sky-50/70 border-l border-r border-sky-200 text-sky-950 font-black">
                        <div className="flex items-center gap-1.5">
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span>PJ Sif Pagi (06:30 - 14:00)</span>
                        </div>
                      </th>
                      <th className="py-3 px-4 bg-amber-50/70 border-r border-amber-200 text-amber-950 font-black">
                        <div className="flex items-center gap-1.5">
                          <Sunset className="w-4 h-4 text-amber-600" />
                          <span>PJ Sif Siang (13:30 - 21:00)</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredMachines.map((m) => {
                      const pagiAssigned =
                        pagiMachineNurseMap.get(m.id) ||
                        pagiMachineNurseMap.get(String(m.id)) ||
                        (m.code ? pagiMachineNurseMap.get(m.code.toUpperCase()) : undefined);

                      const siangAssigned =
                        siangMachineNurseMap.get(m.id) ||
                        siangMachineNurseMap.get(String(m.id)) ||
                        (m.code ? siangMachineNurseMap.get(m.code.toUpperCase()) : undefined);

                      const catInfo = MACHINE_CATEGORY_INFO[m.category];
                      const isIso = m.category === 'ISOLASI';

                      const pagiStatus = getMachineStatusForShift(m, 'PAGI');
                      const siangStatus = getMachineStatusForShift(m, 'SIANG');
                      const pagiStatusInfo = MACHINE_STATUS_INFO[pagiStatus];
                      const siangStatusInfo = MACHINE_STATUS_INFO[siangStatus];

                      const isPagiActive = pagiStatus === 'AKTIF';
                      const isSiangActive = siangStatus === 'AKTIF';

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 font-medium">
                          {/* Bed Code */}
                          <td className="py-3 px-3 font-mono font-black text-slate-900 text-sm align-top">
                            <span className="inline-flex items-center gap-1.5">
                              {m.code}
                              {isIso && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                            </span>
                          </td>

                          {/* Machine & Room */}
                          <td className="py-3 px-3 align-top">
                            <div className="font-extrabold text-slate-900 text-sm">{m.name}</div>
                            <div className="text-slate-600 text-xs font-semibold">{m.bay}</div>
                            <div className="mt-1 flex items-center gap-1">
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${catInfo.badgeClass}`}>
                                {catInfo.label}
                              </span>
                            </div>
                          </td>

                          {/* Machine Status (Both Shifts) */}
                          <td className="py-3 px-3 align-top space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-sky-800 font-bold flex items-center gap-1">
                                <Sun className="w-3 h-3 text-amber-500" /> Pagi:
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold border inline-flex items-center gap-1 ${pagiStatusInfo.colorClass}`}
                              >
                                <span className={`w-1 h-1 rounded-full ${pagiStatusInfo.dotClass}`} />
                                {pagiStatusInfo.label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-amber-900 font-bold flex items-center gap-1">
                                <Sunset className="w-3 h-3 text-amber-600" /> Siang:
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold border inline-flex items-center gap-1 ${siangStatusInfo.colorClass}`}
                              >
                                <span className={`w-1 h-1 rounded-full ${siangStatusInfo.dotClass}`} />
                                {siangStatusInfo.label}
                              </span>
                            </div>
                          </td>

                          {/* Sif Pagi Column */}
                          <td className="py-3 px-4 bg-sky-50/30 border-l border-r border-sky-100 align-top">
                            {!isPagiActive ? (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 italic bg-slate-100 px-2 py-1 rounded font-medium">
                                  {pagiStatus === 'TIDAK_DIGUNAKAN' ? '⚪ Off di Sif Pagi' : pagiStatusInfo.label}
                                </span>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleQuickToggleActiveForShift(m, 'PAGI')}
                                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 px-2 py-1 bg-white hover:bg-emerald-50 rounded border border-emerald-200 transition-colors"
                                  >
                                    Aktifkan
                                  </button>
                                )}
                              </div>
                            ) : pagiAssigned ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                    {pagiAssigned.nurseName.charAt(0)}
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-slate-900 text-xs block">
                                      {pagiAssigned.nurseName}
                                    </span>
                                    {pagiAssigned.isLeader && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">
                                        KATIM
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isAdmin && (
                                  <button
                                    onClick={() =>
                                      setAssigningState({
                                        machine: m,
                                        targetShift: 'PAGI',
                                      })
                                    }
                                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 px-2 py-1 bg-white hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                                  >
                                    Ubah
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-amber-800 bg-amber-100 px-2 py-1 rounded">
                                  Belum Ada PJ
                                </span>
                                {isAdmin && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleQuickToggleActiveForShift(m, 'PAGI')}
                                      className="text-[10px] font-bold text-slate-600 hover:text-slate-800 px-1.5 py-1 bg-white border border-slate-200 rounded"
                                      title="Nonaktifkan hanya di Sif Pagi"
                                    >
                                      Off
                                    </button>
                                    <button
                                      onClick={() =>
                                        setAssigningState({
                                          machine: m,
                                          targetShift: 'PAGI',
                                        })
                                      }
                                      className="text-[10px] font-black px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                    >
                                      Tugaskan
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Sif Siang Column */}
                          <td className="py-3 px-4 bg-amber-50/30 border-r border-amber-100 align-top">
                            {!isSiangActive ? (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 italic bg-slate-100 px-2 py-1 rounded font-medium">
                                  {siangStatus === 'TIDAK_DIGUNAKAN' ? '⚪ Off di Sif Siang' : siangStatusInfo.label}
                                </span>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleQuickToggleActiveForShift(m, 'SIANG')}
                                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 px-2 py-1 bg-white hover:bg-emerald-50 rounded border border-emerald-200 transition-colors"
                                  >
                                    Aktifkan
                                  </button>
                                )}
                              </div>
                            ) : siangAssigned ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md bg-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                    {siangAssigned.nurseName.charAt(0)}
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-slate-900 text-xs block">
                                      {siangAssigned.nurseName}
                                    </span>
                                    {siangAssigned.isLeader && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">
                                        KATIM
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isAdmin && (
                                  <button
                                    onClick={() =>
                                      setAssigningState({
                                        machine: m,
                                        targetShift: 'SIANG',
                                      })
                                    }
                                    className="text-[10px] font-bold text-amber-800 hover:text-amber-950 px-2 py-1 bg-white hover:bg-amber-100 rounded border border-amber-200 transition-colors"
                                  >
                                    Ubah
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-amber-800 bg-amber-100 px-2 py-1 rounded">
                                  Belum Ada PJ
                                </span>
                                {isAdmin && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleQuickToggleActiveForShift(m, 'SIANG')}
                                      className="text-[10px] font-bold text-slate-600 hover:text-slate-800 px-1.5 py-1 bg-white border border-slate-200 rounded"
                                      title="Nonaktifkan hanya di Sif Siang"
                                    >
                                      Off
                                    </button>
                                    <button
                                      onClick={() =>
                                        setAssigningState({
                                          machine: m,
                                          targetShift: 'SIANG',
                                        })
                                      }
                                      className="text-[10px] font-black px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                                    >
                                      Tugaskan
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Split Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMachines.map((m) => {
                const pagiAssigned =
                  pagiMachineNurseMap.get(m.id) ||
                  (m.code ? pagiMachineNurseMap.get(m.code.toUpperCase()) : undefined);
                const siangAssigned =
                  siangMachineNurseMap.get(m.id) ||
                  (m.code ? siangMachineNurseMap.get(m.code.toUpperCase()) : undefined);

                const pagiStatus = getMachineStatusForShift(m, 'PAGI');
                const siangStatus = getMachineStatusForShift(m, 'SIANG');
                const isPagiActive = pagiStatus === 'AKTIF';
                const isSiangActive = siangStatus === 'AKTIF';

                return (
                  <div key={m.id} className="bg-white rounded-2xl border-2 border-slate-300 p-3.5 shadow-xs flex flex-col justify-between">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-base">{m.code}</span>
                        <span className="text-xs font-extrabold text-slate-700">{m.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {m.bay}
                      </span>
                    </div>

                    {/* Split Columns */}
                    <div className="grid grid-cols-2 gap-2 my-3">
                      {/* Pagi */}
                      <div
                        className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                          isPagiActive ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200 opacity-80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1 text-sky-800 font-black text-[11px]">
                              <Sun className="w-3 h-3 text-amber-500" />
                              <span>Sif Pagi</span>
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                isPagiActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isPagiActive ? 'Aktif' : 'Off'}
                            </span>
                          </div>
                          {pagiAssigned ? (
                            <div>
                              <span className="font-extrabold text-slate-900 text-xs block truncate">
                                {pagiAssigned.nurseName}
                              </span>
                              {pagiAssigned.isLeader && (
                                <span className="text-[9px] font-bold text-indigo-700">KATIM</span>
                              )}
                            </div>
                          ) : isPagiActive ? (
                            <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              Belum Ada PJ
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">
                              {pagiStatus === 'TIDAK_DIGUNAKAN' ? 'Off Sif Pagi' : 'Non-Aktif'}
                            </span>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="mt-2 flex items-center gap-1">
                            <button
                              onClick={() => handleQuickToggleActiveForShift(m, 'PAGI')}
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                isPagiActive
                                  ? 'bg-white text-slate-600 hover:text-slate-900 border-slate-200'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600'
                              }`}
                            >
                              {isPagiActive ? 'Set Off' : 'Aktifkan'}
                            </button>
                            {isPagiActive && (
                              <button
                                onClick={() =>
                                  setAssigningState({
                                    machine: m,
                                    targetShift: 'PAGI',
                                  })
                                }
                                className="text-[9px] font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 rounded px-1.5 py-0.5 transition-colors flex-1"
                              >
                                {pagiAssigned ? 'Ganti' : 'Tugaskan'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Siang */}
                      <div
                        className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                          isSiangActive ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1 text-amber-900 font-black text-[11px]">
                              <Sunset className="w-3 h-3 text-amber-600" />
                              <span>Sif Siang</span>
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                isSiangActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isSiangActive ? 'Aktif' : 'Off'}
                            </span>
                          </div>
                          {siangAssigned ? (
                            <div>
                              <span className="font-extrabold text-slate-900 text-xs block truncate">
                                {siangAssigned.nurseName}
                              </span>
                              {siangAssigned.isLeader && (
                                <span className="text-[9px] font-bold text-indigo-700">KATIM</span>
                              )}
                            </div>
                          ) : isSiangActive ? (
                            <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              Belum Ada PJ
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">
                              {siangStatus === 'TIDAK_DIGUNAKAN' ? 'Off Sif Siang' : 'Non-Aktif'}
                            </span>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="mt-2 flex items-center gap-1">
                            <button
                              onClick={() => handleQuickToggleActiveForShift(m, 'SIANG')}
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                isSiangActive
                                  ? 'bg-white text-slate-600 hover:text-slate-900 border-slate-200'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600'
                              }`}
                            >
                              {isSiangActive ? 'Set Off' : 'Aktifkan'}
                            </button>
                            {isSiangActive && (
                              <button
                                onClick={() =>
                                  setAssigningState({
                                    machine: m,
                                    targetShift: 'SIANG',
                                  })
                                }
                                className="text-[9px] font-bold text-amber-800 hover:text-amber-950 bg-white border border-amber-200 rounded px-1.5 py-0.5 transition-colors flex-1"
                              >
                                {siangAssigned ? 'Ganti' : 'Tugaskan'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DIRECT ASSIGN MODAL (PAGI ATAU SIANG) */}
      {assigningState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-300 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                  Tugaskan Mesin {assigningState.machine.code} ({assigningState.machine.name})
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-600 font-medium">
                    Penugasan untuk {selectedDate}:
                  </span>
                  {/* Shift Picker Inside Modal */}
                  <div className="inline-flex items-center bg-slate-200 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      onClick={() =>
                        setAssigningState({
                          ...assigningState,
                          targetShift: 'PAGI',
                        })
                      }
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        assigningState.targetShift === 'PAGI'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      Sif Pagi
                    </button>
                    <button
                      onClick={() =>
                        setAssigningState({
                          ...assigningState,
                          targetShift: 'SIANG',
                        })
                      }
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        assigningState.targetShift === 'SIANG'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      Sif Siang
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAssigningState(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            {/* If assigning ISOLASI machine, show reminder banner */}
            {assigningState.machine.category === 'ISOLASI' && (
              <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-900 flex items-center gap-2 font-semibold">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Mesin Isolasi wajib ditugaskan ke perawat dengan Tugas Khusus CITO.</span>
              </div>
            )}

            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {(assigningState.targetShift === 'PAGI' ? pagiNurses : siangNurses).length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Tidak ada perawat dinas pada Sif {assigningState.targetShift === 'PAGI' ? 'Pagi' : 'Siang'}. Silakan tentukan dinas perawat di menu Jadwal Harian terlebih dahulu.
                </div>
              ) : (
                (assigningState.targetShift === 'PAGI' ? pagiNurses : siangNurses).map((assignment) => {
                  const currentCount = assignment.assignedMachineIds.length;
                  const isCurrentHolder = assignment.assignedMachineIds.includes(assigningState.machine.id);
                  const isCitoNurse = (assignment.specialDuty || '').toUpperCase().includes('CITO');

                  return (
                    <button
                      key={assignment.id}
                      onClick={() => handleManualAssign(assignment.id, assigningState.machine.id, assigningState.targetShift)}
                      className={`w-full text-left p-3 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer ${
                        isCurrentHolder
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                          : assigningState.machine.category === 'ISOLASI' && isCitoNurse
                          ? 'bg-rose-50/60 border-rose-300 hover:bg-rose-100/60'
                          : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center text-white ${
                            isCitoNurse
                              ? 'bg-rose-600'
                              : assigningState.targetShift === 'SIANG'
                              ? 'bg-amber-600'
                              : 'bg-blue-600'
                          }`}
                        >
                          {assignment.nurseName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                            {assignment.nurseName}
                            {assignment.isLeader && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">
                                KATIM
                              </span>
                            )}
                            {isCitoNurse && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded border border-rose-300">
                                CITO
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-600 font-medium">
                            Memegang {currentCount} mesin pada Sif {assigningState.targetShift === 'PAGI' ? 'Pagi' : 'Siang'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {isCurrentHolder ? (
                          <span className="text-xs font-black text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md border border-blue-300">
                            Penanggung Jawab
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 hover:bg-blue-600 hover:text-white transition-colors">
                            Pilih
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-300 flex items-center justify-end gap-2">
              <button
                onClick={() => setAssigningState(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Machine Add/Edit Modal */}
      <MachineModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMachine(null);
          setModalDefaultBay(undefined);
        }}
        onSave={handleSaveMachine}
        onDelete={(m) => setMachineToDelete(m)}
        machine={editingMachine}
        defaultBay={modalDefaultBay}
        defaultOperationalShift={modalDefaultShift}
      />

      {/* Reallocate Machines Modal */}
      {isReallocateModalOpen && (
        <RegenerateMachineAllocationModal
          isOpen={isReallocateModalOpen}
          onClose={() => setIsReallocateModalOpen(false)}
          defaultScope="DAILY"
          defaultShift={reallocateTargetShift}
        />
      )}

      {/* WhatsApp Broadcast Modal */}
      {isBroadcastModalOpen && (
        <WhatsAppBroadcastModal
          isOpen={isBroadcastModalOpen}
          onClose={() => setIsBroadcastModalOpen(false)}
          initialShiftFilter={broadcastInitialShift}
        />
      )}

      {/* Delete Machine Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!machineToDelete}
        onClose={() => setMachineToDelete(null)}
        onConfirm={() => {
          if (machineToDelete) {
            deleteMachine(machineToDelete.id);
            setMachineToDelete(null);
          }
        }}
        title="Hapus Mesin Dialisis"
        message={`Apakah Anda yakin ingin menghapus Mesin ${machineToDelete?.code || ''} (${machineToDelete?.name || ''}) dari ${machineToDelete?.bay || ''}? Mesin ini akan dihapus dari denah dan jadwal penugasan perawat.`}
        itemName={machineToDelete ? `${machineToDelete.code} - ${machineToDelete.name} (${machineToDelete.bay})` : undefined}
        confirmButtonText="Hapus Mesin"
        note="⚠️ Catatan: Mesin ini akan dihapus dari denah ruangan dan seluruh alokasi sif. Anda dapat memulihkan seluruh 30 mesin HD kapan saja melalui tombol 'Pulihkan 30 Mesin'."
      />

      {/* Manage Bay Modal */}
      <ManageBayModal
        isOpen={isBayModalOpen}
        onClose={() => {
          setIsBayModalOpen(false);
          setSelectedBayToManage(undefined);
        }}
        initialBayName={selectedBayToManage}
      />
    </div>
  );
};

// Extracted Sub-Component: MachineCard with High Contrast & Clear Indicators
interface MachineCardProps {
  machine: Machine;
  activeShiftView: 'PAGI' | 'SIANG';
  machineNurseMap: Map<number | string, { nurseName: string; isLeader: boolean; nurseId: number; specialDuty?: string | null }>;
  isMasterMode?: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onQuickToggleActive?: () => void;
  onDelete: () => void;
  onAssign: () => void;
}

const MachineCard: React.FC<MachineCardProps> = ({
  machine,
  activeShiftView,
  machineNurseMap,
  isMasterMode = false,
  isAdmin,
  onEdit,
  onToggleStatus,
  onQuickToggleActive,
  onDelete,
  onAssign,
}) => {
  const assigned =
    machineNurseMap.get(machine.id) ||
    machineNurseMap.get(String(machine.id)) ||
    (machine.code
      ? machineNurseMap.get(machine.code.toUpperCase()) || machineNurseMap.get(machine.code.toLowerCase())
      : undefined);

  const catInfo = MACHINE_CATEGORY_INFO[machine.category];
  const shiftInfo = MACHINE_OPERATIONAL_SHIFT_INFO[machine.operationalShift || 'ALL'];

  const pagiStatus = getMachineStatusForShift(machine, 'PAGI');
  const siangStatus = getMachineStatusForShift(machine, 'SIANG');

  const effectiveStatus = isMasterMode
    ? machine.status
    : activeShiftView === 'SIANG'
    ? siangStatus
    : pagiStatus;

  const otherShift = activeShiftView === 'PAGI' ? 'SIANG' : 'PAGI';
  const otherStatus = otherShift === 'PAGI' ? pagiStatus : siangStatus;

  const statusInfo = MACHINE_STATUS_INFO[effectiveStatus];
  const otherStatusInfo = MACHINE_STATUS_INFO[otherStatus];
  const isOperational = effectiveStatus === 'AKTIF';

  const isIsolation = machine.category === 'ISOLASI';
  const isHepB = machine.category === 'HEPATITIS_B';
  const isHepC = machine.category === 'HEPATITIS_C';

  return (
    <div
      className={`rounded-2xl p-4 border-2 transition-all relative flex flex-col justify-between shadow-xs ${
        !isOperational
          ? 'bg-slate-100/90 border-slate-300 opacity-85'
          : isIsolation
          ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-400/20'
          : assigned
          ? activeShiftView === 'SIANG'
            ? 'bg-white border-amber-300 ring-1 ring-amber-500/10'
            : 'bg-white border-blue-300 ring-1 ring-blue-500/10'
          : 'bg-white border-amber-300 ring-1 ring-amber-400/30'
      }`}
    >
      <div>
        {/* Machine Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* High-Visibility Machine Number Badge */}
            <div
              className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-black shadow-xs shrink-0 ${
                isIsolation
                  ? 'bg-rose-600 text-white'
                  : isHepB
                  ? 'bg-purple-600 text-white'
                  : isHepC
                  ? 'bg-pink-600 text-white'
                  : activeShiftView === 'SIANG'
                  ? 'bg-amber-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider opacity-90 leading-none">BED</span>
              <span className="text-base leading-none mt-0.5">
                {machine.code.replace('M-', '')}
              </span>
            </div>

            <div className="min-w-0">
              <h4 className="font-black text-slate-900 text-sm truncate flex items-center gap-1">
                {machine.name}
                {isIsolation && <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
              </h4>
              <p className="text-[11px] text-slate-600 font-semibold truncate max-w-[130px]">
                {machine.brandModel || 'Fresenius 4008S'}
              </p>
            </div>
          </div>

          {/* Admin Controls */}
          {isAdmin && (
            <div className="flex items-center gap-0.5 shrink-0 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {onQuickToggleActive && !isMasterMode && (
                <button
                  onClick={onQuickToggleActive}
                  className={`p-1.5 rounded-md transition-colors ${
                    isOperational
                      ? 'text-slate-600 hover:text-rose-600 hover:bg-white'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                  title={
                    isOperational
                      ? `Non-aktifkan di Sif ${activeShiftView === 'PAGI' ? 'Pagi' : 'Siang'}`
                      : `Aktifkan di Sif ${activeShiftView === 'PAGI' ? 'Pagi' : 'Siang'}`
                  }
                >
                  <PowerOff className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={onEdit}
                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-white rounded-md transition-colors"
                title="Edit Mesin"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onToggleStatus}
                className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-white rounded-md transition-colors"
                title={`Ganti Status Mesin ${!isMasterMode ? `(Sif ${activeShiftView === 'PAGI' ? 'Pagi' : 'Siang'})` : ''}`}
              >
                <Wrench className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-white rounded-md transition-colors"
                title="Hapus Mesin HD"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Badges: Bay, Category, Status, Shift */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-bold">
            {machine.bay}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold ${catInfo.badgeClass}`}>
            {catInfo.label}
          </span>

          {/* Primary Status Badge */}
          <span
            className={`text-[10px] px-2 py-0.5 rounded-md border font-extrabold inline-flex items-center gap-1 ${statusInfo.colorClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
            {!isMasterMode ? (
              effectiveStatus === 'TIDAK_DIGUNAKAN' ? (
                `Off Sif ${activeShiftView === 'PAGI' ? 'Pagi' : 'Siang'}`
              ) : (
                statusInfo.label
              )
            ) : (
              statusInfo.label
            )}
          </span>

          {/* Secondary Badge showing other shift status if different */}
          {!isMasterMode && otherStatus !== effectiveStatus && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold ${
                otherStatus === 'AKTIF'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title={`Status di Sif ${otherShift === 'PAGI' ? 'Pagi' : 'Siang'}: ${otherStatusInfo.label}`}
            >
              {otherShift === 'PAGI' ? 'Pagi' : 'Siang'}: {otherStatus === 'AKTIF' ? 'Aktif' : 'Off'}
            </span>
          )}

          {machine.operationalShift && machine.operationalShift !== 'ALL' && isMasterMode && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-extrabold ${shiftInfo.badgeClass}`}>
              {shiftInfo.shortLabel}
            </span>
          )}
        </div>

        {/* Isolation rule indicator banner */}
        {isIsolation && (
          <div className="mt-2.5 px-2.5 py-1 bg-rose-100 text-rose-900 rounded-lg border border-rose-300 text-[10px] font-black flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>ZONA ISOLASI • WAJIB CITO</span>
          </div>
        )}

        {machine.notes && (
          <p className="mt-2 text-[11px] text-slate-600 bg-slate-100 p-1.5 rounded-lg border border-slate-200 italic font-medium">
            "{machine.notes}"
          </p>
        )}
      </div>

      {/* PJ Perawat Footer (Hanya tampil di Sif Pagi atau Sif Siang) */}
      {!isMasterMode && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <span className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider block mb-1">
            PJ Perawat (Sif {activeShiftView === 'PAGI' ? 'Pagi' : 'Siang'}):
          </span>

          {assigned ? (
            <div
              className={`flex items-center justify-between p-2 rounded-xl border ${
                activeShiftView === 'SIANG'
                  ? 'bg-amber-50/80 border-amber-300'
                  : 'bg-blue-50/80 border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 ${
                    activeShiftView === 'SIANG' ? 'bg-amber-600' : 'bg-blue-600'
                  }`}
                >
                  {assigned.nurseName.charAt(0)}
                </div>
                <div className="truncate">
                  <span className="font-extrabold text-xs text-slate-900 block truncate">
                    {assigned.nurseName}
                  </span>
                  {assigned.specialDuty && (
                    <span className="text-[9px] text-blue-700 font-bold block truncate">
                      Tugas: {assigned.specialDuty}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-1">
                {assigned.isLeader && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-100 text-indigo-900 rounded border border-indigo-300">
                    KATIM
                  </span>
                )}
                {isAdmin && (
                  <button
                    onClick={onAssign}
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-extrabold px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors"
                    title="Pindahkan alokasi mesin"
                  >
                    Ubah
                  </button>
                )}
              </div>
            </div>
          ) : isOperational ? (
            <div className="flex items-center justify-between bg-amber-50 text-amber-950 p-2 rounded-xl text-xs border border-amber-300">
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-[11px] font-black">Belum Ada PJ</span>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  {onQuickToggleActive && (
                    <button
                      onClick={onQuickToggleActive}
                      className="text-[10px] font-bold px-1.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-amber-200 rounded transition-colors"
                      title="Set mesin tidak digunakan untuk sif ini"
                    >
                      Off Sif
                    </button>
                  )}
                  <button
                    onClick={onAssign}
                    className="text-[10px] font-black px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-2xs transition-colors cursor-pointer"
                    title="Tugaskan perawat untuk mesin ini"
                  >
                    Tugaskan
                  </button>
                </div>
              )}
            </div>
          ) : effectiveStatus === 'TIDAK_DIGUNAKAN' ? (
            <div className="bg-slate-100 text-slate-700 p-2 rounded-xl text-xs flex items-center justify-between border border-slate-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <PowerOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-[11px]">Tidak Digunakan (Sif {activeShiftView === 'PAGI' ? 'Pagi' : 'Siang'})</span>
              </div>
              {isAdmin && onQuickToggleActive && (
                <button
                  onClick={onQuickToggleActive}
                  className="text-[10px] font-bold px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                  title="Aktifkan kembali mesin untuk sif ini"
                >
                  Aktifkan
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-200 text-slate-600 p-2 rounded-xl text-xs flex items-center gap-1.5 font-semibold">
              <PowerOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px]">Mesin Non-Aktif ({statusInfo.label})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
