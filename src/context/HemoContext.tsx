import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  Nurse,
  Machine,
  ShiftAssignment,
  AppSettings,
  FairnessReport,
  ShiftType,
  MachineStatus,
  MachineCategory,
  Doctor,
  DoctorShiftDuty,
  parseSpecialDuties,
  formatSpecialDuties,
} from '../types';
import { INITIAL_MACHINES, SAMPLE_NURSES, LEGACY_SAMPLE_NURSE_NAMES, INITIAL_SETTINGS, INITIAL_DOCTORS, LEGACY_SAMPLE_DOCTOR_NAMES } from '../data/initialData';
import { FairSchedulerEngine } from '../domain/FairSchedulerEngine';
import { WhatsAppDispatcher } from '../domain/WhatsAppDispatcher';
import { GoogleSheetsService } from '../domain/GoogleSheetsService';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDoc,
  getDocsFromServer,
  getDocFromServer,
} from 'firebase/firestore';

export interface HemoContextType {
  isAdmin: boolean;
  nurses: Nurse[];
  machines: Machine[];
  assignments: ShiftAssignment[];
  settings: AppSettings;
  selectedDate: string;
  selectedYear: number;
  selectedMonth: number;
  currentMonth: string;
  setCurrentMonth: (monthStr: string) => void;
  dailyAssignments: ShiftAssignment[];
  monthlyAssignments: ShiftAssignment[];
  fairnessReport: FairnessReport | null;
  isGenerating: boolean;
  isSyncing: boolean;
  isCloudConnected: boolean;
  isCloudLoaded: boolean;
  syncAllDataToCloud: () => Promise<boolean>;
  fetchDataFromCloud: () => Promise<{ success: boolean; nurses: number; machines: number; assignments: number }>;
  toastMessage: string | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  selectDate: (date: string) => void;
  selectMonth: (year: number, month: number) => void;
  setShift: (date: string, nurseId: number, shiftType: ShiftType) => void;
  generateSchedule: (force?: boolean) => void;
  generateMonthlySchedule: (monthStr?: string) => void;
  generateDailyMachineAllocation: (date?: string) => void;
  reallocateMachinesForDate: (
    date?: string,
    options?: {
      rotateBays?: boolean;
      leaderLighterLoad?: boolean;
      consecutiveIsolationProtection?: boolean;
      shuffleNurses?: boolean;
      targetShift?: 'ALL' | 'PAGI' | 'SIANG';
    }
  ) => void;
  reallocateMachinesForMonth: (
    monthStr?: string,
    options?: {
      rotateBays?: boolean;
      leaderLighterLoad?: boolean;
      consecutiveIsolationProtection?: boolean;
      shuffleNurses?: boolean;
      targetShift?: 'ALL' | 'PAGI' | 'SIANG';
    }
  ) => void;
  importScheduleAssignments: (
    importedAssignments: ShiftAssignment[],
    targetMonth: string,
    replaceExisting?: boolean,
    newNurses?: Nurse[]
  ) => void;
  updateAssignment: (
    assignment: ShiftAssignment,
    newShiftType: ShiftType,
    newMachines: number[],
    isLeader: boolean,
    notes: string,
    specialDuty?: string | null
  ) => void;
  addNurse: (nurse: Omit<Nurse, 'id'> | Nurse) => void;
  updateNurse: (nurse: Nurse) => void;
  addOrUpdateNurse: (nurse: Partial<Nurse> & { name: string; phone: string }) => void;
  deleteNurse: (id: number) => void;
  deleteNursePermanent: (id: number) => void;
  deleteAllNursesPermanent: () => void;
  clearAllNurses: () => void;
  clearDefaultNurses: () => void;
  loadSampleNurses: () => void;
  bays: string[];
  addBay: (
    name: string,
    category?: MachineCategory,
    status?: MachineStatus,
    machineIds?: number[]
  ) => void;
  deleteBay: (bayName: string, fallbackBayParam?: string) => void;
  addMachine: (machine: Omit<Machine, 'id'> | Machine) => void;
  updateMachine: (machine: Machine) => void;
  addOrUpdateMachine: (machine: Partial<Machine> & { name: string; code: string; bay: string }) => void;
  updateBay: (
    oldBayName: string,
    newBayName: string,
    newCategory?: MachineCategory,
    newStatus?: MachineStatus,
    applyCategoryToAll?: boolean,
    applyStatusToAll?: boolean
  ) => void;
  deleteMachine: (id: number) => void;
  loadDefaultMachines: () => void;
  toggleMachineStatus: (id: number) => void;
  setMachineStatus: (id: number, newStatus: MachineStatus, reason?: string) => void;
  setAllMachinesActive: () => void;
  updateSettings: (newSettings: AppSettings) => void;
  markAssignmentWhatsAppSent: (assignmentId: string, phone?: string) => void;
  dispatchWhatsAppToNurse: (assignment: ShiftAssignment) => void;
  dispatchGroupBroadcast: (shiftType: 'PAGI' | 'SIANG' | null) => void;
  dispatchHeadNurseReport: (
    headNursePhone?: string,
    headNurseName?: string,
    directWhatsApp?: boolean
  ) => void;
  syncToGoogleSheets: () => Promise<void>;
  syncWithGoogleSheets: () => Promise<boolean>;
  syncAllToGoogleSheets: (customUrl?: string) => Promise<{ success: boolean; message: string }>;
  fetchDataFromGoogleSheets: (customUrl?: string) => Promise<{ success: boolean; message: string; nurses: number; machines: number; assignments: number }>;
  downloadCsv: () => void;
  copyTable: () => Promise<void>;
  resetToInitialData: () => void;
  doctors: Doctor[];
  doctorDuties: Record<string, DoctorShiftDuty>;
  addDoctor: (doctor: Omit<Doctor, 'id'> | Doctor) => void;
  updateDoctor: (doctor: Doctor) => void;
  deleteDoctor: (id: number) => void;
  clearDefaultDoctors: () => void;
  clearAllDoctors: () => void;
  setDoctorDuty: (date: string, pagiDoctorId?: number | null, siangDoctorId?: number | null, notes?: string) => void;
  getDoctorDutyForDate: (date: string) => DoctorShiftDuty | undefined;
  dispatchDoctorWhatsApp: (doctor: Doctor, shiftType: 'PAGI' | 'SIANG', dateStr?: string) => void;
}

const HemoContext = createContext<HemoContextType | undefined>(undefined);

