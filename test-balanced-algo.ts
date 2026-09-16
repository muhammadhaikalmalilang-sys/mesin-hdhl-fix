import { Nurse } from './src/types';

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

function testBalancedScheduler(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const karuNurses = mockNurses.filter((n) => n.role === 'KARU');
  const nonKaruNurses = mockNurses.filter((n) => n.role !== 'KARU' && n.isActive);

  // Calculate total workdays in month
  let workdaysCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0) workdaysCount++;
  }

  const pagiCount: Record<number, number> = {};
  const siangCount: Record<number, number> = {};
  const consecutiveShift: Record<number, { type: string; count: number }> = {};
  const lastShift: Record<number, string> = {};

  mockNurses.forEach((n) => {
    pagiCount[n.id] = 0;
    siangCount[n.id] = 0;
    consecutiveShift[n.id] = { type: 'NONE', count: 0 };
    lastShift[n.id] = 'LIBUR';
  });

  const totalWorkingDaily = karuNurses.length + nonKaruNurses.length;
  const targetDailyPagi = Math.max(1, Math.ceil(totalWorkingDaily / 2));
  const targetDailySiang = totalWorkingDaily - targetDailyPagi;
  const targetNonKaruPagi = Math.max(0, targetDailyPagi - karuNurses.length);

  // Ideal target per nurse:
  // For Karu: all workdays in Pagi
  // For non-Karu: workdaysCount * targetNonKaruPagi / nonKaruNurses.length
  const idealNonKaruPagi = (workdaysCount * targetNonKaruPagi) / nonKaruNurses.length;

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0) {
      // SUNDAY: All staff LIBUR
      mockNurses.forEach((n) => {
        lastShift[n.id] = 'LIBUR';
        consecutiveShift[n.id] = { type: 'LIBUR', count: 1 };
      });
      continue;
    }

    // WORKDAY:
    // Karu always PAGI
    karuNurses.forEach((k) => {
      pagiCount[k.id]++;
      lastShift[k.id] = 'PAGI';
    });

    // Score non-Karu nurses for PAGI assignment today:
    // We want to pick `targetNonKaruPagi` nurses for PAGI.
    // Higher score = better candidate for PAGI.
    const scoredNurses = nonKaruNurses.map((nurse) => {
      let score = 0;

      // 1. Deficit in Pagi shifts (strongest factor):
      // If nurse has fewer Pagi than Siang, boost score!
      const pCount = pagiCount[nurse.id] || 0;
      const sCount = siangCount[nurse.id] || 0;
      score += (sCount - pCount) * 100;

      // Target progress deficit
      score += (idealNonKaruPagi - pCount) * 50;

      // 2. Rest consideration:
      // If yesterday was LIBUR, no fatigue, very good for PAGI
      if (lastShift[nurse.id] === 'LIBUR') {
        score += 20;
      } else if (lastShift[nurse.id] === 'PAGI') {
        // Staying in PAGI (PAGI -> PAGI): 17h rest, very safe
        // But if already 3+ days of PAGI in a row, slightly encourage rotation
        if (consecutiveShift[nurse.id]?.type === 'PAGI' && consecutiveShift[nurse.id].count >= 3) {
          score -= 15;
        } else {
          score += 10;
        }
      } else if (lastShift[nurse.id] === 'SIANG') {
        // SIANG -> PAGI is a short rest (12h from 19:00 to 07:00).
        // Penalize it so we only do it if necessary to balance the month!
        score -= 40;
        // If nurse has been in SIANG for 3+ days, we really need to rotate them back to PAGI soon!
        if (consecutiveShift[nurse.id]?.type === 'SIANG' && consecutiveShift[nurse.id].count >= 3) {
          score += 25; // soften penalty after 3 days of Siang
        }
      }

      return { nurse, score };
    });

    // Sort descending by score
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

  console.log(`\n=== RESULTS FOR ${year}-${month} (${daysInMonth} days, ${workdaysCount} workdays, ideal Pagi ≈ ${idealNonKaruPagi.toFixed(1)}) ===`);
  nonKaruNurses.forEach((n) => {
    console.log(`${n.name.padEnd(35)}: P = ${pagiCount[n.id]}, S = ${siangCount[n.id]} (Diff: ${pagiCount[n.id] - siangCount[n.id]})`);
  });
}

testBalancedScheduler(2026, 10); // 31 days (27 workdays)
testBalancedScheduler(2026, 9);  // 30 days (26 workdays)
testBalancedScheduler(2026, 2);  // 28 days (24 workdays)
