import { Nurse, Machine, ShiftAssignment } from './src/types';

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

function runMonthlyEngine(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const activeNurses = mockNurses.filter((n) => n.isActive);
  const karuNurses = activeNurses.filter((n) => n.role === 'KARU');
  const nonKaruNurses = activeNurses.filter((n) => n.role !== 'KARU');

  let workdaysCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0) workdaysCount++;
  }

  const pagiCount: Record<number, number> = {};
  const siangCount: Record<number, number> = {};
  const consecutiveSameShift: Record<number, { shift: string; count: number }> = {};
  const lastShiftOfNurse: Record<number, string> = {};

  activeNurses.forEach((n) => {
    pagiCount[n.id] = 0;
    siangCount[n.id] = 0;
    consecutiveSameShift[n.id] = { shift: 'NONE', count: 0 };
    lastShiftOfNurse[n.id] = 'LIBUR';
  });

  const totalWorkingToday = karuNurses.length + nonKaruNurses.length;
  const targetDailyPagi = Math.max(1, Math.ceil(totalWorkingToday / 2));
  const targetDailySiang = totalWorkingToday - targetDailyPagi;
  const targetNonKaruPagi = Math.max(0, targetDailyPagi - karuNurses.length);
  const idealNonKaruPagi = (workdaysCount * targetNonKaruPagi) / Math.max(1, nonKaruNurses.length);

  let seed = 42;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0) {
      // SUNDAY
      activeNurses.forEach((n) => {
        lastShiftOfNurse[n.id] = 'LIBUR';
        consecutiveSameShift[n.id] = { shift: 'LIBUR', count: 1 };
      });
      continue;
    }

    // WORKDAY
    const selectedPagi: Nurse[] = [...karuNurses];
    const selectedSiang: Nurse[] = [];

    karuNurses.forEach((k) => {
      pagiCount[k.id] = (pagiCount[k.id] || 0) + 1;
      lastShiftOfNurse[k.id] = 'PAGI';
    });

    const scored = nonKaruNurses.map((nurse) => {
      let score = 0;
      const p = pagiCount[nurse.id] || 0;
      const s = siangCount[nurse.id] || 0;

      // Primary: shift balance (deficit of pagi vs siang)
      score += (s - p) * 100;

      // Secondary: deficit against monthly ideal
      score += (idealNonKaruPagi - p) * 50;

      // Rest & rotation factors:
      if (lastShiftOfNurse[nurse.id] === 'LIBUR') {
        score += 20;
      } else if (lastShiftOfNurse[nurse.id] === 'PAGI') {
        if (consecutiveSameShift[nurse.id]?.shift === 'PAGI' && consecutiveSameShift[nurse.id].count >= 3) {
          score -= 15; // after 3 days of pagi, gentle nudge to rotate to siang
        } else {
          score += 10;
        }
      } else if (lastShiftOfNurse[nurse.id] === 'SIANG') {
        score -= 40; // siang -> pagi is quick turnaround (12h)
        if (consecutiveSameShift[nurse.id]?.shift === 'SIANG' && consecutiveSameShift[nurse.id].count >= 3) {
          score += 25; // soften penalty so nurse doesn't get stuck in siang
        }
      }

      // Small jitter for fair tie-breaking
      score += (rnd() - 0.5) * 5;

      return { nurse, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const chosenPagiNonKaru = scored.slice(0, targetNonKaruPagi).map((x) => x.nurse);
    const chosenSiangNonKaru = scored.slice(targetNonKaruPagi).map((x) => x.nurse);

    selectedPagi.push(...chosenPagiNonKaru);
    selectedSiang.push(...chosenSiangNonKaru);

    // Leadership check for Siang
    const siangHasLeader = selectedSiang.some((n) => n.role === 'KATIM' || n.skillLevel === 'Senior');
    if (!siangHasLeader && selectedSiang.length > 0) {
      const leaderInPagiIdx = selectedPagi.findIndex(
        (n) => n.role !== 'KARU' && (n.role === 'KATIM' || n.skillLevel === 'Senior')
      );
      if (leaderInPagiIdx !== -1) {
        const juniorInSiangIdx = selectedSiang.findIndex((n) => n.skillLevel === 'Junior');
        if (juniorInSiangIdx !== -1) {
          const leaderNurse = selectedPagi.splice(leaderInPagiIdx, 1)[0];
          const juniorNurse = selectedSiang.splice(juniorInSiangIdx, 1)[0];
          selectedSiang.push(leaderNurse);
          selectedPagi.push(juniorNurse);
        }
      }
    }

    // Update counts & states
    chosenPagiNonKaru.forEach((n) => {
      pagiCount[n.id] = (pagiCount[n.id] || 0) + 1;
      if (lastShiftOfNurse[n.id] === 'PAGI') {
        consecutiveSameShift[n.id] = { shift: 'PAGI', count: (consecutiveSameShift[n.id]?.count || 0) + 1 };
      } else {
        consecutiveSameShift[n.id] = { shift: 'PAGI', count: 1 };
      }
      lastShiftOfNurse[n.id] = 'PAGI';
    });

    chosenSiangNonKaru.forEach((n) => {
      siangCount[n.id] = (siangCount[n.id] || 0) + 1;
      if (lastShiftOfNurse[n.id] === 'SIANG') {
        consecutiveSameShift[n.id] = { shift: 'SIANG', count: (consecutiveSameShift[n.id]?.count || 0) + 1 };
      } else {
        consecutiveSameShift[n.id] = { shift: 'SIANG', count: 1 };
      }
      lastShiftOfNurse[n.id] = 'SIANG';
    });
  }

  console.log(`\nMonth ${year}-${month} (${workdaysCount} workdays, Target non-Karu Pagi ≈ ${idealNonKaruPagi.toFixed(1)}):`);
  activeNurses.forEach((n) => {
    const isK = n.role === 'KARU';
    console.log(
      `${n.name.padEnd(35)}: P = ${String(pagiCount[n.id]).padStart(2)}, S = ${String(siangCount[n.id]).padStart(2)} (Diff: ${isK ? 'Karu (All Pagi)' : Math.abs(pagiCount[n.id] - siangCount[n.id])})`
    );
  });
}

runMonthlyEngine(2026, 10);
runMonthlyEngine(2026, 9);
runMonthlyEngine(2026, 2);
