import { FairSchedulerEngine } from './src/domain/FairSchedulerEngine';
import { Nurse, Machine } from './src/types';

const mockNurses: Nurse[] = [
  { id: 1, name: 'Ns. Siti Rahma, S.Kep (Karu)', role: 'KARU', skillLevel: 'Senior', isActive: true },
  { id: 2, name: 'Ns. Ahmad Fauzi, S.Kep (Katim)', role: 'KATIM', skillLevel: 'Senior', isActive: true },
  { id: 3, name: 'Ns. Dewi Lestari, Amd.Kep (Katim)', role: 'KATIM', skillLevel: 'Senior', isActive: true },
  { id: 4, name: 'Ns. Budi Santoso, Amd.Kep', role: 'PELAKSANA', skillLevel: 'Senior', isActive: true },
  { id: 5, name: 'Ns. Rina Wati, S.Kep', role: 'PELAKSANA', skillLevel: 'Senior', isActive: true },
  { id: 6, name: 'Ns. Hendra Wijaya, Amd.Kep', role: 'PELAKSANA', skillLevel: 'Junior', isActive: true },
  { id: 7, name: 'Ns. Maya Indah, Amd.Kep', role: 'PELAKSANA', skillLevel: 'Junior', isActive: true },
  { id: 8, name: 'Ns. Rizky Pratama, S.Kep', role: 'PELAKSANA', skillLevel: 'Junior', isActive: true },
  { id: 9, name: 'Ns. Dian Anggraini, Amd.Kep', role: 'PELAKSANA', skillLevel: 'Junior', isActive: true },
  { id: 10, name: 'Ns. Eko Prasetyo, Amd.Kep', role: 'PELAKSANA', skillLevel: 'Junior', isActive: true },
  { id: 11, name: 'Ns. Fitriani, Amd.Kep', role: 'PELAKSANA', skillLevel: 'Junior', isActive: true },
  { id: 12, name: 'Ns. Gilang Ramadhan, S.Kep', role: 'PELAKSANA', skillLevel: 'Junior', isActive: true },
];

const mockMachines: Machine[] = Array.from({ length: 24 }, (_, i) => ({
  id: `M${String(i + 1).padStart(2, '0')}`,
  name: `Mesin HD ${i + 1}`,
  bay: `Bay ${Math.floor(i / 6) + 1}`,
  status: 'AKTIF',
  isIsolation: i === 23,
  assignedNurseId: null,
}));

const assignments = FairSchedulerEngine.generateMonthlySchedule(2026, 10, mockNurses, mockMachines);

console.log('NURSE MONTHLY SHIFT COUNTS:');
mockNurses.forEach((n) => {
  const p = assignments.filter((a) => a.nurseId === n.id && a.shiftType === 'PAGI').length;
  const s = assignments.filter((a) => a.nurseId === n.id && a.shiftType === 'SIANG').length;
  const l = assignments.filter((a) => a.nurseId === n.id && a.shiftType === 'LIBUR').length;
  console.log(`${n.name.padEnd(35)}: PAGI = ${p}, SIANG = ${s}, LIBUR = ${l}, TOTAL WORK = ${p + s}`);
});