export const HemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { canManageRoster, isKaru, isAdmin: isSystemAdmin } = useAuth();

  const checkKaruPermission = (actionName: string = 'melakukan tindakan ini'): boolean => {
    if (!canManageRoster) {
      showToast(
        `Akses Ditolak: Hanya Kepala Ruangan (Karu) atau Administrator yang berwenang untuk ${actionName}.`,
        'error'
      );
      return false;
    }
    return true;
  };

  const today = new Date();
  const initialDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const initialMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [selectedDate, setSelectedDate] = useState<string>(initialDateStr);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [currentMonth, setCurrentMonthState] = useState<string>(initialMonthStr);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState<boolean>(false);

  // Local storage state with initial fallbacks - user-inputted nurses are permanently locked
  const [nurses, setNurses] = useState<Nurse[]>(() => {
    const deletedIds = new Set<number>(
      JSON.parse(localStorage.getItem('hemo_deleted_nurse_ids') || '[]')
    );
    const permanentSaved = localStorage.getItem('hemo_permanent_nurses_v1');
    const normalSaved = localStorage.getItem('hemo_nurses_v1');

    let baseList: Nurse[] = [];
    if (permanentSaved) {
      try {
        const parsed = JSON.parse(permanentSaved) as Nurse[];
        if (Array.isArray(parsed) && parsed.length > 0) baseList = parsed;
      } catch {}
    }
    if (normalSaved && baseList.length === 0) {
      try {
        const parsed = JSON.parse(normalSaved) as Nurse[];
        if (Array.isArray(parsed)) baseList = parsed;
      } catch {}
    }
    const userOnly = baseList
      .filter((n) => !LEGACY_SAMPLE_NURSE_NAMES.has(n.name) && !deletedIds.has(n.id))
      .map((n) => ({ ...n, isPermanent: true }));
    return userOnly;
  });

  const DEFAULT_BAYS = [
    'Bay A (Reguler)',
    'Bay B (Reguler)',
    'Bay C (Depan)',
    'Bay C (Khusus & Isolasi)',
  ];

  const [bays, setBays] = useState<string[]>(() => {
    const deletedBays = new Set<string>(
      JSON.parse(localStorage.getItem('hemo_deleted_bays_v1') || '[]').map((b: string) => b.trim().toLowerCase())
    );
    const saved = localStorage.getItem('hemo_custom_bays_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed
            .map((b: string) => (typeof b === 'string' ? b.trim() : ''))
            .filter((b: string) => Boolean(b) && !deletedBays.has(b.toLowerCase()));
          if (filtered.length > 0) return Array.from(new Set(filtered));
        }
      } catch {}
    }
    return DEFAULT_BAYS.filter((b) => !deletedBays.has(b.trim().toLowerCase()));
  });

  const [machines, setMachines] = useState<Machine[]>(() => {
    const saved = localStorage.getItem('hemo_machines_v1');
    const deletedIds = new Set<number>(
      JSON.parse(localStorage.getItem('hemo_deleted_machine_ids') || '[]')
    );
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Machine[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Auto-upgrade legacy default 25 machines (M-01..M-25) to the room sequence (A01-A12, C01-C04, B01-B09, C05-C09)
          if (parsed.length === 25 && parsed[0]?.code === 'M-01') {
            return INITIAL_MACHINES;
          }
          // Ensure any standard machine (e.g. C05-C09) not explicitly deleted is included
          const existingIds = new Set(parsed.map((m) => m.id));
          const existingCodes = new Set(parsed.map((m) => m.code?.toUpperCase()));
          const missing = INITIAL_MACHINES.filter(
            (m) => !deletedIds.has(m.id) && !existingIds.has(m.id) && !existingCodes.has(m.code?.toUpperCase())
          );
          if (missing.length > 0) {
            return [...parsed, ...missing];
          }
          return parsed;
        }
      } catch {
        return INITIAL_MACHINES;
      }
    }
    return INITIAL_MACHINES;
  });

  const [assignments, setAssignments] = useState<ShiftAssignment[]>(() => {
    const saved = localStorage.getItem('hemo_assignments_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ShiftAssignment[];
        if (Array.isArray(parsed)) {
          return parsed.filter((a) => !LEGACY_SAMPLE_NURSE_NAMES.has(a.nurseName));
        }
      } catch {
        return [];
      }
    }
    return [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('hemo_settings_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_SETTINGS;
      }
    }
    return INITIAL_SETTINGS;
  });

  const [doctors, setDoctors] = useState<Doctor[]>(() => {
    const deletedDoctorIds = new Set<number>(
      JSON.parse(localStorage.getItem('hemo_deleted_doctor_ids') || '[]')
    );
    const saved = localStorage.getItem('hemo_doctors_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const userOnly = parsed.filter(
            (d: Doctor) => d && d.name && !LEGACY_SAMPLE_DOCTOR_NAMES.has(d.name) && !deletedDoctorIds.has(d.id)
          );
          return userOnly;
        }
      } catch {
        return [];
      }
    }
    return [];
  });

  const [doctorDuties, setDoctorDuties] = useState<Record<string, DoctorShiftDuty>>(() => {
    const saved = localStorage.getItem('hemo_doctor_duties_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const cleaned: Record<string, DoctorShiftDuty> = {};
          Object.entries(parsed).forEach(([date, duty]) => {
            const d = duty as DoctorShiftDuty;
            const pagiLegacy = d.pagiDoctorName && LEGACY_SAMPLE_DOCTOR_NAMES.has(d.pagiDoctorName);
            const siangLegacy = d.siangDoctorName && LEGACY_SAMPLE_DOCTOR_NAMES.has(d.siangDoctorName);
            cleaned[date] = {
              ...d,
              pagiDoctorId: pagiLegacy ? null : d.pagiDoctorId,
              pagiDoctorName: pagiLegacy ? undefined : d.pagiDoctorName,
              siangDoctorId: siangLegacy ? null : d.siangDoctorId,
              siangDoctorName: siangLegacy ? undefined : d.siangDoctorName,
            };
          });
          return cleaned;
        }
      } catch {
        return {};
      }
    }
    return {};
  });

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isInitialCloudLoad = useRef(true);

  const showToast = (msg: string, _type?: 'success' | 'error' | 'info') => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const clearToast = () => setToastMessage(null);

  // Auto-persist changes to localStorage
  useEffect(() => {
    localStorage.setItem('hemo_nurses_v1', JSON.stringify(nurses));
    if (nurses.length > 0) {
      localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(nurses));
    }
  }, [nurses]);

  useEffect(() => {
    localStorage.setItem('hemo_machines_v1', JSON.stringify(machines));
    // Automatically include any machine bay in bays list EXCEPT if it's explicitly deleted
    const deletedBays = new Set<string>(
      JSON.parse(localStorage.getItem('hemo_deleted_bays_v1') || '[]').map((b: string) => b.trim().toLowerCase())
    );
    const machineBays = machines
      .map((m) => m.bay?.trim())
      .filter((b): b is string => Boolean(b) && !deletedBays.has(b.toLowerCase()));

    setBays((prev) => {
      const filteredPrev = prev.filter((b) => !deletedBays.has(b.trim().toLowerCase()));
      const combined = Array.from(new Set([...filteredPrev, ...machineBays]));
      if (combined.length !== prev.length || combined.some((b, i) => b !== prev[i])) {
        localStorage.setItem('hemo_custom_bays_v1', JSON.stringify(combined));
        return combined;
      }
      return prev;
    });
  }, [machines]);

  useEffect(() => {
    localStorage.setItem('hemo_custom_bays_v1', JSON.stringify(bays));
  }, [bays]);

  useEffect(() => {
    localStorage.setItem('hemo_assignments_v1', JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem('hemo_settings_v1', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('hemo_doctors_v1', JSON.stringify(doctors));
  }, [doctors]);

  useEffect(() => {
    localStorage.setItem('hemo_doctor_duties_v1', JSON.stringify(doctorDuties));
  }, [doctorDuties]);

  // Helper functions for cloud sync & data sanitization
  const sanitizeAssignmentForFirestore = (item: ShiftAssignment): ShiftAssignment => {
    return {
      id: item.id,
      date: item.date,
      shiftType: item.shiftType,
      nurseId: item.nurseId,
      nurseName: item.nurseName || '',
      nursePhone: item.nursePhone || '',
      assignedMachineIds: Array.isArray(item.assignedMachineIds) ? item.assignedMachineIds : [],
      isLeader: Boolean(item.isLeader),
      isWhatsAppSent: Boolean(item.isWhatsAppSent),
      notes: item.notes || '',
      specialDuty: item.specialDuty || null,
    };
  };

  const sanitizeMachineForFirestore = (machine: Machine): Machine => {
    return {
      id: machine.id,
      code: machine.code || '',
      name: machine.name || '',
      bay: machine.bay || 'Bay A (Reguler)',
      category: machine.category || 'REGULER',
      status: machine.status || 'AKTIF',
      brandModel: machine.brandModel || '',
      notes: machine.notes ?? '',
    };
  };

  const syncNurseToCloud = async (nurse: Nurse) => {
    try {
      const sanitizedNurse: Nurse = {
        ...nurse,
        nip: nurse.nip || '',
        phone: nurse.phone || '',
        specialDuty: nurse.specialDuty || null,
        defaultOffDay: nurse.defaultOffDay !== undefined ? nurse.defaultOffDay : null,
      };
      await setDoc(doc(db, 'nurses', String(nurse.id)), sanitizedNurse);
    } catch (e) {
      console.warn('Could not sync nurse to Firestore:', e);
    }
  };

  const syncAllNursesToCloud = async (nursesList: Nurse[]) => {
    try {
      for (let i = 0; i < nursesList.length; i += 400) {
        const chunk = nursesList.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((nurse) => {
          const sanitizedNurse: Nurse = {
            ...nurse,
            nip: nurse.nip || '',
            phone: nurse.phone || '',
            specialDuty: nurse.specialDuty || null,
            defaultOffDay: nurse.defaultOffDay !== undefined ? nurse.defaultOffDay : null,
          };
          batch.set(doc(db, 'nurses', String(nurse.id)), sanitizedNurse);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Could not sync all nurses to Firestore:', e);
    }
  };

  const syncMachineToCloud = async (machine: Machine) => {
    try {
      const sanitized = sanitizeMachineForFirestore(machine);
      await setDoc(doc(db, 'machines', String(machine.id)), sanitized);
    } catch (e) {
      console.warn('Could not sync machine to Firestore:', e);
    }
  };

  const syncAllMachinesToCloud = async (machinesList: Machine[]) => {
    try {
      for (let i = 0; i < machinesList.length; i += 400) {
        const chunk = machinesList.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((m) => {
          const sanitized = sanitizeMachineForFirestore(m);
          batch.set(doc(db, 'machines', String(m.id)), sanitized);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Could not sync all machines to Firestore:', e);
    }
  };

  const syncAssignmentToCloud = async (assignment: ShiftAssignment) => {
    try {
      const sanitized = sanitizeAssignmentForFirestore(assignment);
      await setDoc(doc(db, 'assignments', assignment.id), sanitized);
    } catch (e) {
      console.warn('Could not sync assignment to Firestore:', e);
    }
  };

  const syncBatchAssignmentsToCloud = async (newAssignments: ShiftAssignment[]) => {
    try {
      for (let i = 0; i < newAssignments.length; i += 400) {
        const chunk = newAssignments.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const sanitized = sanitizeAssignmentForFirestore(item);
          const ref = doc(db, 'assignments', item.id);
          batch.set(ref, sanitized);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Batch cloud sync error:', e);
    }
  };

  const syncDoctorToCloud = async (doctor: Doctor) => {
    try {
      await setDoc(doc(db, 'doctors', String(doctor.id)), doctor);
    } catch (e) {
      console.warn('Could not sync doctor to Firestore:', e);
    }
  };

  const syncAllDoctorsToCloud = async (doctorsList: Doctor[]) => {
    try {
      const batch = writeBatch(db);
      doctorsList.forEach((d) => {
        batch.set(doc(db, 'doctors', String(d.id)), d);
      });
      await batch.commit();
    } catch (e) {
      console.warn('Could not sync all doctors to Firestore:', e);
    }
  };

  const syncDoctorDutyToCloud = async (duty: DoctorShiftDuty) => {
    try {
      await setDoc(doc(db, 'doctor_duties', duty.date), duty);
    } catch (e) {
      console.warn('Could not sync doctor duty to Firestore:', e);
    }
  };

  // Firestore Real-Time Subscriptions
  useEffect(() => {
    let unsubNurses = () => {};
    let unsubMachines = () => {};
    let unsubAssignments = () => {};
    let unsubSettings = () => {};
    let unsubBays = () => {};
    let unsubDoctors = () => {};
    let unsubDoctorDuties = () => {};

    try {
      // 1. Listen to Nurses collection - user input is locked permanently, sample default nurses purged
      unsubNurses = onSnapshot(
        collection(db, 'nurses'),
        (snapshot) => {
          setIsCloudConnected(true);

          const deletedIds = new Set<number>(
            JSON.parse(localStorage.getItem('hemo_deleted_nurse_ids') || '[]')
          );
          const localPermanent: Nurse[] = JSON.parse(
            localStorage.getItem('hemo_permanent_nurses_v1') || '[]'
          );
          const localSaved: Nurse[] = JSON.parse(
            localStorage.getItem('hemo_nurses_v1') || '[]'
          );

          if (!snapshot.empty) {
            const cloudNurses = snapshot.docs.map((d) => d.data() as Nurse);

            // Clean up lingering default sample nurses & permanently deleted nurses in Firestore
            cloudNurses.forEach((n) => {
              if (LEGACY_SAMPLE_NURSE_NAMES.has(n.name) || deletedIds.has(n.id)) {
                deleteDoc(doc(db, 'nurses', String(n.id))).catch(() => {});
              }
            });

            // Filter out legacy sample names and deleted ids
            const validCloudNurses = cloudNurses.filter(
              (n) => !LEGACY_SAMPLE_NURSE_NAMES.has(n.name) && !deletedIds.has(n.id)
            );

            // Ensure any locally saved nurse not yet in cloud is preserved and uploaded to cloud
            const cloudIdSet = new Set(validCloudNurses.map((n) => n.id));
            const allLocalCandidates = [...localPermanent, ...localSaved];
            const missingFromCloudMap = new Map<number, Nurse>();
            allLocalCandidates.forEach((n) => {
              if (n && n.id && !cloudIdSet.has(n.id) && !deletedIds.has(n.id) && !LEGACY_SAMPLE_NURSE_NAMES.has(n.name)) {
                missingFromCloudMap.set(n.id, { ...n, isPermanent: true });
              }
            });
            const missingFromCloud = Array.from(missingFromCloudMap.values());
            if (missingFromCloud.length > 0) {
              syncAllNursesToCloud(missingFromCloud);
            }

            const merged = [...validCloudNurses, ...missingFromCloud];
            const uniqueMap = new Map<number, Nurse>();
            merged.forEach((n) => uniqueMap.set(n.id, { ...n, isPermanent: true }));
            const userOnly = Array.from(uniqueMap.values());
            userOnly.sort((a, b) => a.id - b.id);

            setNurses(userOnly);
            localStorage.setItem('hemo_nurses_v1', JSON.stringify(userOnly));
            localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(userOnly));
          } else {
            // Firestore empty: preserve user nurses from local storage and sync to Firestore
            const allLocalCandidates = [...localPermanent, ...localSaved];
            const uniqueMap = new Map<number, Nurse>();
            allLocalCandidates.forEach((n) => {
              if (n && n.id && !deletedIds.has(n.id) && !LEGACY_SAMPLE_NURSE_NAMES.has(n.name)) {
                uniqueMap.set(n.id, { ...n, isPermanent: true });
              }
            });
            const validLocal = Array.from(uniqueMap.values());
            if (validLocal.length > 0) {
              syncAllNursesToCloud(validLocal);
              setNurses(validLocal);
              localStorage.setItem('hemo_nurses_v1', JSON.stringify(validLocal));
              localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(validLocal));
            } else {
              setNurses((prev) => {
                const userOnly = (prev || []).filter(
                  (n) => !deletedIds.has(n.id) && !LEGACY_SAMPLE_NURSE_NAMES.has(n.name)
                );
                if (userOnly.length > 0) {
                  syncAllNursesToCloud(userOnly);
                }
                return userOnly;
              });
            }
          }
        },
        (err) => {
          console.warn('Firestore nurses listener error:', err);
        }
      );

      // 1b. Listen to custom Bays configuration in Firestore
      unsubBays = onSnapshot(
        doc(db, 'settings', 'bays'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (Array.isArray(data.list) && data.list.length > 0) {
              const deletedBays = new Set<string>(
                JSON.parse(localStorage.getItem('hemo_deleted_bays_v1') || '[]').map((b: string) => b.trim().toLowerCase())
              );
              const cloudBays = (data.list as string[])
                .map((b) => (typeof b === 'string' ? b.trim() : ''))
                .filter((b) => Boolean(b) && !deletedBays.has(b.toLowerCase()));
              if (cloudBays.length > 0) {
                const uniqueCloudBays = Array.from(new Set(cloudBays));
                setBays(uniqueCloudBays);
                localStorage.setItem('hemo_custom_bays_v1', JSON.stringify(uniqueCloudBays));
              }
            }
          }
        },
        (err) => {
          console.warn('Firestore bays listener error:', err);
        }
      );

      // 2. Listen to Machines collection with safe merging
      unsubMachines = onSnapshot(
        collection(db, 'machines'),
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudMachines = snapshot.docs.map((d) => d.data() as Machine);
            cloudMachines.sort((a, b) => a.id - b.id);

            setMachines((prev) => {
              const deletedIds = new Set<number>(
                JSON.parse(localStorage.getItem('hemo_deleted_machine_ids') || '[]')
              );
              const healthyPrev = prev.length >= 25 ? prev : INITIAL_MACHINES;
              const baseList = healthyPrev.filter((m) => !deletedIds.has(m.id));
              const cloudMap = new Map(cloudMachines.map((m) => [m.id, m]));

              // Merge cloud updates into baseList (ensures notes/status updates are applied while keeping all machines)
              const merged = baseList.map((m) => {
                const cloudM = cloudMap.get(m.id);
                if (cloudM) {
                  return {
                    ...m,
                    ...cloudM,
                    notes: cloudM.notes ?? '',
                  };
                }
                return m;
              });

              // Also retain any cloud machines that were created dynamically
              cloudMachines.forEach((cm) => {
                if (!deletedIds.has(cm.id) && !merged.some((m) => m.id === cm.id)) {
                  merged.push({
                    ...cm,
                    notes: cm.notes ?? '',
                  });
                }
              });

              // Check if any standard INITIAL_MACHINES (e.g. C05-C09) are missing
              const mergedIds = new Set(merged.map((m) => m.id));
              const mergedCodes = new Set(merged.map((m) => m.code?.toUpperCase()));
              const missingInitial = INITIAL_MACHINES.filter(
                (m) => !deletedIds.has(m.id) && !mergedIds.has(m.id) && !mergedCodes.has(m.code?.toUpperCase())
              );
              if (missingInitial.length > 0) {
                merged.push(...missingInitial);
              }

              merged.sort((a, b) => a.id - b.id);

              // CRITICAL: If Firestore is missing machines (e.g. only 20 or 25 machines),
              // immediately upload the full list so cloud has the complete dataset!
              if (cloudMachines.length < 30 && merged.length >= 30) {
                syncAllMachinesToCloud(merged);
              }

              return merged;
            });
          } else {
            // Collection is empty: seed full INITIAL_MACHINES into Firestore
            setMachines((prev) => {
              const list = prev.length >= 25 ? prev : INITIAL_MACHINES;
              syncAllMachinesToCloud(list);
              return list;
            });
          }
        },
        (err) => {
          console.warn('Firestore machines listener error:', err);
        }
      );

      // 3. Listen to Assignments collection
      unsubAssignments = onSnapshot(
        collection(db, 'assignments'),
        (snapshot) => {
          setIsCloudLoaded(true);
          const localSavedAssignments: ShiftAssignment[] = JSON.parse(
            localStorage.getItem('hemo_assignments_v1') || '[]'
          );

          if (!snapshot.empty) {
            const cloudAssignments = snapshot.docs.map((d) => d.data() as ShiftAssignment);

            // Clean up lingering default sample nurse assignments from Firestore
            cloudAssignments.forEach((ca) => {
              if (LEGACY_SAMPLE_NURSE_NAMES.has(ca.nurseName)) {
                deleteDoc(doc(db, 'assignments', ca.id)).catch(() => {});
              }
            });

            const validAssignments = cloudAssignments.filter(
              (ca) => !LEGACY_SAMPLE_NURSE_NAMES.has(ca.nurseName)
            );

            setAssignments((prev) => {
              const cloudIds = new Set(validAssignments.map((a) => a.id));
              const prevMap = new Map<string, ShiftAssignment>();
              prev.forEach((a) => prevMap.set(a.id, a));

              const mergedCloudAssignments = validAssignments.map((ca) => {
                return {
                  ...ca,
                  specialDuty: ca.specialDuty && ca.specialDuty.trim() !== '' ? ca.specialDuty.trim() : null,
                };
              });

              // CRITICAL: Keep any local assignments that have not been uploaded to cloud yet!
              const cloudDateNurseKeys = new Set(
                mergedCloudAssignments.map((a) => `${a.date}_${Number(a.nurseId)}`)
              );
              const allLocalCandidates = [...prev, ...localSavedAssignments];
              const missingInCloudMap = new Map<string, ShiftAssignment>();
              allLocalCandidates.forEach((a) => {
                if (a && a.id && !cloudIds.has(a.id) && !LEGACY_SAMPLE_NURSE_NAMES.has(a.nurseName)) {
                  const key = `${a.date}_${Number(a.nurseId)}`;
                  if (!cloudDateNurseKeys.has(key) && !missingInCloudMap.has(key)) {
                    missingInCloudMap.set(key, a);
                  }
                }
              });
              const missingInCloud = Array.from(missingInCloudMap.values());

              if (missingInCloud.length > 0) {
                // Upload missing assignments to Firestore batch so all devices get them!
                syncBatchAssignmentsToCloud(missingInCloud);
              }

              // Deduplicate combined strictly by (date, nurseId) to prevent duplicate assignments
              const finalMap = new Map<string, ShiftAssignment>();
              [...mergedCloudAssignments, ...missingInCloud].forEach((a) => {
                const key = `${a.date}_${Number(a.nurseId)}`;
                finalMap.set(key, a);
              });
              const combined = Array.from(finalMap.values());
              localStorage.setItem('hemo_assignments_v1', JSON.stringify(combined));
              return combined;
            });
          } else {
            // Cloud is empty. Check if local already has assignments to upload to cloud:
            setAssignments((prev) => {
              const allLocal = [...prev, ...localSavedAssignments].filter(
                (a) => a && a.id && !LEGACY_SAMPLE_NURSE_NAMES.has(a.nurseName)
              );
              const uniqueLocalMap = new Map<string, ShiftAssignment>();
              allLocal.forEach((a) => uniqueLocalMap.set(a.id, a));
              const validLocal = Array.from(uniqueLocalMap.values());

              if (validLocal.length > 0) {
                syncBatchAssignmentsToCloud(validLocal);
                localStorage.setItem('hemo_assignments_v1', JSON.stringify(validLocal));
                return validLocal;
              }

              // Only if both cloud and local are empty, generate an initial schedule and save to cloud:
              const activeN = nurses.filter((n) => n.isActive);
              if (activeN.length > 0) {
                const initSched = FairSchedulerEngine.generateMonthlySchedule(
                  selectedYear,
                  selectedMonth,
                  nurses,
                  machines
                );
                if (initSched.length > 0) {
                  syncBatchAssignmentsToCloud(initSched);
                  localStorage.setItem('hemo_assignments_v1', JSON.stringify(initSched));
                  return initSched;
                }
              }
              return [];
            });
          }
        },
        (err) => {
          console.warn('Firestore assignments listener error:', err);
          setIsCloudLoaded(true);
        }
      );

      // 4. Listen to Settings doc
      unsubSettings = onSnapshot(
        doc(db, 'settings', 'config'),
        (snapshot) => {
          if (snapshot.exists()) {
            setSettings(snapshot.data() as AppSettings);
          }
        },
        (err) => {
          console.warn('Firestore settings listener error:', err);
        }
      );

      // 5. Listen to Doctors collection
      unsubDoctors = onSnapshot(
        collection(db, 'doctors'),
        (snapshot) => {
          const deletedDoctorIds = new Set<number>(
            JSON.parse(localStorage.getItem('hemo_deleted_doctor_ids') || '[]')
          );
          if (!snapshot.empty) {
            const cloudDoctors = snapshot.docs.map((d) => d.data() as Doctor);

            // Clean up lingering default sample doctors & deleted doctors in Firestore
            cloudDoctors.forEach((docItem) => {
              if (LEGACY_SAMPLE_DOCTOR_NAMES.has(docItem.name) || deletedDoctorIds.has(docItem.id)) {
                deleteDoc(doc(db, 'doctors', String(docItem.id))).catch(() => {});
              }
            });

            const validCloudDoctors = cloudDoctors.filter(
              (d) => !LEGACY_SAMPLE_DOCTOR_NAMES.has(d.name) && !deletedDoctorIds.has(d.id)
            );
            validCloudDoctors.sort((a, b) => a.id - b.id);
            setDoctors(validCloudDoctors);
            localStorage.setItem('hemo_doctors_v1', JSON.stringify(validCloudDoctors));
          } else {
            setDoctors((prev) => {
              const list = prev.filter(
                (d) => !LEGACY_SAMPLE_DOCTOR_NAMES.has(d.name) && !deletedDoctorIds.has(d.id)
              );
              if (list.length > 0) {
                syncAllDoctorsToCloud(list);
              }
              return list;
            });
          }
        },
        (err) => {
          console.warn('Firestore doctors listener error:', err);
        }
      );

      // 6. Listen to Doctor Duties collection
      unsubDoctorDuties = onSnapshot(
        collection(db, 'doctor_duties'),
        (snapshot) => {
          if (!snapshot.empty) {
            const dutiesMap: Record<string, DoctorShiftDuty> = {};
            snapshot.docs.forEach((d) => {
              const data = d.data() as DoctorShiftDuty;
              if (data && data.date) {
                const isPagiLegacy = data.pagiDoctorName && LEGACY_SAMPLE_DOCTOR_NAMES.has(data.pagiDoctorName);
                const isSiangLegacy = data.siangDoctorName && LEGACY_SAMPLE_DOCTOR_NAMES.has(data.siangDoctorName);
                if (isPagiLegacy || isSiangLegacy) {
                  const cleanedDuty: DoctorShiftDuty = {
                    ...data,
                    pagiDoctorId: isPagiLegacy ? null : data.pagiDoctorId,
                    pagiDoctorName: isPagiLegacy ? undefined : data.pagiDoctorName,
                    siangDoctorId: isSiangLegacy ? null : data.siangDoctorId,
                    siangDoctorName: isSiangLegacy ? undefined : data.siangDoctorName,
                  };
                  dutiesMap[data.date] = cleanedDuty;
                  setDoc(doc(db, 'doctor_duties', data.date), cleanedDuty).catch(() => {});
                } else {
                  dutiesMap[data.date] = data;
                }
              }
            });
            setDoctorDuties(dutiesMap);
            localStorage.setItem('hemo_doctor_duties_v1', JSON.stringify(dutiesMap));
          }
        },
        (err) => {
          console.warn('Firestore doctor_duties listener error:', err);
        }
      );
    } catch (e) {
      console.warn('Firestore initialization error:', e);
    }

    return () => {
      unsubNurses();
      unsubBays();
      unsubMachines();
      unsubAssignments();
      unsubSettings();
      unsubDoctors();
      unsubDoctorDuties();
    };
  }, []);

  const setCurrentMonth = (monthStr: string) => {
    setCurrentMonthState(monthStr);
    const parts = monthStr.split('-');
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      setSelectedYear(y);
      setSelectedMonth(m);
    }
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    try {
      const parts = date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (y !== selectedYear || m !== selectedMonth) {
          setSelectedYear(y);
          setSelectedMonth(m);
          setCurrentMonthState(`${y}-${String(m).padStart(2, '0')}`);
        }
      }
    } catch {
      // ignore
    }
  };

  const selectMonth = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    setCurrentMonthState(monthStr);
    const curr = new Date();
    if (curr.getFullYear() === year && curr.getMonth() + 1 === month) {
      setSelectedDate(
        `${year}-${String(month).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`
      );
    } else {
      setSelectedDate(`${year}-${String(month).padStart(2, '0')}-01`);
    }
  };

  const dailyAssignments = useMemo(() => {
    const nurseMap = new Map(nurses.map((n) => [n.id, n]));
    const existingMap = new Map<number, ShiftAssignment>();

    // 1. Gather all existing assignments for selectedDate that belong to CURRENT valid nurses
    assignments
      .filter((a) => a.date === selectedDate && nurseMap.has(a.nurseId))
      .forEach((a) => {
        const nurse = nurseMap.get(a.nurseId)!;
        existingMap.set(a.nurseId, {
          ...a,
          nurseName: nurse.name,
          nursePhone: nurse.phone,
          specialDuty: a.specialDuty && a.specialDuty.trim() !== '' ? a.specialDuty.trim() : null,
        });
      });

    // 2. Guarantee that EVERY nurse in `nurses` has an assignment on selectedDate
    return nurses.map((nurse) => {
      const existing = existingMap.get(nurse.id);
      if (existing) return existing;

      return {
        id: `${selectedDate}-auto-${nurse.id}`,
        date: selectedDate,
        shiftType: (nurse.isActive ? 'LIBUR' : 'CUTI') as ShiftType,
        nurseId: nurse.id,
        nurseName: nurse.name,
        nursePhone: nurse.phone,
        assignedMachineIds: [],
        isLeader: nurse.role === 'KATIM' || nurse.role === 'KARU',
        isWhatsAppSent: false,
        notes: nurse.isActive ? 'Off / Belum Terjadwal' : 'Non-aktif',
        specialDuty: null,
      };
    });
  }, [assignments, selectedDate, nurses]);

  const monthlyAssignments = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const validNurseIds = new Set(nurses.map((n) => n.id));
    return assignments.filter((a) => a.date.startsWith(prefix) && validNurseIds.has(a.nurseId));
  }, [assignments, selectedYear, selectedMonth, nurses]);

  const fairnessReport = useMemo(() => {
    return FairSchedulerEngine.calculateFairnessReport(
      selectedYear,
      selectedMonth,
      nurses,
      monthlyAssignments
    );
  }, [selectedYear, selectedMonth, nurses, monthlyAssignments]);

  const generateSchedule = (_force: boolean = true) => {
    if (!checkKaruPermission('menyusun jadwal otomatis')) return;
    const activeNurses = nurses.filter((n) => n.isActive);
    if (activeNurses.length === 0) {
      showToast('Belum ada perawat aktif. Silakan tambahkan data perawat di menu Tim Perawat.');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      try {
        const prefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const newMonthSchedule = FairSchedulerEngine.generateMonthlySchedule(
          selectedYear,
          selectedMonth,
          nurses,
          machines,
          Date.now()
        );

        setAssignments((prev) => {
          const existingMonthMap = new Map<string, ShiftAssignment>();
          prev.filter((a) => a.date.startsWith(prefix)).forEach((a) => {
            existingMonthMap.set(`${a.date}_${a.nurseId}`, a);
          });

          const mergedMonthSchedule = newMonthSchedule.map((newAsg) => {
            const existing = existingMonthMap.get(`${newAsg.date}_${newAsg.nurseId}`);
            return {
              ...newAsg,
              specialDuty: existing?.specialDuty && existing.specialDuty.trim() !== '' ? existing.specialDuty.trim() : null,
            };
          });

          const otherMonths = prev.filter((a) => !a.date.startsWith(prefix));
          const updated = [...otherMonths, ...mergedMonthSchedule];
          syncBatchAssignmentsToCloud(mergedMonthSchedule);
          return updated;
        });

        showToast(`Pembagian jadwal & mesin bulan ${selectedMonth}/${selectedYear} berhasil dibuat otomatis!`, 'success');
      } catch (err) {
        showToast(`Gagal membuat jadwal: ${err instanceof Error ? err.message : String(err)}`, 'error');
      } finally {
        setIsGenerating(false);
      }
    }, 200);
  };

  const generateMonthlySchedule = (monthStr?: string) => {
    if (!checkKaruPermission('menyusun jadwal 1 bulan')) return;
    const targetMonth = monthStr || currentMonth;
    const parts = targetMonth.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);

    const activeNurses = nurses.filter((n) => n.isActive);
    if (activeNurses.length === 0) {
      showToast('Belum ada perawat aktif.', 'error');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      try {
        const prefix = `${y}-${String(m).padStart(2, '0')}`;
        const newMonthSchedule = FairSchedulerEngine.generateMonthlySchedule(
          y,
          m,
          nurses,
          machines,
          Date.now()
        );

        setAssignments((prev) => {
          const existingMonthMap = new Map<string, ShiftAssignment>();
          prev.filter((a) => a.date.startsWith(prefix)).forEach((a) => {
            existingMonthMap.set(`${a.date}_${a.nurseId}`, a);
          });

          const mergedMonthSchedule = newMonthSchedule.map((newAsg) => {
            const existing = existingMonthMap.get(`${newAsg.date}_${newAsg.nurseId}`);
            return {
              ...newAsg,
              specialDuty: existing?.specialDuty && existing.specialDuty.trim() !== '' ? existing.specialDuty.trim() : null,
            };
          });

          const otherMonths = prev.filter((a) => !a.date.startsWith(prefix));
          const updated = [...otherMonths, ...mergedMonthSchedule];
          syncBatchAssignmentsToCloud(mergedMonthSchedule);
          return updated;
        });

        showToast(`Jadwal bulan ${m}/${y} berhasil digenerate secara adil!`, 'success');
      } catch (err) {
        showToast(`Gagal: ${err instanceof Error ? err.message : String(err)}`, 'error');
      } finally {
        setIsGenerating(false);
      }
    }, 200);
  };

  const setShift = (date: string, nurseId: number, shiftType: ShiftType) => {
    if (!checkKaruPermission('mengubah sif perawat')) return;
    const nurse = nurses.find((n) => n.id === nurseId);
    if (!nurse) return;

    setAssignments((prev) => {
      const existing = prev.find((a) => a.date === date && a.nurseId === nurseId);
      if (existing) {
        const updatedAssignment: ShiftAssignment = {
          ...existing,
          shiftType,
          assignedMachineIds:
            shiftType === 'LIBUR' || shiftType === 'CUTI' || shiftType === 'SAKIT'
              ? []
              : existing.assignedMachineIds,
          specialDuty: existing.specialDuty && existing.specialDuty.trim() !== '' ? existing.specialDuty.trim() : null,
        };
        syncAssignmentToCloud(updatedAssignment);
        return prev.map((a) => (a.id === existing.id ? updatedAssignment : a));
      } else {
        const newAssignment: ShiftAssignment = {
          id: `${date}_${nurseId}_${Date.now()}`,
          date,
          shiftType,
          nurseId,
          nurseName: nurse.name,
          nursePhone: nurse.phone,
          assignedMachineIds: [],
          isLeader: nurse.role === 'KATIM',
          isWhatsAppSent: false,
          notes: '',
          specialDuty: null,
        };
        syncAssignmentToCloud(newAssignment);
        return [...prev, newAssignment];
      }
    });
  };

  const generateDailyMachineAllocation = (date: string = selectedDate) => {
    if (!checkKaruPermission('mengalokasikan mesin harian')) return;
    const activeNurses = nurses.filter((n) => n.isActive);
    if (activeNurses.length === 0) {
      showToast('Belum ada perawat aktif.', 'error');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      try {
        const activeMachines = machines.filter(
          (m) =>
            (m.status || 'AKTIF').toUpperCase() === 'AKTIF' &&
            m.status !== 'MAINTENANCE' &&
            m.status !== 'RUSAK' &&
            m.status !== 'TIDAK_DIGUNAKAN'
        );

        if (activeMachines.length === 0) {
          showToast('Tidak ada mesin berstatus AKTIF.', 'error');
          return;
        }

        // Daily source: use existing assignments for this date or dailyAssignments fallback
        const existingDaily = assignments.filter((a) => a.date === date);
        const dailySource =
          existingDaily.length > 0
            ? existingDaily
            : date === selectedDate && dailyAssignments.length > 0
            ? dailyAssignments
            : [];

        if (dailySource.length === 0) {
          generateSchedule(true);
        } else {
          const getOrCreateNurse = (a: ShiftAssignment): Nurse => {
            const found = nurses.find((n) => Number(n.id) === Number(a.nurseId));
            if (found) {
              return {
                ...found,
                specialDuty: a.specialDuty && a.specialDuty.trim() !== '' ? a.specialDuty.trim() : null,
              };
            }
            return {
              id: Number(a.nurseId) || 999,
              name: a.nurseName,
              nip: '',
              phone: a.nursePhone || '',
              role: a.isLeader ? 'KATIM' : 'PELAKSANA',
              isActive: true,
              defaultOffDay: null,
              skillLevel: 'Senior',
              specialDuty: a.specialDuty && a.specialDuty.trim() !== '' ? a.specialDuty.trim() : null,
            };
          };

          const pagiAssignments = dailySource.filter((a) => a.shiftType === 'PAGI');
          const siangAssignments = dailySource.filter((a) => a.shiftType === 'SIANG');

          const pagiNurses = pagiAssignments.map(getOrCreateNurse);
          const siangNurses = siangAssignments.map(getOrCreateNurse);

          const dayNumber = parseInt(date.split('-')[2] || '1', 10);
          const pagiAlloc = FairSchedulerEngine.allocateMachinesFairly(
            pagiNurses,
            activeMachines,
            dayNumber,
            'PAGI'
          );
          const siangAlloc = FairSchedulerEngine.allocateMachinesFairly(
            siangNurses,
            activeMachines,
            dayNumber,
            'SIANG'
          );

          const updatedDailyMap = new Map<number | string, ShiftAssignment>();
          dailySource.forEach((a) => {
            const nId = Number(a.nurseId);
            let item = { ...a };
            if (a.shiftType === 'PAGI') {
              item.assignedMachineIds = pagiAlloc[nId] || (pagiAlloc as Record<string, number[]>)[String(a.nurseId)] || [];
            } else if (a.shiftType === 'SIANG') {
              item.assignedMachineIds = siangAlloc[nId] || (siangAlloc as Record<string, number[]>)[String(a.nurseId)] || [];
            } else {
              item.assignedMachineIds = [];
            }
            updatedDailyMap.set(nId, item);
          });

          const updatedDaily = Array.from(updatedDailyMap.values());
          setAssignments((prev) => {
            const otherDates = prev.filter((a) => a.date !== date);
            return [...otherDates, ...updatedDaily];
          });
          syncBatchAssignmentsToCloud(updatedDaily);
        }
        showToast(`Pembagian seluruh ${activeMachines.length} mesin aktif tanggal ${date} berhasil dialokasikan secara adil!`, 'success');
      } catch (err) {
        showToast(`Gagal: ${err instanceof Error ? err.message : String(err)}`, 'error');
      } finally {
        setIsGenerating(false);
      }
    }, 150);
  };

  const reallocateMachinesForDate = (
    date: string = selectedDate,
    options: {
      rotateBays?: boolean;
      leaderLighterLoad?: boolean;
      consecutiveIsolationProtection?: boolean;
      shuffleNurses?: boolean;
      targetShift?: 'ALL' | 'PAGI' | 'SIANG';
    } = {}
  ) => {
    if (!checkKaruPermission('mengalokasikan mesin secara adil')) return;
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const activeMachines = machines.filter(
          (m) =>
            (m.status || 'AKTIF').toUpperCase() === 'AKTIF' &&
            m.status !== 'MAINTENANCE' &&
            m.status !== 'RUSAK' &&
            m.status !== 'TIDAK_DIGUNAKAN'
        );
        if (activeMachines.length === 0) {
          showToast('Tidak ada mesin berstatus AKTIF.', 'error');
          return;
        }

        const existingDaily = assignments.filter((a) => a.date === date);
        const dailySource =
          existingDaily.length > 0
            ? existingDaily
            : date === selectedDate && dailyAssignments.length > 0
            ? dailyAssignments
            : [];

        if (dailySource.length === 0) {
          showToast(`Tidak ditemukan jadwal dinas pada tanggal ${date}. Buat jadwal terlebih dahulu.`, 'error');
          return;
        }

        const targetShift = options.targetShift || 'ALL';

        const getOrCreateNurse = (a: ShiftAssignment): Nurse => {
          const found = nurses.find((n) => Number(n.id) === Number(a.nurseId));
          if (found) {
            return {
              ...found,
              specialDuty: a.specialDuty && a.specialDuty.trim() !== '' ? a.specialDuty.trim() : null,
            };
          }
          return {
            id: Number(a.nurseId) || 999,
            name: a.nurseName,
            nip: '',
            phone: a.nursePhone || '',
            role: a.isLeader ? 'KATIM' : 'PELAKSANA',
            isActive: true,
            defaultOffDay: null,
            skillLevel: 'Senior',
            specialDuty: a.specialDuty && a.specialDuty.trim() !== '' ? a.specialDuty.trim() : null,
          };
        };

        const pagiAssignments = dailySource.filter((a) => a.shiftType === 'PAGI');
        const siangAssignments = dailySource.filter((a) => a.shiftType === 'SIANG');

        const pagiNurses = pagiAssignments.map(getOrCreateNurse);
        const siangNurses = siangAssignments.map(getOrCreateNurse);

        const dayNumber = parseInt(date.split('-')[2] || '1', 10);
        const fourMachineTracker: Record<number, number> = {};
        const isolationTracker: Record<number, number> = {};
        const lastDayIso: Record<number, boolean> = {};

        const effectiveOptions = {
          shuffleNurses: true,
          rotateBays: true,
          ...options,
        };

        // 1. Allocate Pagi if targetShift is ALL or PAGI
        const shouldAllocPagi = (targetShift === 'ALL' || targetShift === 'PAGI') && pagiNurses.length > 0;
        const pagiAlloc = shouldAllocPagi
          ? FairSchedulerEngine.allocateMachinesWithOptions(
              pagiNurses,
              activeMachines,
              dayNumber,
              'PAGI',
              fourMachineTracker,
              isolationTracker,
              lastDayIso,
              effectiveOptions
            )
          : null;

        // 2. Allocate Siang if targetShift is ALL or SIANG
        const shouldAllocSiang = (targetShift === 'ALL' || targetShift === 'SIANG') && siangNurses.length > 0;
        const siangAlloc = shouldAllocSiang
          ? FairSchedulerEngine.allocateMachinesWithOptions(
              siangNurses,
              activeMachines,
              dayNumber,
              'SIANG',
              fourMachineTracker,
              isolationTracker,
              lastDayIso,
              effectiveOptions
            )
          : null;

        const updatedDailyMap = new Map<number | string, ShiftAssignment>();
        dailySource.forEach((a) => {
          const nId = Number(a.nurseId);
          // Strictly preserve existing shiftType and nurse profile - only update machine allocation according to targetShift
          let item = { ...a };
          if (a.shiftType === 'PAGI') {
            if (pagiAlloc) {
              item.assignedMachineIds = pagiAlloc[nId] || (pagiAlloc as Record<string, number[]>)[String(a.nurseId)] || [];
            }
          } else if (a.shiftType === 'SIANG') {
            if (siangAlloc) {
              item.assignedMachineIds = siangAlloc[nId] || (siangAlloc as Record<string, number[]>)[String(a.nurseId)] || [];
            }
          } else {
            item.assignedMachineIds = [];
          }
          updatedDailyMap.set(nId, item);
        });

        const updatedDaily = Array.from(updatedDailyMap.values());
        setAssignments((prev) => {
          const otherDates = prev.filter((a) => a.date !== date);
          return [...otherDates, ...updatedDaily];
        });

        syncBatchAssignmentsToCloud(updatedDaily);

        const shiftTitle =
          targetShift === 'PAGI'
            ? 'Sif PAGI'
            : targetShift === 'SIANG'
            ? 'Sif SIANG'
            : 'Sif PAGI & SIANG';

        showToast(
          `Alokasi ${activeMachines.length} mesin aktif untuk ${shiftTitle} tanggal ${date} berhasil digenerate ulang secara adil!`,
          'success'
        );
      } catch (err) {
        showToast(`Gagal alokasi mesin: ${err instanceof Error ? err.message : String(err)}`, 'error');
      } finally {
        setIsGenerating(false);
      }
    }, 150);
  };

  const reallocateMachinesForMonth = (
    monthStr: string = currentMonth,
    options: {
      rotateBays?: boolean;
      leaderLighterLoad?: boolean;
      consecutiveIsolationProtection?: boolean;
      shuffleNurses?: boolean;
      targetShift?: 'ALL' | 'PAGI' | 'SIANG';
    } = {}
  ) => {
    if (!checkKaruPermission('mengalokasikan mesin bulanan')) return;
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const activeMachines = machines.filter(
          (m) =>
            (m.status || 'AKTIF').toUpperCase() === 'AKTIF' &&
            m.status !== 'MAINTENANCE' &&
            m.status !== 'RUSAK' &&
            m.status !== 'TIDAK_DIGUNAKAN'
        );
        if (activeMachines.length === 0) {
          showToast('Tidak ada mesin berstatus AKTIF.', 'error');
          return;
        }

        const effectiveOptions = {
          shuffleNurses: true,
          rotateBays: true,
          ...options,
        };

        const updatedSchedule = FairSchedulerEngine.reallocateMonthlyMachinesPreservingShifts(
          monthStr,
          assignments,
          nurses,
          activeMachines,
          effectiveOptions
        );

        setAssignments(updatedSchedule);
        const monthOnly = updatedSchedule.filter((a) => a.date.startsWith(monthStr));
        syncBatchAssignmentsToCloud(monthOnly);

        const shiftTitle =
          options.targetShift === 'PAGI'
            ? 'Sif PAGI'
            : options.targetShift === 'SIANG'
            ? 'Sif SIANG'
            : 'Sif PAGI & SIANG';

        showToast(
          `Alokasi ${activeMachines.length} mesin aktif untuk ${shiftTitle} bulan ${monthStr} berhasil digenerate ulang secara adil!`,
          'success'
        );
      } catch (err) {
        showToast(`Gagal alokasi mesin bulanan: ${err instanceof Error ? err.message : String(err)}`, 'error');
      } finally {
        setIsGenerating(false);
      }
    }, 200);
  };

  const importScheduleAssignments = (
    importedAssignments: ShiftAssignment[],
    targetMonth: string,
    replaceExisting: boolean = true,
    newNurses?: Nurse[]
  ) => {
    if (!checkKaruPermission('mengimpor jadwal')) return;
    if (!importedAssignments || importedAssignments.length === 0) {
      showToast('Tidak ada data jadwal yang dapat diimpor.', 'error');
      return;
    }

    try {
      let activeNursesList = nurses;
      if (newNurses && newNurses.length > 0) {
        const existingNurseIds = new Set(nurses.map((n) => n.id));
        const toAdd = newNurses.filter((n) => !existingNurseIds.has(n.id));
        if (toAdd.length > 0) {
          activeNursesList = [...nurses, ...toAdd];
          setNurses(activeNursesList);
          syncAllNursesToCloud(activeNursesList);
        }
      }

      let combined: ShiftAssignment[] = [];
      if (replaceExisting) {
        // Remove all previous assignments for targetMonth and replace with imported, preserving specialDuty
        const existingMap = new Map<string, ShiftAssignment>();
        assignments.filter((a) => a.date.startsWith(targetMonth)).forEach((a) => {
          existingMap.set(`${a.date}-${a.nurseId}`, a);
        });

        const preservedImported = importedAssignments.map((newAsg) => {
          const prev = existingMap.get(`${newAsg.date}-${newAsg.nurseId}`);
          return {
            ...newAsg,
            specialDuty: newAsg.specialDuty || prev?.specialDuty || null,
          };
        });

        const others = assignments.filter((a) => !a.date.startsWith(targetMonth));
        combined = [...others, ...preservedImported];
        setAssignments(combined);
        syncBatchAssignmentsToCloud(preservedImported);
      } else {
        // Merge: replace only matching IDs/dates
        const importMap = new Map<string, ShiftAssignment>();
        importedAssignments.forEach((a) => importMap.set(`${a.date}-${a.nurseId}`, a));

        const kept = assignments.filter((a) => !importMap.has(`${a.date}-${a.nurseId}`));
        combined = [...kept, ...importedAssignments];
        setAssignments(combined);
        syncBatchAssignmentsToCloud(importedAssignments);
      }

      showToast(
        `Sukses mengimpor ${importedAssignments.length} data jadwal untuk periode ${targetMonth}!${
          newNurses && newNurses.length > 0 ? ` Termasuk ${newNurses.length} perawat baru didaftarkan.` : ''
        }`,
        'success'
      );
    } catch (err) {
      showToast(`Gagal mengimpor jadwal: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const updateAssignment = (
    assignment: ShiftAssignment,
    newShiftType: ShiftType,
    newMachines: number[],
    isLeader: boolean,
    notes: string,
    specialDuty?: string | null
  ) => {
    if (!checkKaruPermission('mengubah penugasan dinas')) return;

    const effectiveDuty =
      specialDuty !== undefined
        ? (specialDuty && specialDuty.trim() !== '' ? formatSpecialDuties(parseSpecialDuties(specialDuty)) : null)
        : (assignment.specialDuty && assignment.specialDuty.trim() !== '' ? formatSpecialDuties(parseSpecialDuties(assignment.specialDuty)) : null);

    const updated: ShiftAssignment = {
      ...assignment,
      shiftType: newShiftType,
      assignedMachineIds: newMachines,
      isLeader,
      notes,
      specialDuty: effectiveDuty,
    };
    syncAssignmentToCloud(updated);
    setAssignments((prev) => {
      const filtered = prev.filter(
        (a) =>
          a.id !== assignment.id &&
          !(a.date === assignment.date && Number(a.nurseId) === Number(assignment.nurseId))
      );
      return [...filtered, updated];
    });
    showToast(`Perubahan jadwal ${assignment.nurseName} berhasil disimpan.`, 'success');
  };

  const addNurse = (nurseData: Omit<Nurse, 'id'> | Nurse) => {
    if (!checkKaruPermission('menambah data perawat')) return;
    const nextId = nurses.length > 0 ? Math.max(...nurses.map((n) => n.id)) + 1 : 1;
    const newNurse: Nurse = {
      ...nurseData,
      id: 'id' in nurseData ? nurseData.id : nextId,
      isPermanent: true,
    };

    // Unmark from deleted if re-added
    try {
      const deleted = JSON.parse(localStorage.getItem('hemo_deleted_nurse_ids') || '[]');
      const filtered = deleted.filter((id: number) => id !== newNurse.id);
      localStorage.setItem('hemo_deleted_nurse_ids', JSON.stringify(filtered));
    } catch {}

    syncNurseToCloud(newNurse);
    setNurses((prev) => {
      const updated = [...prev, newNurse];
      localStorage.setItem('hemo_nurses_v1', JSON.stringify(updated));
      localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(updated));
      return updated;
    });
    showToast(`Perawat ${newNurse.name} berhasil ditambahkan dan DIKUNCI PERMANEN.`, 'success');
  };

  const updateNurse = (nurse: Nurse) => {
    if (!checkKaruPermission('mengubah data perawat')) return;
    const lockedNurse: Nurse = { ...nurse, isPermanent: true };
    syncNurseToCloud(lockedNurse);
    setNurses((prev) => {
      const updated = prev.map((n) => (n.id === nurse.id ? lockedNurse : n));
      localStorage.setItem('hemo_nurses_v1', JSON.stringify(updated));
      localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(updated));
      return updated;
    });
    setAssignments((prev) => {
      const updated = prev.map((a) =>
        a.nurseId === nurse.id
          ? {
              ...a,
              nurseName: nurse.name,
              nursePhone: nurse.phone,
              specialDuty: a.specialDuty && a.specialDuty.trim() !== '' ? a.specialDuty.trim() : null,
            }
          : a
      );
      const affected = updated.filter((a) => a.nurseId === nurse.id);
      if (affected.length > 0) {
        syncBatchAssignmentsToCloud(affected);
      }
      return updated;
    });
    showToast(`Data ${nurse.name} berhasil diperbarui dan tersimpan permanen.`, 'success');
  };

  const addOrUpdateNurse = (nurseData: Partial<Nurse> & { name: string; phone: string }) => {
    if (!nurseData.id) {
      addNurse({
        name: nurseData.name,
        nip: nurseData.nip || '',
        phone: nurseData.phone,
        role: nurseData.role || 'PELAKSANA',
        isActive: nurseData.isActive !== undefined ? nurseData.isActive : true,
        defaultOffDay: nurseData.defaultOffDay || null,
        skillLevel: nurseData.skillLevel || 'Senior',
        specialDuty: nurseData.specialDuty || null,
        isPermanent: true,
      });
    } else {
      const existing = nurses.find((n) => n.id === nurseData.id);
      const updatedNurse: Nurse = {
        ...(existing || {}),
        ...nurseData,
        id: nurseData.id,
        name: nurseData.name,
        phone: nurseData.phone,
        specialDuty: nurseData.specialDuty !== undefined ? (nurseData.specialDuty || null) : (existing?.specialDuty || null),
        isPermanent: true,
      } as Nurse;
      updateNurse(updatedNurse);
    }
  };

  const deleteNursePermanent = (id: number) => {
    if (!checkKaruPermission('menghapus data perawat secara permanen')) return;
    const target = nurses.find((n) => n.id === id);
    try {
      const deleted = JSON.parse(localStorage.getItem('hemo_deleted_nurse_ids') || '[]');
      if (!deleted.includes(id)) {
        localStorage.setItem('hemo_deleted_nurse_ids', JSON.stringify([...deleted, id]));
      }
      deleteDoc(doc(db, 'nurses', String(id))).catch(() => {});
    } catch (e) {
      console.warn('Could not delete nurse from Firestore:', e);
    }
    const updated = nurses.filter((n) => n.id !== id);
    setNurses(updated);
    localStorage.setItem('hemo_nurses_v1', JSON.stringify(updated));
    localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(updated));
    setAssignments((prev) => prev.filter((a) => a.nurseId !== id));
    showToast(`Data perawat ${target?.name || ''} telah DIHAPUS SECARA PERMANEN.`, 'info');
  };

  const deleteAllNursesPermanent = () => {
    if (!checkKaruPermission('menghapus seluruh data perawat secara permanen')) return;
    const nurseIds = nurses.map((n) => n.id);
    try {
      const deleted = JSON.parse(localStorage.getItem('hemo_deleted_nurse_ids') || '[]');
      const combined = Array.from(new Set([...deleted, ...nurseIds]));
      localStorage.setItem('hemo_deleted_nurse_ids', JSON.stringify(combined));
      nurseIds.forEach((id) => {
        deleteDoc(doc(db, 'nurses', String(id))).catch(() => {});
      });
    } catch (e) {
      console.warn('Could not batch delete nurses from Firestore:', e);
    }
    setNurses([]);
    localStorage.setItem('hemo_nurses_v1', JSON.stringify([]));
    localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify([]));
    setAssignments([]);
    showToast('Seluruh data perawat telah DIHAPUS SECARA PERMANEN.', 'info');
  };

  const deleteNurse = (id: number) => {
    deleteNursePermanent(id);
  };

  const clearAllNurses = () => {
    deleteAllNursesPermanent();
  };

  const clearDefaultNurses = () => {
    if (!checkKaruPermission('menghapus perawat bawaan')) return;
    const userOnly = nurses.filter((n) => !LEGACY_SAMPLE_NURSE_NAMES.has(n.name));
    setNurses(userOnly);
    localStorage.setItem('hemo_nurses_v1', JSON.stringify(userOnly));
    localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(userOnly));

    // Also purge assignments of sample nurses
    setAssignments((prev) => {
      const filtered = prev.filter((a) => !LEGACY_SAMPLE_NURSE_NAMES.has(a.nurseName));
      localStorage.setItem('hemo_assignments_v1', JSON.stringify(filtered));
      return filtered;
    });

    // Delete legacy sample nurses from Firestore
    Array.from(LEGACY_SAMPLE_NURSE_NAMES).forEach((name, idx) => {
      try {
        deleteDoc(doc(db, 'nurses', String(idx + 1))).catch(() => {});
      } catch (e) {
        console.warn('Error deleting sample nurse from Firestore:', e);
      }
    });

    showToast(
      userOnly.length > 0
        ? `Data perawat bawaan berhasil dibersihkan. ${userOnly.length} perawat inputan Anda tetap tersimpan dan terkunci permanen.`
        : 'Data perawat bawaan berhasil dibersihkan. Silakan tambahkan data perawat ruangan Anda.',
      'success'
    );
  };

  const loadSampleNurses = () => {
    showToast('Data perawat bawaan telah dinonaktifkan. Silakan tambahkan data perawat ruangan Anda sendiri.', 'info');
  };

  // DOCTOR (DOKTER JAGA HD) MANAGEMENT
  const addDoctor = (docInput: Omit<Doctor, 'id'> | Doctor) => {
    if (!checkKaruPermission('menambah data dokter')) return;
    const newId = 'id' in docInput && docInput.id ? docInput.id : Date.now();
    const newDoctor: Doctor = { ...docInput, id: newId, isActive: docInput.isActive !== false };
    setDoctors((prev) => [...prev.filter((d) => d.id !== newId), newDoctor]);
    syncDoctorToCloud(newDoctor);
    showToast(`Dokter ${newDoctor.name} berhasil didaftarkan`, 'success');
  };

  const updateDoctor = (doctor: Doctor) => {
    if (!checkKaruPermission('mengubah data dokter')) return;
    setDoctors((prev) => prev.map((d) => (d.id === doctor.id ? doctor : d)));
    syncDoctorToCloud(doctor);
    showToast(`Data dokter ${doctor.name} berhasil diperbarui`, 'success');
  };

  const deleteDoctor = (id: number) => {
    if (!checkKaruPermission('menghapus data dokter')) return;
    const target = doctors.find((d) => d.id === id);
    try {
      const deleted = JSON.parse(localStorage.getItem('hemo_deleted_doctor_ids') || '[]');
      if (!deleted.includes(id)) {
        deleted.push(id);
        localStorage.setItem('hemo_deleted_doctor_ids', JSON.stringify(deleted));
      }
    } catch {}
    setDoctors((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      localStorage.setItem('hemo_doctors_v1', JSON.stringify(updated));
      return updated;
    });
    deleteDoc(doc(db, 'doctors', String(id))).catch(() => {});
    showToast(`Dokter ${target?.name || ''} telah dihapus`, 'info');
  };

  const clearDefaultDoctors = () => {
    if (!checkKaruPermission('menghapus data dokter bawaan')) return;
    try {
      const deleted = new Set<number>(
        JSON.parse(localStorage.getItem('hemo_deleted_doctor_ids') || '[]')
      );
      doctors.forEach((d) => {
        if (LEGACY_SAMPLE_DOCTOR_NAMES.has(d.name) || [1, 2, 3, 4].includes(d.id)) {
          deleted.add(d.id);
          deleteDoc(doc(db, 'doctors', String(d.id))).catch(() => {});
        }
      });
      localStorage.setItem('hemo_deleted_doctor_ids', JSON.stringify(Array.from(deleted)));
    } catch {}

    const remaining = doctors.filter(
      (d) => !LEGACY_SAMPLE_DOCTOR_NAMES.has(d.name) && ![1, 2, 3, 4].includes(d.id)
    );
    setDoctors(remaining);
    localStorage.setItem('hemo_doctors_v1', JSON.stringify(remaining));

    showToast(
      remaining.length > 0
        ? `Data dokter bawaan berhasil dibersihkan. ${remaining.length} dokter terdaftar Anda tetap tersimpan.`
        : 'Data dokter bawaan berhasil dibersihkan.',
      'success'
    );
  };

  const clearAllDoctors = () => {
    if (!checkKaruPermission('menghapus seluruh data dokter')) return;
    try {
      const deleted = new Set<number>(
        JSON.parse(localStorage.getItem('hemo_deleted_doctor_ids') || '[]')
      );
      doctors.forEach((d) => {
        deleted.add(d.id);
        deleteDoc(doc(db, 'doctors', String(d.id))).catch(() => {});
      });
      localStorage.setItem('hemo_deleted_doctor_ids', JSON.stringify(Array.from(deleted)));
    } catch {}

    setDoctors([]);
    localStorage.setItem('hemo_doctors_v1', JSON.stringify([]));
    showToast('Seluruh data dokter berhasil dibersihkan.', 'info');
  };

  const setDoctorDuty = (
    date: string,
    pagiDoctorId?: number | null,
    siangDoctorId?: number | null,
    notes?: string
  ) => {
    const existing = doctorDuties[date];
    const pagiDoc = pagiDoctorId ? doctors.find((d) => d.id === pagiDoctorId) : undefined;
    const siangDoc = siangDoctorId ? doctors.find((d) => d.id === siangDoctorId) : undefined;

    const newDuty: DoctorShiftDuty = {
      date,
      pagiDoctorId: pagiDoctorId !== undefined ? pagiDoctorId : (existing?.pagiDoctorId ?? null),
      pagiDoctorName:
        pagiDoctorId !== undefined
          ? (pagiDoc ? pagiDoc.name : undefined)
          : existing?.pagiDoctorName,
      siangDoctorId: siangDoctorId !== undefined ? siangDoctorId : (existing?.siangDoctorId ?? null),
      siangDoctorName:
        siangDoctorId !== undefined
          ? (siangDoc ? siangDoc.name : undefined)
          : existing?.siangDoctorName,
      notes: notes !== undefined ? notes : (existing?.notes || ''),
    };

    setDoctorDuties((prev) => ({ ...prev, [date]: newDuty }));
    syncDoctorDutyToCloud(newDuty);
  };

  const getDoctorDutyForDate = (date: string): DoctorShiftDuty | undefined => {
    return doctorDuties[date];
  };

  const dispatchDoctorWhatsApp = (doctor: Doctor, shiftType: 'PAGI' | 'SIANG', dateStr: string = selectedDate) => {
    if (!doctor.phone) {
      showToast(`Dokter ${doctor.name} belum memiliki nomor WhatsApp terdaftar`, 'error');
      return;
    }
    const shiftNurses = dailyAssignments.filter((a) => a.shiftType === shiftType);
    const katim = shiftNurses.find((a) => a.isLeader);
    const duty = doctorDuties[dateStr];
    const msg = WhatsAppDispatcher.generateDoctorNotificationMessage(
      doctor.name,
      dateStr,
      shiftType,
      katim?.nurseName,
      settings.hospitalName,
      settings.roomName,
      duty?.notes
    );
    WhatsAppDispatcher.openWhatsApp(doctor.phone, msg);
    showToast(`Membuka WhatsApp untuk ${doctor.name}... Teks notifikasi disalin!`, 'success');
  };

  const addBay = (
    name: string,
    category: MachineCategory = 'REGULER',
    status: MachineStatus = 'AKTIF',
    machineIds: number[] = []
  ) => {
    if (!checkKaruPermission('menambah Bay baru')) return;
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Nama Bay tidak boleh kosong.', 'error');
      return;
    }

    // Unmark from deleted bays if previously deleted
    try {
      const deleted = JSON.parse(localStorage.getItem('hemo_deleted_bays_v1') || '[]');
      const filtered = deleted.filter((b: string) => b.trim().toLowerCase() !== trimmed.toLowerCase());
      localStorage.setItem('hemo_deleted_bays_v1', JSON.stringify(filtered));
    } catch {}

    setBays((prev) => {
      const updated = Array.from(new Set([...prev, trimmed]));
      localStorage.setItem('hemo_custom_bays_v1', JSON.stringify(updated));
      try {
        setDoc(doc(db, 'settings', 'bays'), { list: updated }).catch(() => {});
      } catch {}
      return updated;
    });

    if (machineIds && machineIds.length > 0) {
      const affectedMachines: Machine[] = [];
      const updatedMachines = machines.map((m) => {
        if (machineIds.includes(m.id)) {
          const updated: Machine = {
            ...m,
            bay: trimmed,
            category: category || m.category,
            status: status || m.status,
          };
          affectedMachines.push(updated);
          return updated;
        }
        return m;
      });
      setMachines(updatedMachines);
      localStorage.setItem('hemo_machines_v1', JSON.stringify(updatedMachines));
      affectedMachines.forEach((m) => syncMachineToCloud(m));
      showToast(
        `Bay "${trimmed}" berhasil dibuat dan ${affectedMachines.length} mesin dialokasikan ke bay ini.`,
        'success'
      );
    } else {
      showToast(
        `Bay "${trimmed}" berhasil ditambahkan! Anda sekarang dapat memilih Bay ini di halaman Tambah / Ubah Mesin HD.`,
        'success'
      );
    }
  };

  const updateBay = (
    oldBayName: string,
    newBayName: string,
    newCategory?: MachineCategory,
    newStatus?: MachineStatus,
    applyCategoryToAll: boolean = true,
    applyStatusToAll: boolean = false
  ) => {
    if (!checkKaruPermission('merubah pengaturan Bay')) return;
    const trimmedOld = oldBayName.trim();
    const trimmedNewName = newBayName.trim() || trimmedOld;

    // Unmark new name from deleted if needed
    try {
      const deleted = JSON.parse(localStorage.getItem('hemo_deleted_bays_v1') || '[]');
      const filtered = deleted.filter((b: string) => b.trim().toLowerCase() !== trimmedNewName.toLowerCase());
      localStorage.setItem('hemo_deleted_bays_v1', JSON.stringify(filtered));
    } catch {}

    setBays((prev) => {
      const updated = prev.map((b) => (b.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNewName : b));
      const unique = Array.from(new Set(updated));
      localStorage.setItem('hemo_custom_bays_v1', JSON.stringify(unique));
      try {
        setDoc(doc(db, 'settings', 'bays'), { list: unique }).catch(() => {});
      } catch {}
      return unique;
    });

    const affectedMachines: Machine[] = [];
    const updatedMachines = machines.map((m) => {
      if (m.bay?.trim().toLowerCase() === trimmedOld.toLowerCase()) {
        const updated: Machine = {
          ...m,
          bay: trimmedNewName,
          category: applyCategoryToAll && newCategory ? newCategory : m.category,
          status: applyStatusToAll && newStatus ? newStatus : m.status,
        };
        affectedMachines.push(updated);
        return updated;
      }
      return m;
    });

    setMachines(updatedMachines);
    localStorage.setItem('hemo_machines_v1', JSON.stringify(updatedMachines));

    // Sync affected machines to cloud Firestore
    affectedMachines.forEach((m) => {
      syncMachineToCloud(m);
    });

    showToast(
      `Pengaturan Bay "${trimmedNewName}" berhasil disimpan (${affectedMachines.length} mesin disinkronkan).`,
      'success'
    );
  };

  const deleteBay = (bayName: string, fallbackBayParam?: string) => {
    if (!checkKaruPermission('menghapus Bay')) return;
    const targetTrimmed = bayName.trim();
    const remaining = bays.filter((b) => b.trim().toLowerCase() !== targetTrimmed.toLowerCase());
    if (remaining.length === 0) {
      showToast('Minimal harus ada satu Bay aktif di ruangan.', 'error');
      return;
    }

    const fallbackBay =
      fallbackBayParam && remaining.some((b) => b.trim().toLowerCase() === fallbackBayParam.trim().toLowerCase())
        ? fallbackBayParam.trim()
        : (remaining[0] || 'Bay A (Reguler)');

    // Record in deleted bays persistent storage so it is never revived
    try {
      const deleted = JSON.parse(localStorage.getItem('hemo_deleted_bays_v1') || '[]');
      if (!deleted.some((d: string) => d.trim().toLowerCase() === targetTrimmed.toLowerCase())) {
        localStorage.setItem('hemo_deleted_bays_v1', JSON.stringify([...deleted, targetTrimmed]));
      }
    } catch {}

    setBays(remaining);
    localStorage.setItem('hemo_custom_bays_v1', JSON.stringify(remaining));
    try {
      setDoc(doc(db, 'settings', 'bays'), { list: remaining }).catch((e) => {
        console.warn('Error saving remaining bays to Firestore:', e);
      });
    } catch {}

    const affected: Machine[] = [];
    const updatedMachines = machines.map((m) => {
      if (m.bay?.trim().toLowerCase() === targetTrimmed.toLowerCase()) {
        const updated = { ...m, bay: fallbackBay };
        affected.push(updated);
        return updated;
      }
      return m;
    });

    setMachines(updatedMachines);
    localStorage.setItem('hemo_machines_v1', JSON.stringify(updatedMachines));
    affected.forEach((m) => syncMachineToCloud(m));

    if (affected.length > 0) {
      showToast(`Bay "${targetTrimmed}" berhasil dihapus. ${affected.length} mesin dialihkan ke ${fallbackBay}.`, 'success');
    } else {
      showToast(`Bay "${targetTrimmed}" berhasil dihapus.`, 'success');
    }
  };

  const addMachine = (machineData: Omit<Machine, 'id'> | Machine) => {
    if (!checkKaruPermission('menambah mesin HD')) return;
    const nextId = machines.length > 0 ? Math.max(...machines.map((m) => m.id)) + 1 : 1;
    const newMachine: Machine = {
      ...machineData,
      id: 'id' in machineData ? machineData.id : nextId,
    };
    syncMachineToCloud(newMachine);
    setMachines((prev) => [...prev, newMachine]);
    showToast(`Mesin ${newMachine.name} (${newMachine.code}) berhasil ditambahkan.`, 'success');
  };

  const updateMachine = (machine: Machine) => {
    if (!checkKaruPermission('mengubah data mesin HD')) return;
    syncMachineToCloud(machine);
    setMachines((prev) => prev.map((m) => (m.id === machine.id ? machine : m)));
    showToast(`Data mesin ${machine.name} berhasil diperbarui.`, 'success');
  };

  const addOrUpdateMachine = (machineData: Partial<Machine> & { name: string; code: string; bay: string }) => {
    if (!machineData.id) {
      addMachine({
        code: machineData.code || `M-${String(machines.length + 1).padStart(2, '0')}`,
        name: machineData.name || `Mesin HD ${String(machines.length + 1).padStart(2, '0')}`,
        bay: machineData.bay || 'Bay A (Reguler)',
        category: machineData.category || 'REGULER',
        status: machineData.status || 'AKTIF',
        brandModel: machineData.brandModel || 'Fresenius 4008S',
        notes: machineData.notes || '',
      });
    } else {
      const updatedMachine = { ...machineData } as Machine;
      syncMachineToCloud(updatedMachine);
      setMachines((prev) =>
        prev.map((m) => (m.id === machineData.id ? updatedMachine : m))
      );
      showToast(`Data ${machineData.name} berhasil diperbarui.`, 'success');
    }
  };

  const deleteMachine = (id: number) => {
    if (!checkKaruPermission('menghapus mesin HD')) return;
    const target = machines.find((m) => m.id === id);
    try {
      const deleted = JSON.parse(localStorage.getItem('hemo_deleted_machine_ids') || '[]');
      if (!deleted.includes(id)) {
        localStorage.setItem('hemo_deleted_machine_ids', JSON.stringify([...deleted, id]));
      }
      deleteDoc(doc(db, 'machines', String(id)));
    } catch (e) {
      console.warn('Could not delete machine from Firestore:', e);
    }
    setMachines((prev) => prev.filter((m) => m.id !== id));
    setAssignments((prev) =>
      prev.map((a) => ({
        ...a,
        assignedMachineIds: (a.assignedMachineIds || []).filter((mId) => mId !== id),
      }))
    );
    showToast(`Mesin ${target?.name || ''} (${target?.code || ''}) berhasil dihapus.`, 'info');
  };

  const loadDefaultMachines = () => {
    if (!checkKaruPermission('memulihkan denah 30 mesin HD')) return;
    localStorage.removeItem('hemo_deleted_machine_ids');
    setMachines(INITIAL_MACHINES);
    syncAllMachinesToCloud(INITIAL_MACHINES);
    showToast('Seluruh 30 mesin HD (A01-A12, C01-C04, B01-B09, C05-C09) berhasil dimuat lengkap dan disinkronkan.', 'success');
  };

  const toggleMachineStatus = (id: number) => {
    if (!checkKaruPermission('mengubah status mesin HD')) return;
    const target = machines.find((m) => m.id === id);
    if (!target) return;
    const newStatus: MachineStatus = target.status === 'AKTIF' ? 'TIDAK_DIGUNAKAN' : 'AKTIF';
    const updated = { ...target, status: newStatus };
    syncMachineToCloud(updated);
    setMachines((prev) =>
      prev.map((m) => (m.id === id ? updated : m))
    );
    generateDailyMachineAllocation(selectedDate);
    const label = newStatus === 'AKTIF' ? 'Aktif Normal' : 'Tidak Digunakan';
    showToast(`${target.name} diubah menjadi: ${label}`, 'info');
  };

  const setMachineStatus = (id: number, newStatus: MachineStatus, reason: string = '') => {
    if (!checkKaruPermission('mengubah status mesin HD')) return;
    const target = machines.find((m) => m.id === id);
    if (!target) return;
    const newNotes = reason ? (target.notes ? `${target.notes} | ${reason}` : reason) : target.notes;
    const updated = { ...target, status: newStatus, notes: newNotes };
    syncMachineToCloud(updated);
    setMachines((prev) =>
      prev.map((m) => (m.id === id ? updated : m))
    );
    generateDailyMachineAllocation(selectedDate);
    showToast(`${target.name} diset: ${newStatus}`, 'info');
  };

  const setAllMachinesActive = () => {
    if (!checkKaruPermission('mengaktifkan semua mesin HD')) return;
    setMachines((prev) => {
      const updated = prev.map((m) => ({ ...m, status: 'AKTIF' as MachineStatus }));
      syncAllMachinesToCloud(updated);
      return updated;
    });
    generateDailyMachineAllocation(selectedDate);
    showToast('Semua 30 mesin berhasil diaktifkan.', 'success');
  };

  const updateSettings = (newSettings: AppSettings) => {
    if (!checkKaruPermission('mengubah pengaturan sistem')) return;
    setSettings(newSettings);
    try {
      setDoc(doc(db, 'settings', 'config'), newSettings);
    } catch (e) {
      console.warn('Could not sync settings to Firestore:', e);
    }
    showToast('Pengaturan berhasil disimpan.', 'success');
  };

  const markAssignmentWhatsAppSent = (assignmentId: string, phone?: string) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id === assignmentId) {
          return {
            ...a,
            isWhatsAppSent: true,
            ...(phone ? { nursePhone: phone } : {}),
          };
        }
        return a;
      })
    );
  };

  const dispatchWhatsAppToNurse = (assignment: ShiftAssignment) => {
    const nurse = nurses.find((n) => n.id === assignment.nurseId);
    const targetPhone = assignment.nursePhone || nurse?.phone || '';
    const msg = WhatsAppDispatcher.generateNurseMessage(
      assignment,
      machines,
      settings.hospitalName,
      settings.roomName,
      nurse?.specialDuty
    );

    WhatsAppDispatcher.openWhatsApp(targetPhone, msg);
    markAssignmentWhatsAppSent(assignment.id, targetPhone);
    showToast(`Membuka WhatsApp untuk ${assignment.nurseName}... Teks pesan disalin!`, 'success');
  };

  const dispatchGroupBroadcast = (shiftType: 'PAGI' | 'SIANG' | null) => {
    const msg = WhatsAppDispatcher.generateGroupBroadcastMessage(
      selectedDate,
      shiftType,
      dailyAssignments,
      machines,
      settings.hospitalName
    );
    WhatsAppDispatcher.openWhatsApp(null, msg);
    showToast('Membuka WhatsApp untuk Broadcast Grup HD... Teks pesan disalin!', 'success');
  };

  const dispatchHeadNurseReport = (
    headNursePhone?: string,
    headNurseName?: string,
    directWhatsApp: boolean = true
  ) => {
    const targetPhone = headNursePhone || settings.headNursePhone;
    const targetName = headNurseName || settings.headNurseName || 'Kepala Ruang HD';
    const duty = doctorDuties[selectedDate];
    const pagiDoctor =
      duty?.pagiDoctorName ||
      (duty?.pagiDoctorId ? (doctors || []).find((d) => d.id === duty.pagiDoctorId)?.name : undefined);
    const siangDoctor =
      duty?.siangDoctorName ||
      (duty?.siangDoctorId ? (doctors || []).find((d) => d.id === duty.siangDoctorId)?.name : undefined);

    const msg = WhatsAppDispatcher.generateHeadNurseCompactReport(
      selectedDate,
      dailyAssignments,
      machines,
      settings.hospitalName,
      settings.roomName,
      targetName,
      false,
      {
        pagiDoctorName: pagiDoctor,
        siangDoctorName: siangDoctor,
        notes: duty?.notes,
      }
    );

    if (directWhatsApp && targetPhone) {
      WhatsAppDispatcher.openWhatsApp(targetPhone, msg);
      showToast(`Laporan harian dikirim ke ${targetName} via WhatsApp.`, 'success');
    } else {
      WhatsAppDispatcher.shareOrCopy(msg, `Laporan Harian Pembagian Mesin HD ${selectedDate}`);
      showToast(`Laporan harian berhasil disalin untuk ${targetName}.`, 'success');
    }
  };

  const syncToGoogleSheets = async () => {
    setIsSyncing(true);
    try {
      const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const result = await GoogleSheetsService.syncToGoogleSheets(
        settings.googleSheetWebhookUrl,
        monthStr,
        nurses,
        machines,
        monthlyAssignments,
        doctors,
        doctorDuties
      );
      setSettings((prev) => ({
        ...prev,
        lastSyncTimestamp: Date.now(),
        lastSyncStatus: result.message,
      }));
      showToast(result.message, result.isSuccess ? 'success' : 'error');
    } catch (err) {
      showToast(`Gagal sync: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncWithGoogleSheets = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const monthStr = currentMonth;
      const result = await GoogleSheetsService.syncToGoogleSheets(
        settings.googleSheetWebhookUrl,
        monthStr,
        nurses,
        machines,
        monthlyAssignments,
        doctors,
        doctorDuties
      );
      setSettings((prev) => ({
        ...prev,
        lastSyncTimestamp: Date.now(),
        lastSyncStatus: result.message,
      }));
      return result.isSuccess;
    } catch {
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncAllToGoogleSheets = async (customUrl?: string): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      const url = customUrl || settings.googleSheetWebhookUrl;
      const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const result = await GoogleSheetsService.syncAllToGoogleSheets(
        url,
        monthStr,
        nurses,
        machines,
        assignments,
        bays,
        doctors,
        doctorDuties
      );
      setSettings((prev) => ({
        ...prev,
        lastSyncTimestamp: Date.now(),
        lastSyncStatus: result.message,
      }));
      showToast(result.message, result.isSuccess ? 'success' : 'error');
      return { success: result.isSuccess, message: result.message };
    } catch (err) {
      const msg = `Gagal ekspor ke Google Sheets: ${err instanceof Error ? err.message : String(err)}`;
      showToast(msg, 'error');
      return { success: false, message: msg };
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchDataFromGoogleSheets = async (
    customUrl?: string,
    targetMonth?: string
  ): Promise<{ success: boolean; message: string; nurses: number; machines: number; assignments: number }> => {
    setIsSyncing(true);
    try {
      const url = customUrl || settings.googleSheetWebhookUrl;
      const monthStr = targetMonth || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const result = await GoogleSheetsService.fetchDataFromGoogleSheets(url, monthStr);
      if (!result.isSuccess) {
        showToast(result.message, 'error');
        return { success: false, message: result.message, nurses: 0, machines: 0, assignments: 0 };
      }

      // 1. Update nurses
      if (result.nurses && result.nurses.length > 0) {
        setNurses(result.nurses);
        localStorage.setItem('hemo_nurses_v1', JSON.stringify(result.nurses));
        localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(result.nurses));
      }

      // 2. Update machines
      if (result.machines && result.machines.length > 0) {
        setMachines(result.machines);
        localStorage.setItem('hemo_machines_v1', JSON.stringify(result.machines));
      }

      // 3. Update bays
      if (result.bays && result.bays.length > 0) {
        setBays(result.bays);
        localStorage.setItem('hemo_custom_bays_v1', JSON.stringify(result.bays));
      }

      // 4. Update doctors
      if (result.doctors && result.doctors.length > 0) {
        setDoctors(result.doctors);
        localStorage.setItem('hemo_doctors_v1', JSON.stringify(result.doctors));
        result.doctors.forEach((d) => syncDoctorToCloud(d));
      }

      // 5. Update doctor duties
      if (result.doctorDuties && Object.keys(result.doctorDuties).length > 0) {
        setDoctorDuties((prev) => {
          const updated = { ...prev, ...result.doctorDuties };
          localStorage.setItem('hemo_doctor_duties_v1', JSON.stringify(updated));
          return updated;
        });
        Object.values(result.doctorDuties).forEach((dd) => syncDoctorDutyToCloud(dd));
      }

      // 6. Update assignments
      if (result.assignments && result.assignments.length > 0) {
        let finalAssignments = result.assignments;
        const targetNurses = result.nurses && result.nurses.length > 0 ? result.nurses : nurses;
        const targetMachines = result.machines && result.machines.length > 0 ? result.machines : machines;

        // Auto-allocate machines if shifts were pulled from matrix without machine assignments
        if (
          targetMachines.length > 0 &&
          finalAssignments.some((a) => (a.shiftType === 'PAGI' || a.shiftType === 'SIANG') && (!a.assignedMachineIds || a.assignedMachineIds.length === 0))
        ) {
          finalAssignments = FairSchedulerEngine.reallocateMonthlyMachinesPreservingShifts(
            monthStr,
            finalAssignments,
            targetNurses,
            targetMachines,
            { rotateBays: true, consecutiveIsolationProtection: true }
          );
        }

        const pulledDates = new Set(finalAssignments.map((a) => a.date));
        const mergedAssignments = [
          ...assignments.filter((a) => !pulledDates.has(a.date)),
          ...finalAssignments,
        ];
        setAssignments(mergedAssignments);
        localStorage.setItem('hemo_assignments_v1', JSON.stringify(mergedAssignments));
      }

      // 7. Background sync to Firestore if possible (silently ignore quota exhaustion)
      try {
        if (db) {
          const syncDoc = doc(db, 'hemo_shared_state', 'master_data');
          await setDoc(
            syncDoc,
            {
              nurses: result.nurses.length > 0 ? result.nurses : nurses,
              machines: result.machines.length > 0 ? result.machines : machines,
              bays: result.bays && result.bays.length > 0 ? result.bays : bays,
              updatedAt: Date.now(),
              source: 'google_sheets_sync',
            },
            { merge: true }
          );
        }
      } catch (cloudErr) {
        console.warn('Silent cloud update after sheets pull skipped:', cloudErr);
      }

      setSettings((prev) => ({
        ...prev,
        lastSyncTimestamp: Date.now(),
        lastSyncStatus: `Tarik Google Sheets OK (${result.nurses.length} N, ${result.machines.length} M, ${result.assignments.length} S)`,
      }));

      showToast(result.message, 'success');
      return {
        success: true,
        message: result.message,
        nurses: result.nurses.length,
        machines: result.machines.length,
        assignments: result.assignments.length,
      };
    } catch (err) {
      const msg = `Gagal menarik data dari Google Sheets: ${err instanceof Error ? err.message : String(err)}`;
      showToast(msg, 'error');
      return { success: false, message: msg, nurses: 0, machines: 0, assignments: 0 };
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadCsv = () => {
    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    GoogleSheetsService.downloadCsvFile(monthStr, monthlyAssignments, machines);
    showToast('File CSV berhasil diunduh.', 'success');
  };

  const copyTable = async () => {
    const ok = await GoogleSheetsService.copyTableToClipboard(monthlyAssignments, machines);
    if (ok) {
      showToast('Tabel tersalin! Silakan tempel (Paste) di Google Sheets / Excel.', 'success');
    } else {
      showToast('Gagal menyalin tabel ke clipboard.', 'error');
    }
  };

  const resetToInitialData = () => {
    if (!checkKaruPermission('mereset data ke awal')) return;
    localStorage.removeItem('hemo_deleted_machine_ids');
    // Keep user's permanent input nurses safe and locked!
    const permanentSaved = localStorage.getItem('hemo_permanent_nurses_v1');
    let preservedNurses: Nurse[] = [];
    if (permanentSaved) {
      try {
        const parsed = JSON.parse(permanentSaved);
        if (Array.isArray(parsed) && parsed.length > 0) preservedNurses = parsed;
      } catch {}
    }
    if (preservedNurses.length === 0 && nurses.length > 0) {
      preservedNurses = nurses;
    }

    setNurses(preservedNurses);
    setMachines(INITIAL_MACHINES);
    setSettings(INITIAL_SETTINGS);
    setAssignments([]);
    syncAllMachinesToCloud(INITIAL_MACHINES);
    localStorage.setItem('hemo_nurses_v1', JSON.stringify(preservedNurses));
    localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(preservedNurses));
    localStorage.removeItem('hemo_machines_v1');
    localStorage.removeItem('hemo_assignments_v1');
    localStorage.removeItem('hemo_settings_v1');
    showToast(
      preservedNurses.length > 0
        ? `Jadwal & mesin berhasil direset. ${preservedNurses.length} data perawat inputan Anda tetap aman dan terkunci permanen.`
        : 'Data berhasil direset ke awal.',
      'info'
    );
  };

  const syncAllDataToCloud = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      if (nurses.length > 0) {
        await syncAllNursesToCloud(nurses);
      }
      if (machines.length > 0) {
        await syncAllMachinesToCloud(machines);
      }
      if (assignments.length > 0) {
        await syncBatchAssignmentsToCloud(assignments);
      }
      if (doctors.length > 0) {
        await syncAllDoctorsToCloud(doctors);
      }
      for (const duty of Object.values(doctorDuties)) {
        await syncDoctorDutyToCloud(duty);
      }
      await setDoc(doc(db, 'settings', 'config'), settings, { merge: true });
      await setDoc(doc(db, 'settings', 'bays'), { list: bays }, { merge: true });
      setIsCloudConnected(true);
      showToast(
        `Berhasil! ${assignments.length} jadwal, ${nurses.length} perawat, ${doctors.length} dokter, dan ${machines.length} mesin tersinkron & tersimpan di Cloud Firestore.`,
        'success'
      );
      return true;
    } catch (err) {
      showToast(`Gagal sinkronisasi cloud: ${err instanceof Error ? err.message : String(err)}`, 'error');
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchDataFromCloud = async (): Promise<{ success: boolean; nurses: number; machines: number; assignments: number }> => {
    setIsSyncing(true);
    try {
      let nursesSnap, machinesSnap, assignmentsSnap, settingsSnap, baysSnap;
      try {
        // Force fresh fetch directly from server
        [nursesSnap, machinesSnap, assignmentsSnap, settingsSnap, baysSnap] = await Promise.all([
          getDocsFromServer(collection(db, 'nurses')),
          getDocsFromServer(collection(db, 'machines')),
          getDocsFromServer(collection(db, 'assignments')),
          getDocFromServer(doc(db, 'settings', 'config')),
          getDocFromServer(doc(db, 'settings', 'bays')),
        ]);
      } catch (directErr) {
        console.warn('Direct server get failed, falling back to cached getDocs:', directErr);
        [nursesSnap, machinesSnap, assignmentsSnap, settingsSnap, baysSnap] = await Promise.all([
          getDocs(collection(db, 'nurses')),
          getDocs(collection(db, 'machines')),
          getDocs(collection(db, 'assignments')),
          getDoc(doc(db, 'settings', 'config')),
          getDoc(doc(db, 'settings', 'bays')),
        ]);
      }

      let nLoaded = 0;
      let mLoaded = 0;
      let aLoaded = 0;

      if (!nursesSnap.empty) {
        const cloudNurses = nursesSnap.docs.map((d) => d.data() as Nurse);
        const validNurses = cloudNurses
          .filter((n) => !LEGACY_SAMPLE_NURSE_NAMES.has(n.name))
          .map((n) => ({
            ...n,
            nip: n.nip || '',
            phone: n.phone || '',
            specialDuty: n.specialDuty && n.specialDuty.trim() !== '' ? n.specialDuty.trim() : null,
            defaultOffDay: n.defaultOffDay !== undefined ? n.defaultOffDay : null,
            isPermanent: true,
          }));
        validNurses.sort((a, b) => a.id - b.id);
        if (validNurses.length > 0) {
          setNurses(validNurses);
          localStorage.setItem('hemo_nurses_v1', JSON.stringify(validNurses));
          localStorage.setItem('hemo_permanent_nurses_v1', JSON.stringify(validNurses));
          nLoaded = validNurses.length;
        }
      }

      if (!machinesSnap.empty) {
        const cloudMachines = machinesSnap.docs.map((d) => sanitizeMachineForFirestore(d.data() as Machine));
        cloudMachines.sort((a, b) => a.id - b.id);
        if (cloudMachines.length > 0) {
          setMachines(cloudMachines);
          localStorage.setItem('hemo_machines_v1', JSON.stringify(cloudMachines));
          mLoaded = cloudMachines.length;
        }
      }

      if (!assignmentsSnap.empty) {
        const cloudAssignments = assignmentsSnap.docs.map((d) => d.data() as ShiftAssignment);
        const validAssignments = cloudAssignments
          .filter((a) => !LEGACY_SAMPLE_NURSE_NAMES.has(a.nurseName))
          .map((a) => sanitizeAssignmentForFirestore(a));
        validAssignments.sort((a, b) => a.date.localeCompare(b.date));
        if (validAssignments.length > 0) {
          setAssignments(validAssignments);
          localStorage.setItem('hemo_assignments_v1', JSON.stringify(validAssignments));
          aLoaded = validAssignments.length;
        }
      }

      if (settingsSnap.exists()) {
        const sData = settingsSnap.data() as AppSettings;
        setSettings(sData);
        localStorage.setItem('hemo_settings_v1', JSON.stringify(sData));
      }

      if (baysSnap.exists()) {
        const bData = baysSnap.data();
        if (Array.isArray(bData.list)) {
          const deletedBays = new Set<string>(
            JSON.parse(localStorage.getItem('hemo_deleted_bays_v1') || '[]').map((b: string) => b.trim().toLowerCase())
          );
          const validBays = (bData.list as string[])
            .map((b) => (typeof b === 'string' ? b.trim() : ''))
            .filter((b) => Boolean(b) && !deletedBays.has(b.toLowerCase()));
          if (validBays.length > 0) {
            const unique = Array.from(new Set(validBays));
            setBays(unique);
            localStorage.setItem('hemo_custom_bays_v1', JSON.stringify(unique));
          }
        }
      }

      setIsCloudConnected(true);
      showToast(
        `Data Cloud berhasil ditarik: ${nLoaded} perawat, ${mLoaded} mesin, ${aLoaded} jadwal.`,
        'success'
      );
      return { success: true, nurses: nLoaded, machines: mLoaded, assignments: aLoaded };
    } catch (err) {
      console.error('fetchDataFromCloud error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource-exhausted')) {
        showToast(
          'Batas kuota harian Firebase telah tercapai. Data lokal tetap aman dan aktif. Gunakan tombol "Tarik Data dari Google Sheets" untuk sinkronisasi tanpa batasan kuota!',
          'error'
        );
      } else {
        showToast(`Gagal memuat data dari cloud: ${errMsg}`, 'error');
      }
      return { success: false, nurses: 0, machines: 0, assignments: 0 };
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <HemoContext.Provider
      value={{
        isAdmin: canManageRoster,
        nurses,
        machines,
        assignments,
        settings,
        selectedDate,
        selectedYear,
        selectedMonth,
        currentMonth,
        setCurrentMonth,
        dailyAssignments,
        monthlyAssignments,
        fairnessReport,
        isGenerating,
        isSyncing,
        isCloudConnected,
        isCloudLoaded,
        syncAllDataToCloud,
        fetchDataFromCloud,
        toastMessage,
        showToast,
        clearToast,
        selectDate,
        selectMonth,
        setShift,
        generateSchedule,
        generateMonthlySchedule,
        generateDailyMachineAllocation,
        reallocateMachinesForDate,
        reallocateMachinesForMonth,
        importScheduleAssignments,
        updateAssignment,
        addNurse,
        updateNurse,
        addOrUpdateNurse,
        deleteNurse,
        deleteNursePermanent,
        deleteAllNursesPermanent,
        clearAllNurses,
        clearDefaultNurses,
        loadSampleNurses,
        bays,
        addBay,
        deleteBay,
        addMachine,
        updateMachine,
        addOrUpdateMachine,
        updateBay,
        deleteMachine,
        loadDefaultMachines,
        toggleMachineStatus,
        setMachineStatus,
        setAllMachinesActive,
        updateSettings,
        markAssignmentWhatsAppSent,
        dispatchWhatsAppToNurse,
        dispatchGroupBroadcast,
        dispatchHeadNurseReport,
        syncToGoogleSheets,
        syncWithGoogleSheets,
        syncAllToGoogleSheets,
        fetchDataFromGoogleSheets,
        downloadCsv,
        copyTable,
        resetToInitialData,
        doctors,
        doctorDuties,
        addDoctor,
        updateDoctor,
        deleteDoctor,
        clearDefaultDoctors,
        clearAllDoctors,
        setDoctorDuty,
        getDoctorDutyForDate,
        dispatchDoctorWhatsApp,
      }}
    >
      {children}
    </HemoContext.Provider>
  );
};

export const useHemo = () => {
  const context = useContext(HemoContext);
  if (!context) {
    throw new Error('useHemo must be used within a HemoProvider');
  }
  return context;
};
