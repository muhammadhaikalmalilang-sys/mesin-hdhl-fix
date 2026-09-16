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

function verifyMonth(year: number, month: number) {
  const assignments = FairSchedulerEngine.generateMonthlySchedule(year, month, mockNurses, mockMachines);
  const daysInMonth = new Date(year, month, 0).getDate();

  console.log(`\n======================================================`);
  console.log(`VERIFICATION FOR ${year}-${month} (${daysInMonth} DAYS)`);
  console.log(`======================================================`);

  // 1. Check Sunday = LIBUR
  let sundayNonLibur = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dow === 0) {
      const daily = assignments.filter((a) => a.date === dateStr);
      daily.forEach((a) => {
        if (a.shiftType !== 'LIBUR') sundayNonLibur++;
      });
    }
  }
  console.log(`Sunday 100% Libur: ${sundayNonLibur === 0 ? 'PASSED' : 'FAILED (' + sundayNonLibur + ')'}`);

  // 2. Check Mon-Sat = 0 LIBUR
  let workdayLibur = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dow !== 0) {
      const daily = assignments.filter((a) => a.date === dateStr);
      daily.forEach((a) => {
        if (a.shiftType === 'LIBUR') workdayLibur++;
      });
    }
  }
  console.log(`Mon-Sat 100% Work (0 Libur): ${workdayLibur === 0 ? 'PASSED' : 'FAILED (' + workdayLibur + ')'}`);

  // 3. Karu is ALWAYS PAGI on workdays
  const karu = mockNurses.find((n) => n.role === 'KARU')!;
  let karuWorkdayNonPagi = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dow !== 0) {
      const asg = assignments.find((a) => a.date === dateStr && a.nurseId === karu.id);
      if (!asg || asg.shiftType !== 'PAGI') karuWorkdayNonPagi++;
    }
  }
  console.log(`Karu All Workdays PAGI: ${karuWorkdayNonPagi === 0 ? 'PASSED' : 'FAILED'}`);

  // 4. Per-nurse Pagi vs Siang distribution:
  console.log('--- Shift Counts per Nurse ---');
  mockNurses.forEach((n) => {
    const p = assignments.filter((a) => a.nurseId === n.id && a.shiftType === 'PAGI').length;
    const s = assignments.filter((a) => a.nurseId === n.id && a.shiftType === 'SIANG').length;
    const l = assignments.filter((a) => a.nurseId === n.id && a.shiftType === 'LIBUR').length;
    const isK = n.role === 'KARU';
    console.log(
      `${n.name.padEnd(35)}: P = ${String(p).padStart(2)}, S = ${String(s).padStart(2)}, L = ${String(l).padStart(2)} (Diff: ${isK ? 'Karu' : Math.abs(p - s)})`
    );
  });
}

verifyMonth(2026, 10);
verifyMonth(2026, 9);
verifyMonth(2026, 2);
