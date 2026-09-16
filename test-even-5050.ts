import { Nurse } from './src/types';

// Test with 10 non-Karu + 1 Karu = 11 nurses
// Daily: 5 non-Karu in Pagi, 5 non-Karu in Siang (Exact 50:50 daily!)
const mock10NonKaru: Nurse[] = [
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
];

function testEvenDaily(nurses: Nurse[], year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const karuNurses = nurses.filter((n) => n.role === 'KARU');
  const nonKaruNurses = nurses.filter((n) => n.role !== 'KARU' && n.isActive);

  let workdaysCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0) workdaysCount++;
  }

  const pagiCount: Record<number, number> = {};
  const siangCount: Record<number, number> = {};
  const consecutiveShift: Record<number, { type: string; count: number }> = {};
  const lastShift: Record<number, string> = {};

  nurses.forEach((n) => {
    pagiCount[n.id] = 0;
    siangCount[n.id] = 0;
    consecutiveShift[n.id] = { type: 'NONE', count: 0 };
    lastShift[n.id] = 'LIBUR';
  });

  // Balanced 50:50 daily for non-Karu:
  const targetNonKaruPagi = Math.floor(nonKaruNurses.length / 2);
  const targetNonKaruSiang = nonKaruNurses.length - targetNonKaruPagi;
  const idealNonKaruPagi = (workdaysCount * targetNonKaruPagi) / nonKaruNurses.length;

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0) {
      nurses.forEach((n) => {
        lastShift[n.id] = 'LIBUR';
        consecutiveShift[n.id] = { type: 'LIBUR', count: 1 };
      });
      continue;
    }

    // Karu always PAGI
    karuNurses.forEach((k) => {
      pagiCount[k.id]++;
      lastShift[k.id] = 'PAGI';
    });

    const scoredNurses = nonKaruNurses.map((nurse) => {
      let score = 0;
      const pCount = pagiCount[nurse.id] || 0;
      const sCount = siangCount[nurse.id] || 0;
      score += (sCount - pCount) * 100;
      score += (idealNonKaruPagi - pCount) * 50;

      if (lastShift[nurse.id] === 'LIBUR') {
        score += 20;
      } else if (lastShift[nurse.id] === 'PAGI') {
        if (consecutiveShift[nurse.id]?.type === 'PAGI' && consecutiveShift[nurse.id].count >= 3) {
          score -= 15;
        } else {
          score += 10;
        }
      } else if (lastShift[nurse.id] === 'SIANG') {
        score -= 40;
        if (consecutiveShift[nurse.id]?.type === 'SIANG' && consecutiveShift[nurse.id].count >= 3) {
          score += 25;
        }
      }

      return { nurse, score };
    });

    scoredNurses.sort((a, b) => b.score - a.score || a.nurse.id - b.nurse.id);

    const chosenPagi = scoredNurses.slice(0, targetNonKaruPagi).map((x) => x.nurse);
    const chosenSiang = scoredNurses.slice(targetNonKaruPagi).map((x) => x.nurse);

    chosenPagi.forEach((n) => {
      pagiCount[n.id]++;
      if (lastShift[n.id] === 'PAGI') {
        consecutiveShift[n.id] = { type: 'PAGI', count: (consecutiveShift[n.id]?.count || 0) + 1 };
      } else {
        consecutiveShift[n.id] = { type: 'PAGI', count: 1 };
      }
      lastShift[n.id] = 'PAGI';
    });

    chosenSiang.forEach((n) => {
      siangCount[n.id]++;
      if (lastShift[n.id] === 'SIANG') {
        consecutiveShift[n.id] = { type: 'SIANG', count: (consecutiveShift[n.id]?.count || 0) + 1 };
      } else {
        consecutiveShift[n.id] = { type: 'SIANG', count: 1 };
      }
      lastShift[n.id] = 'SIANG';
    });
  }

  console.log(`\n=== 10 NURSES 50:50 TEST FOR ${year}-${month} (${workdaysCount} workdays) ===`);
  nonKaruNurses.forEach((n) => {
    console.log(`${n.name.padEnd(35)}: P = ${pagiCount[n.id]}, S = ${siangCount[n.id]} (Diff: ${pagiCount[n.id] - siangCount[n.id]})`);
  });
}

testEvenDaily(mock10NonKaru, 2026, 9); // 26 workdays
testEvenDaily(mock10NonKaru, 2026, 10); // 27 workdays
