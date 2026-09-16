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

function simulateMonth(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const karuNurses = mockNurses.filter((n) => n.role === 'KARU');
  const nonKaruNurses = mockNurses.filter((n) => n.role !== 'KARU' && n.isActive);

  // Split month into blocks separated by Sunday
  const blocks: number[][] = [];
  let currentBlock: number[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    } else {
      currentBlock.push(d);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const pagiCount: Record<number, number> = {};
  const siangCount: Record<number, number> = {};
  mockNurses.forEach((n) => {
    pagiCount[n.id] = 0;
    siangCount[n.id] = 0;
  });

  const totalWorkingDaily = karuNurses.length + nonKaruNurses.length;
  const targetDailyPagi = Math.max(1, Math.ceil(totalWorkingDaily / 2));
  const targetNonKaruPagi = Math.max(0, targetDailyPagi - karuNurses.length);

  blocks.forEach((block, bIdx) => {
    // Karu always pagi
    karuNurses.forEach((k) => {
      pagiCount[k.id] += block.length;
    });

    // For non-Karu, sort by pagiCount ascending to give Pagi to those with fewest Pagi so far!
    // Also balance Katim / Senior leadership across Pagi & Siang
    const sortedNonKaru = [...nonKaruNurses].sort((a, b) => {
      const pDiff = (pagiCount[a.id] || 0) - (pagiCount[b.id] || 0);
      if (pDiff !== 0) return pDiff;
      return a.id - b.id;
    });

    const chosenPagiNonKaru = sortedNonKaru.slice(0, targetNonKaruPagi);
    const chosenSiangNonKaru = sortedNonKaru.slice(targetNonKaruPagi);

    chosenPagiNonKaru.forEach((n) => {
      pagiCount[n.id] += block.length;
    });
    chosenSiangNonKaru.forEach((n) => {
      siangCount[n.id] += block.length;
    });
  });

  console.log(`\nResults for ${year}-${month} (${daysInMonth} days, ${blocks.reduce((acc, b) => acc + b.length, 0)} workdays):`);
  mockNurses.forEach((n) => {
    console.log(`${n.name.padEnd(35)}: P = ${pagiCount[n.id]}, S = ${siangCount[n.id]}, Total = ${pagiCount[n.id] + siangCount[n.id]}`);
  });
}

simulateMonth(2026, 10); // 31 days (starts Thu)
simulateMonth(2026, 9);  // 30 days (starts Tue)
simulateMonth(2026, 2);  // 28 days (starts Sun)
