import { Machine, Nurse, ShiftAssignment, SHIFT_TYPE_INFO, MachineCategory, MachineStatus, NurseRole, Doctor, DoctorShiftDuty } from '../types';

export interface SyncResult {
  isSuccess: boolean;
  message: string;
  rowsSynced?: number;
}

export interface GoogleSheetsSyncAllResult {
  isSuccess: boolean;
  message: string;
  nursesCount?: number;
  machinesCount?: number;
  assignmentsCount?: number;
  doctorsCount?: number;
  doctorDutiesCount?: number;
}

export interface GoogleSheetsFetchResult {
  isSuccess: boolean;
  message: string;
  nurses: Nurse[];
  machines: Machine[];
  bays?: string[];
  assignments: ShiftAssignment[];
  doctors?: Doctor[];
  doctorDuties?: Record<string, DoctorShiftDuty>;
}

export class GoogleSheetsService {
  /**
   * Generates a calendar matrix matching the Excel (.xlsx) format:
   * Columns: No, Nama Perawat, NIP, Peran, 1, 2, ..., 31, Pagi (P), Siang (S), Libur (L), Cuti (C), Sakit (SK), Total Jaga
   */
  static buildScheduleMatrix(
    monthString: string,
    nurses: Nurse[],
    assignments: ShiftAssignment[]
  ) {
    const parts = monthString.split('-');
    const year = parseInt(parts[0], 10) || new Date().getFullYear();
    const month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    const activeNurses = nurses.filter((n) => n.isActive);
    const headers = ['No', 'Nama Perawat', 'NIP', 'Peran'];
    for (let d = 1; d <= daysInMonth; d++) {
      headers.push(String(d));
    }
    headers.push('Pagi (P)', 'Siang (S)', 'Libur (L)', 'Cuti (C)', 'Sakit (SK)', 'Total Jaga');

    const rows = activeNurses.map((nurse, idx) => {
      let countP = 0;
      let countS = 0;
      let countL = 0;
      let countC = 0;
      let countSk = 0;

      const roleLabel =
        nurse.role === 'KARU' ? 'Karu' : nurse.role === 'KATIM' ? 'Katim' : 'Pelaksana';

      const row: (string | number)[] = [
        idx + 1,
        nurse.name,
        nurse.nip || '-',
        roleLabel,
      ];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const asg = assignments.find((a) => a.date === dateStr && a.nurseId === nurse.id);
        const code = asg ? (SHIFT_TYPE_INFO[asg.shiftType]?.code || 'L') : 'L';
        if (code === 'P') countP++;
        else if (code === 'S') countS++;
        else if (code === 'L') countL++;
        else if (code === 'C') countC++;
        else if (code === 'SK') countSk++;
        row.push(code);
      }

      row.push(countP, countS, countL, countC, countSk, countP + countS);
      return row;
    });

    return {
      year,
      month,
      monthString,
      daysInMonth,
      headers,
      rows,
    };
  }

  /**
   * Fetches Nurses, Machines, Bays, and Schedules directly from Google Apps Script Web App.
   * Works on any device without Firebase quota limits.
   */
  static async fetchDataFromGoogleSheets(
    webhookUrl: string,
    targetMonth?: string
  ): Promise<GoogleSheetsFetchResult> {
    if (!webhookUrl || webhookUrl.trim() === '') {
      return {
        isSuccess: false,
        message: 'URL Google Apps Script belum diisi. Silakan masukkan Web App URL di tab Laporan & Sync.',
        nurses: [],
        machines: [],
        assignments: [],
      };
    }

    const trimmedUrl = webhookUrl.trim();
    if (trimmedUrl.includes('docs.google.com/spreadsheets/d/') && !trimmedUrl.includes('/exec')) {
      return {
        isSuccess: false,
        message:
          'URL yang dimasukkan adalah link Spreadsheet Google biasa. Untuk integrasi otomatis 2-arah, silakan pasang script dan gunakan URL Web App dari Google Apps Script (berakhiran /exec). Silakan klik "Panduan Setup".',
        nurses: [],
        machines: [],
        assignments: [],
      };
    }

    try {
      // Append query param action=GET_ALL and target month if available
      const separator = trimmedUrl.includes('?') ? '&' : '?';
      const monthParam = targetMonth ? `&month=${encodeURIComponent(targetMonth)}` : '';
      const fetchUrl = `${trimmedUrl}${separator}action=GET_ALL${monthParam}&t=${Date.now()}`;

      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server Google Apps Script mengembalikan status: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'error') {
        throw new Error(data.message || 'Google Apps Script melaporkan error.');
      }

      // Parse and validate nurses
      const rawNurses = Array.isArray(data.nurses) ? data.nurses : [];
      const parsedNurses: Nurse[] = rawNurses
        .map((rn: any, idx: number) => {
          if (!rn || (!rn.name && !rn.nama)) return null;
          const name = String(rn.name || rn.nama || '').trim();
          if (!name) return null;
          const roleRaw = String(rn.role || rn.peran || 'PELAKSANA').toUpperCase();
          const role: NurseRole = roleRaw.includes('KARU')
            ? 'KARU'
            : roleRaw.includes('KATIM') || roleRaw.includes('PJ')
            ? 'KATIM'
            : 'PELAKSANA';

          return {
            id: Number(rn.id) || 1000 + idx,
            name,
            nip: String(rn.nip || '').trim(),
            phone: String(rn.phone || rn.noWhatsApp || rn.noWa || '').trim(),
            role,
            isActive: rn.isActive !== undefined ? Boolean(rn.isActive) : true,
            skillLevel: (rn.skillLevel || 'Senior') as 'Senior' | 'Medium' | 'Junior',
            specialDuty: rn.specialDuty ? String(rn.specialDuty).trim() : null,
            defaultOffDay: rn.defaultOffDay !== undefined && rn.defaultOffDay !== null ? Number(rn.defaultOffDay) : null,
            isPermanent: true,
          };
        })
        .filter((n: unknown): n is Nurse => Boolean(n));

      // Parse and validate machines
      const rawMachines = Array.isArray(data.machines) ? data.machines : [];
      const parsedMachines: Machine[] = rawMachines
        .map((rm: any, idx: number) => {
          if (!rm || (!rm.code && !rm.kode)) return null;
          const code = String(rm.code || rm.kode || '').trim().toUpperCase();
          const name = String(rm.name || rm.nama || `Mesin ${code}`).trim();
          const bay = String(rm.bay || rm.ruangan || 'Bay A (Reguler)').trim();
          const catRaw = String(rm.category || rm.kategori || 'REGULER').toUpperCase();
          const statusRaw = String(rm.status || 'AKTIF').toUpperCase();

          const category: MachineCategory =
            catRaw.includes('HEPATITIS_B') || catRaw.includes('HEPB')
              ? 'HEPATITIS_B'
              : catRaw.includes('HEPATITIS_C') || catRaw.includes('HEPC')
              ? 'HEPATITIS_C'
              : catRaw.includes('ISOLASI')
              ? 'ISOLASI'
              : 'REGULER';

          const status: MachineStatus = statusRaw.includes('RUSAK')
            ? 'RUSAK'
            : statusRaw.includes('MAINTENANCE')
            ? 'MAINTENANCE'
            : 'AKTIF';

          return {
            id: Number(rm.id) || idx + 1,
            code,
            name,
            bay,
            category,
            status,
            brandModel: String(rm.brandModel || rm.brand || '').trim(),
            notes: String(rm.notes || rm.catatan || '').trim(),
          };
        })
        .filter((m: unknown): m is Machine => Boolean(m));

      // Parse bays
      const rawBays = Array.isArray(data.bays) ? data.bays : [];
      const parsedBays: string[] = rawBays
        .map((b: any) => (typeof b === 'string' ? b.trim() : typeof b?.name === 'string' ? b.name.trim() : ''))
        .filter(Boolean);

      // Parse assignments
      const rawAssignments = Array.isArray(data.assignments) ? data.assignments : [];
      const parsedAssignments: ShiftAssignment[] = rawAssignments
        .map((ra: any, idx: number) => {
          if (!ra || !ra.date || (!ra.nurseName && !ra.nurseId)) return null;
          let assignedMachineIds: number[] = [];
          if (Array.isArray(ra.assignedMachineIds)) {
            assignedMachineIds = ra.assignedMachineIds.map((id: any) => Number(id)).filter((id: number) => !isNaN(id));
          } else if (Array.isArray(ra.machines)) {
            // Map machine codes to machine ids if available
            assignedMachineIds = ra.machines
              .map((code: string) => parsedMachines.find((m) => m.code.toUpperCase() === String(code).trim().toUpperCase())?.id)
              .filter((id: any): id is number => typeof id === 'number');
          } else if (typeof ra.machines === 'string' && ra.machines.trim()) {
            const codes = ra.machines.split(/[,;\s]+/).map((s: string) => s.trim().toUpperCase());
            assignedMachineIds = codes
              .map((code: string) => parsedMachines.find((m) => m.code.toUpperCase() === code)?.id)
              .filter((id: any): id is number => typeof id === 'number');
          }

          const shiftRaw = String(ra.shiftType || ra.shiftCode || 'LIBUR').toUpperCase();
          const shiftType = shiftRaw.includes('PAGI') || shiftRaw === 'P'
            ? 'PAGI'
            : (shiftRaw.includes('SIANG') || shiftRaw === 'S') && !shiftRaw.includes('SAKIT') && shiftRaw !== 'SK'
            ? 'SIANG'
            : shiftRaw.includes('CUTI') || shiftRaw === 'C'
            ? 'CUTI'
            : shiftRaw.includes('SAKIT') || shiftRaw === 'SK'
            ? 'SAKIT'
            : 'LIBUR';

          // Link with nurse record if nurseId is missing or default
          const matchedNurse = parsedNurses.find(
            (n) => n.name.toLowerCase() === String(ra.nurseName || '').trim().toLowerCase() || n.id === Number(ra.nurseId)
          );

          return {
            id: String(ra.id || `${ra.date}-${ra.nurseId || idx}`),
            date: String(ra.date).trim(),
            shiftType,
            nurseId: matchedNurse ? matchedNurse.id : (Number(ra.nurseId) || idx),
            nurseName: matchedNurse ? matchedNurse.name : String(ra.nurseName || '').trim(),
            nursePhone: matchedNurse ? matchedNurse.phone : String(ra.nursePhone || '').trim(),
            assignedMachineIds,
            isLeader: Boolean(ra.isLeader || (matchedNurse && (matchedNurse.role === 'KATIM' || matchedNurse.role === 'KARU'))),
            isWhatsAppSent: Boolean(ra.isWhatsAppSent),
            notes: String(ra.notes || '').trim(),
            specialDuty: ra.specialDuty ? String(ra.specialDuty).trim() : (matchedNurse ? matchedNurse.specialDuty : null),
          };
        })
        .filter((a: unknown): a is ShiftAssignment => Boolean(a));

      // Parse and validate doctors
      const rawDoctors = Array.isArray(data.doctors) ? data.doctors : [];
      const parsedDoctors: Doctor[] = rawDoctors
        .map((rd: any, idx: number) => {
          if (!rd || (!rd.name && !rd.nama)) return null;
          const name = String(rd.name || rd.nama || '').trim();
          if (!name) return null;
          const roleRaw = String(rd.role || rd.peran || 'DOKTER_RUANGAN').toUpperCase();
          const role = roleRaw.includes('DPJP') ? 'DPJP' : 'DOKTER_RUANGAN';

          return {
            id: Number(rd.id) || 1000 + idx,
            name,
            sip: String(rd.sip || '').trim(),
            phone: String(rd.phone || rd.noWhatsApp || rd.noWa || '').trim(),
            role,
            specialization: String(rd.specialization || rd.spesialisasi || '').trim(),
            isActive: rd.isActive !== undefined ? Boolean(rd.isActive) : true,
          };
        })
        .filter((d: unknown): d is Doctor => Boolean(d));

      // Parse and validate doctor duties
      const rawDuties = Array.isArray(data.doctorDuties) ? data.doctorDuties : [];
      const parsedDoctorDuties: Record<string, DoctorShiftDuty> = {};
      rawDuties.forEach((dd: any) => {
        if (dd && dd.date) {
          const dStr = String(dd.date).trim();
          parsedDoctorDuties[dStr] = {
            date: dStr,
            pagiDoctorId: dd.pagiDoctorId ? Number(dd.pagiDoctorId) : null,
            pagiDoctorName: dd.pagiDoctorName && dd.pagiDoctorName !== '-' ? String(dd.pagiDoctorName).trim() : undefined,
            siangDoctorId: dd.siangDoctorId ? Number(dd.siangDoctorId) : null,
            siangDoctorName: dd.siangDoctorName && dd.siangDoctorName !== '-' ? String(dd.siangDoctorName).trim() : undefined,
            notes: String(dd.notes || '').trim(),
          };
        }
      });

      const docSummary = parsedDoctors.length > 0 ? `, ${parsedDoctors.length} dokter jaga` : '';

      return {
        isSuccess: true,
        message: `Berhasil menarik ${parsedNurses.length} perawat, ${parsedMachines.length} mesin, ${parsedAssignments.length} jadwal perawat${docSummary} dari Google Sheets!`,
        nurses: parsedNurses,
        machines: parsedMachines,
        bays: parsedBays,
        assignments: parsedAssignments,
        doctors: parsedDoctors,
        doctorDuties: parsedDoctorDuties,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        isSuccess: false,
        message: `Gagal memuat data dari Google Sheets: ${errorMsg}`,
        nurses: [],
        machines: [],
        assignments: [],
      };
    }
  }

  /**
   * Helper to build a comprehensive daily list for doctor duties across the whole month.
   */
  static buildDoctorDutiesList(
    monthString: string,
    doctorDuties?: Record<string, DoctorShiftDuty>,
    doctors?: Doctor[]
  ) {
    const [yStr, mStr] = monthString.split('-');
    const year = parseInt(yStr, 10) || new Date().getFullYear();
    const month = parseInt(mStr, 10) || (new Date().getMonth() + 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const indonesianDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const docList = doctors || [];

    const list = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayObj = new Date(year, month - 1, d);
      const dayName = indonesianDays[dayObj.getDay()];
      const duty = doctorDuties ? doctorDuties[dateStr] : undefined;

      const pagiDoc =
        duty?.pagiDoctorName ||
        (duty?.pagiDoctorId ? docList.find((doc) => doc.id === duty.pagiDoctorId)?.name : '-') ||
        '-';
      const siangDoc =
        duty?.siangDoctorName ||
        (duty?.siangDoctorId ? docList.find((doc) => doc.id === duty.siangDoctorId)?.name : '-') ||
        '-';

      list.push({
        date: dateStr,
        dayName,
        dayNumber: d,
        pagiDoctorId: duty?.pagiDoctorId || '',
        pagiDoctorName: pagiDoc,
        siangDoctorId: duty?.siangDoctorId || '',
        siangDoctorName: siangDoc,
        notes: duty?.notes || '',
      });
    }
    return list;
  }

  /**
   * Sends ALL master data (Nurses, Machines, Bays, Doctors) and active schedules directly to Google Sheets.
   * Generates both the calendar matrix (template .xlsx format), machine detail logs, and doctor duties.
   */
  static async syncAllToGoogleSheets(
    webhookUrl: string,
    monthString: string,
    nurses: Nurse[],
    machines: Machine[],
    assignments: ShiftAssignment[],
    bays: string[],
    doctors?: Doctor[],
    doctorDuties?: Record<string, DoctorShiftDuty>
  ): Promise<GoogleSheetsSyncAllResult> {
    if (!webhookUrl || webhookUrl.trim() === '') {
      return {
        isSuccess: false,
        message: 'URL Webhook Google Apps Script belum diisi. Silakan masukkan URL di tab Laporan & Sync.',
      };
    }

    try {
      const matrixData = this.buildScheduleMatrix(monthString, nurses, assignments);
      const dutiesList = this.buildDoctorDutiesList(monthString, doctorDuties, doctors);

      const payload = {
        action: 'SYNC_ALL',
        month: monthString,
        syncTimestamp: Date.now(),
        bays: bays || [],
        scheduleMatrix: matrixData,
        nurses: nurses.map((n) => ({
          id: n.id,
          name: n.name,
          nip: n.nip || '',
          phone: n.phone || '',
          role: n.role,
          isActive: n.isActive,
          skillLevel: n.skillLevel,
          specialDuty: n.specialDuty || '',
          defaultOffDay: n.defaultOffDay !== undefined ? n.defaultOffDay : '',
        })),
        machines: machines.map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          bay: m.bay,
          category: m.category,
          status: m.status,
          brandModel: m.brandModel || '',
          notes: m.notes || '',
        })),
        assignments: assignments.map((a) => {
          const mCodes = (a.assignedMachineIds || [])
            .map((mId) => machines.find((m) => m.id === mId)?.code)
            .filter(Boolean);
          return {
            id: a.id,
            date: a.date,
            shiftType: SHIFT_TYPE_INFO[a.shiftType]?.label || a.shiftType,
            shiftCode: SHIFT_TYPE_INFO[a.shiftType]?.code || a.shiftType,
            nurseId: a.nurseId,
            nurseName: a.nurseName,
            isLeader: a.isLeader,
            machines: mCodes,
            machineCount: a.assignedMachineIds?.length || 0,
            notes: a.notes || '',
            specialDuty: a.specialDuty || '',
          };
        }),
        doctors: (doctors || []).map((doc) => ({
          id: doc.id,
          name: doc.name,
          sip: doc.sip || '',
          phone: doc.phone || '',
          role: doc.role,
          specialization: doc.specialization || '',
          isActive: doc.isActive !== false,
        })),
        doctorDuties: dutiesList,
      };

      const response = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok || response.type === 'opaque') {
        const docMsg = doctors && doctors.length > 0 ? ` & ${doctors.length} dokter jaga` : '';
        return {
          isSuccess: true,
          message: `Berhasil mengekspor format matriks kalender (.xlsx), ${assignments.length} jadwal perawat${docMsg} ke Google Sheets!`,
          nursesCount: nurses.length,
          machinesCount: machines.length,
          assignmentsCount: assignments.length,
          doctorsCount: doctors?.length || 0,
          doctorDutiesCount: dutiesList.length,
        };
      } else {
        return {
          isSuccess: false,
          message: `Google Sheets mengembalikan status: ${response.status} ${response.statusText}`,
        };
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      return {
        isSuccess: false,
        message: `Gagal menghubungi Google Sheet: ${errorMsg}`,
      };
    }
  }

  /**
   * Sends the monthly schedule payload directly to Google Apps Script Webhook.
   * Generates both the calendar matrix (template .xlsx format) and machine detail logs.
   */
  static async syncToGoogleSheets(
    webhookUrl: string,
    monthString: string,
    nurses: Nurse[],
    machines: Machine[],
    assignments: ShiftAssignment[],
    doctors?: Doctor[],
    doctorDuties?: Record<string, DoctorShiftDuty>
  ): Promise<SyncResult> {
    if (!webhookUrl || webhookUrl.trim() === '') {
      return {
        isSuccess: false,
        message: 'URL Webhook Google Apps Script belum diisi. Silakan masukkan URL di tab Laporan & Sync.',
      };
    }

    try {
      const matrixData = this.buildScheduleMatrix(monthString, nurses, assignments);
      const dutiesList = this.buildDoctorDutiesList(monthString, doctorDuties, doctors);

      const payload = {
        action: 'SYNC_SCHEDULE',
        month: monthString,
        syncTimestamp: Date.now(),
        scheduleMatrix: matrixData,
        nurses: nurses.map((n) => ({
          id: n.id,
          name: n.name,
          nip: n.nip,
          phone: n.phone,
          role: n.role,
        })),
        machines: machines.map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          bay: m.bay,
          category: m.category,
        })),
        assignments: assignments.map((a) => {
          const mCodes = (a.assignedMachineIds || [])
            .map((mId) => machines.find((m) => m.id === mId)?.code)
            .filter(Boolean);
          return {
            id: a.id,
            date: a.date,
            shiftType: SHIFT_TYPE_INFO[a.shiftType]?.label || a.shiftType,
            shiftCode: SHIFT_TYPE_INFO[a.shiftType]?.code || a.shiftType,
            nurseId: a.nurseId,
            nurseName: a.nurseName,
            isLeader: a.isLeader,
            machines: mCodes,
            machineCount: a.assignedMachineIds?.length || 0,
            notes: a.notes,
          };
        }),
        doctors: (doctors || []).map((doc) => ({
          id: doc.id,
          name: doc.name,
          sip: doc.sip || '',
          phone: doc.phone || '',
          role: doc.role,
          specialization: doc.specialization || '',
          isActive: doc.isActive !== false,
        })),
        doctorDuties: dutiesList,
      };

      // Since Google Apps Script Webhooks typically redirect with 302, mode 'no-cors' or standard POST
      const response = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok || response.type === 'opaque') {
        return {
          isSuccess: true,
          message: `Berhasil sinkronisasi format matriks kalender (.xlsx), ${assignments.length} jadwal perawat & jadwal dokter ke Google Sheets!`,
          rowsSynced: assignments.length,
        };
      } else {
        return {
          isSuccess: false,
          message: `Google Sheets mengembalikan status: ${response.status} ${response.statusText}`,
        };
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      return {
        isSuccess: false,
        message: `Gagal menghubungi Google Sheet: ${errorMsg}`,
      };
    }
  }

  /**
   * Generates CSV format representing the monthly schedule & machine allocations.
   */
  static generateCsv(assignments: ShiftAssignment[], machines: Machine[]): string {
    const rows: string[] = [];
    rows.push('Tanggal,Sif,Kode Sif,Nama Perawat,Peran,No WhatsApp,Alokasi Mesin HD,Jumlah Mesin,Status Notifikasi,Catatan');

    assignments.forEach((a) => {
      const machineCodes = (a.assignedMachineIds || [])
        .map((id) => machines.find((m) => m.id === id)?.code)
        .filter(Boolean)
        .join(';');

      const leaderStr = a.isLeader ? 'PJ Sif' : 'Pelaksana';
      const waStatus = a.isWhatsAppSent ? 'Terkirim' : 'Belum';
      const shiftLabel = SHIFT_TYPE_INFO[a.shiftType]?.label || a.shiftType;
      const shiftCode = SHIFT_TYPE_INFO[a.shiftType]?.code || a.shiftType;

      rows.push(
        `"${a.date}","${shiftLabel}","${shiftCode}","${a.nurseName}","${leaderStr}","${a.nursePhone}","${machineCodes}",${a.assignedMachineIds?.length || 0},"${waStatus}","${a.notes || ''}"`
      );
    });

    return rows.join('\n');
  }

  /**
   * Triggers browser download of CSV file.
   */
  static downloadCsvFile(monthStr: string, assignments: ShiftAssignment[], machines: Machine[]): void {
    const csvContent = this.generateCsv(assignments, machines);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Jadwal_HD_${monthStr.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exports monthly schedule matrix to CSV.
   */
  static exportMonthlyScheduleToCSV(monthStr: string, nurses: Nurse[], assignments: ShiftAssignment[]): void {
    const activeNurses = nurses.filter((n) => n.isActive);
    const parts = monthStr.split('-');
    const year = parseInt(parts[0], 10) || new Date().getFullYear();
    const month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    const headers = ['Nama Perawat', 'Jabatan'];
    for (let d = 1; d <= daysInMonth; d++) {
      headers.push(String(d));
    }
    headers.push('Total Sif');

    const rows = [headers.join(',')];

    activeNurses.forEach((nurse) => {
      let totalWork = 0;
      const row = [`"${nurse.name}"`, `"${nurse.role}"`];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const assignment = assignments.find((a) => a.date === dateStr && a.nurseId === nurse.id);
        const code = assignment ? SHIFT_TYPE_INFO[assignment.shiftType]?.code || assignment.shiftType : 'L';
        if (assignment && (assignment.shiftType === 'PAGI' || assignment.shiftType === 'SIANG')) {
          totalWork++;
        }
        row.push(`"${code}"`);
      }
      row.push(String(totalWork));
      rows.push(row.join(','));
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Jadwal_Matriks_HD_${monthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Copies TSV table to Clipboard for pasting directly into Google Sheets / Excel.
   */
  static async copyTableToClipboard(assignments: ShiftAssignment[], machines: Machine[]): Promise<boolean> {
    const rows: string[] = [];
    rows.push('Tanggal\tSif\tNama Perawat\tPeran\tAlokasi Mesin HD\tJumlah Mesin\tNo WhatsApp\tCatatan');

    assignments.forEach((a) => {
      const machineCodes = (a.assignedMachineIds || [])
        .map((id) => machines.find((m) => m.id === id)?.code)
        .filter(Boolean)
        .join(', ');
      const leaderStr = a.isLeader ? 'PJ Sif' : 'Pelaksana';
      const shiftLabel = SHIFT_TYPE_INFO[a.shiftType]?.label || a.shiftType;

      rows.push(`${a.date}\t${shiftLabel}\t${a.nurseName}\t${leaderStr}\t${machineCodes}\t${a.assignedMachineIds?.length || 0}\t${a.nursePhone}\t${a.notes || ''}`);
    });

    try {
      await navigator.clipboard.writeText(rows.join('\n'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ready-to-use Google Apps Script code for 2-Way Sync (GET & POST).
   * Generates calendar matrix format matching .xlsx template with automatic conditional colors.
   */
  static getGoogleAppsScriptTemplate(): string {
    return `// =============================================================================
// GOOGLE APPS SCRIPT WEBHOOK 2-ARAH UNTUK HEMOSHIFT HD
// Format Matriks Jadwal .xlsx (Kalender Bulanan) & Sinkronisasi Master HD
// =============================================================================
// CARA PEMASANGAN:
// 1. Buat Spreadsheet baru di Google Sheets (buka https://sheets.new)
// 2. Di menu atas, klik 'Extensions' (Ekstensi) > 'Apps Script'
// 3. Hapus semua kode bawaan, lalu tempel (paste) seluruh kode ini
// 4. Klik ikon Disket (Save / Simpan)
// 5. Di kanan atas, klik 'Deploy' (Terapkan) > 'New deployment' (Penerapan baru)
// 6. Pilih jenis: 'Web app'
// 7. Konfigurasi:
//    - Description: "HemoShift 2-Way Sync Matrix XLSX"
//    - Execute as: "Me" (Email Google Anda)
//    - Who has access: "Anyone" (Siapa saja)  <-- PENTING AGAR APLIKASI BISA AKSES
// 8. Klik 'Deploy', izinkan otorisasi akun Google Anda
// 9. Salin 'Web app URL' (akhiran /exec) dan tempelkan ke aplikasi HemoShift HD
// =============================================================================

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var timestamp = new Date().toISOString();

    // -------------------------------------------------------------
    // 1. Matriks Jadwal HD (Persis Template .xlsx Kalender)
    // -------------------------------------------------------------
    var matrixData = data.scheduleMatrix;
    if (matrixData && matrixData.headers && matrixData.rows) {
      var matrixSheet = ss.getSheetByName("Matriks Jadwal HD") || ss.insertSheet("Matriks Jadwal HD", 0);
      matrixSheet.clear();

      var mHeaders = [matrixData.headers];
      var mRows = matrixData.rows;
      var totalCols = matrixData.headers.length;
      var totalRows = mRows.length;
      var daysInMonth = matrixData.daysInMonth || 31;

      // Header Kolom (Warna Biru Medis Modern)
      matrixSheet.getRange(1, 1, 1, totalCols)
        .setValues(mHeaders)
        .setBackground("#0061A4")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold")
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");

      matrixSheet.setRowHeight(1, 32);

      // Isi Data Jadwal
      if (totalRows > 0) {
        matrixSheet.getRange(2, 1, totalRows, totalCols).setValues(mRows);

        // Perataan teks
        matrixSheet.getRange(2, 1, totalRows, 1).setHorizontalAlignment("center"); // No
        matrixSheet.getRange(2, 2, totalRows, 1).setHorizontalAlignment("left");   // Nama Perawat
        matrixSheet.getRange(2, 3, totalRows, 2).setHorizontalAlignment("center"); // NIP & Peran
        matrixSheet.getRange(2, 5, totalRows, totalCols - 4).setHorizontalAlignment("center"); // Hari 1..31 & Totals

        // Lebar kolom rapi
        matrixSheet.setColumnWidth(1, 38);  // No
        matrixSheet.setColumnWidth(2, 220); // Nama Perawat
        matrixSheet.setColumnWidth(3, 145); // NIP
        matrixSheet.setColumnWidth(4, 95);  // Peran
        for (var c = 5; c <= 4 + daysInMonth; c++) {
          matrixSheet.setColumnWidth(c, 34); // Tanggal 1..31
        }
        for (var sc = 5 + daysInMonth; sc <= totalCols; sc++) {
          matrixSheet.setColumnWidth(sc, 68); // Kolom Total
        }

        // Kunci baris 1 dan kolom 1-4 (agar nama perawat tetap terlihat saat scroll ke tanggal akhir)
        matrixSheet.setFrozenRows(1);
        matrixSheet.setFrozenColumns(4);

        // Pewarnaan Otomatis (Conditional Formatting)
        var dayRange = matrixSheet.getRange(2, 5, totalRows, daysInMonth);
        var rules = [];

        // Pagi (P) - Biru Muda Sky
        rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo("P")
          .setBackground("#E0F2FE")
          .setFontColor("#0369A1")
          .setBold(true)
          .setRanges([dayRange])
          .build());

        // Siang (S) - Oranye/Kuning Amber
        rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo("S")
          .setBackground("#FEF3C7")
          .setFontColor("#B45309")
          .setBold(true)
          .setRanges([dayRange])
          .build());

        // Libur (L) - Abu-abu Elegan
        rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo("L")
          .setBackground("#F1F5F9")
          .setFontColor("#64748B")
          .setRanges([dayRange])
          .build());

        // Cuti (C) - Ungu
        rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo("C")
          .setBackground("#F3E8FF")
          .setFontColor("#7E22CE")
          .setBold(true)
          .setRanges([dayRange])
          .build());

        // Sakit (SK) - Merah
        rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo("SK")
          .setBackground("#FEE2E2")
          .setFontColor("#B91C1C")
          .setBold(true)
          .setRanges([dayRange])
          .build());

        matrixSheet.setConditionalFormatRules(rules);
      }
    }

    // -------------------------------------------------------------
    // 2. Simpan Data Perawat (Sheet: 'Data Perawat')
    // -------------------------------------------------------------
    if (data.nurses && Array.isArray(data.nurses)) {
      var nurseSheet = ss.getSheetByName("Data Perawat") || ss.insertSheet("Data Perawat");
      nurseSheet.clear();
      
      var nurseHeaders = [["ID", "Nama Perawat", "NIP", "No WhatsApp", "Peran", "Status Aktif", "Tugas Khusus", "Hari Libur Tetap"]];
      nurseSheet.getRange(1, 1, 1, 8)
        .setValues(nurseHeaders)
        .setBackground("#0D9488")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold");

      var nurseRows = [];
      for (var n = 0; n < data.nurses.length; n++) {
        var itemN = data.nurses[n];
        nurseRows.push([
          itemN.id || (n + 1),
          itemN.name || "",
          itemN.nip || "",
          itemN.phone ? "'" + itemN.phone : "",
          itemN.role || "PELAKSANA",
          itemN.isActive !== false ? "AKTIF" : "NONAKTIF",
          itemN.specialDuty || "",
          itemN.defaultOffDay !== undefined && itemN.defaultOffDay !== null ? itemN.defaultOffDay : ""
        ]);
      }

      if (nurseRows.length > 0) {
        nurseSheet.getRange(2, 1, nurseRows.length, 8).setValues(nurseRows);
        nurseSheet.autoResizeColumns(1, 8);
      }
    }

    // -------------------------------------------------------------
    // 3. Simpan Data Mesin (Sheet: 'Data Mesin')
    // -------------------------------------------------------------
    if (data.machines && Array.isArray(data.machines)) {
      var machineSheet = ss.getSheetByName("Data Mesin") || ss.insertSheet("Data Mesin");
      machineSheet.clear();

      var machineHeaders = [["ID", "Kode Mesin", "Nama Mesin", "Bay / Ruangan", "Kategori", "Status", "Brand Model", "Catatan"]];
      machineSheet.getRange(1, 1, 1, 8)
        .setValues(machineHeaders)
        .setBackground("#0284C7")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold");

      var machineRows = [];
      for (var m = 0; m < data.machines.length; m++) {
        var itemM = data.machines[m];
        machineRows.push([
          itemM.id || (m + 1),
          itemM.code || "",
          itemM.name || "",
          itemM.bay || "Bay A (Reguler)",
          itemM.category || "REGULER",
          itemM.status || "AKTIF",
          itemM.brandModel || "",
          itemM.notes || ""
        ]);
      }

      if (machineRows.length > 0) {
        machineSheet.getRange(2, 1, machineRows.length, 8).setValues(machineRows);
        machineSheet.autoResizeColumns(1, 8);
      }
    }

    // -------------------------------------------------------------
    // 4. Simpan Daftar Bay (Sheet: 'Daftar Bay')
    // -------------------------------------------------------------
    if (data.bays && Array.isArray(data.bays)) {
      var baySheet = ss.getSheetByName("Daftar Bay") || ss.insertSheet("Daftar Bay");
      baySheet.clear();
      baySheet.getRange(1, 1, 1, 1).setValues([["Nama Bay / Ruangan"]]).setBackground("#475569").setFontColor("#FFFFFF").setFontWeight("bold");
      var bayRows = [];
      for (var b = 0; b < data.bays.length; b++) {
        if (data.bays[b]) bayRows.push([data.bays[b]]);
      }
      if (bayRows.length > 0) {
        baySheet.getRange(2, 1, bayRows.length, 1).setValues(bayRows);
        baySheet.autoResizeColumns(1, 1);
      }
    }

    // -------------------------------------------------------------
    // 5. Simpan Detail Alokasi Mesin (Sheet: 'Jadwal HD (Detail Mesin)')
    // -------------------------------------------------------------
    if (data.assignments && Array.isArray(data.assignments)) {
      var schedSheet = ss.getSheetByName("Jadwal HD (Detail Mesin)") || ss.getSheetByName("Jadwal HD") || ss.insertSheet("Jadwal HD (Detail Mesin)");
      schedSheet.clear();

      var schedHeaders = [["ID", "Tanggal", "Sif", "Kode Sif", "ID Perawat", "Nama Perawat", "Peran", "Alokasi Mesin HD", "Jumlah Mesin", "Tugas Khusus", "Catatan"]];
      schedSheet.getRange(1, 1, 1, 11)
        .setValues(schedHeaders)
        .setBackground("#0061A4")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold");

      var schedRows = [];
      for (var i = 0; i < data.assignments.length; i++) {
        var itemA = data.assignments[i];
        var mList = Array.isArray(itemA.machines) ? itemA.machines.join(", ") : (itemA.machines || "");
        var roleStr = itemA.isLeader ? "PJ Sif / Katim" : "Perawat Pelaksana";
        schedRows.push([
          itemA.id || (itemA.date + "-" + (itemA.nurseId || i)),
          itemA.date || "",
          itemA.shiftType || "",
          itemA.shiftCode || "",
          itemA.nurseId || "",
          itemA.nurseName || "",
          roleStr,
          mList,
          itemA.machineCount || 0,
          itemA.specialDuty || "",
          itemA.notes || ""
        ]);
      }

      if (schedRows.length > 0) {
        schedSheet.getRange(2, 1, schedRows.length, 11).setValues(schedRows);
        schedSheet.autoResizeColumns(1, 11);
      }
    }

    // -------------------------------------------------------------
    // 6. Simpan Data Dokter Jaga HD (Sheet: 'Data Dokter')
    // -------------------------------------------------------------
    if (data.doctors !== undefined) {
      var docSheet = ss.getSheetByName("Data Dokter") || ss.insertSheet("Data Dokter");
      docSheet.clear();

      var docHeaders = [["ID", "Nama Dokter", "SIP", "No WhatsApp", "Peran (DPJP / DOKTER_RUANGAN)", "Spesialisasi", "Status (AKTIF / NONAKTIF)"]];
      docSheet.getRange(1, 1, 1, 7)
        .setValues(docHeaders)
        .setBackground("#0F766E")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold");

      var docRows = [];
      if (Array.isArray(data.doctors)) {
        for (var d = 0; d < data.doctors.length; d++) {
          var docItem = data.doctors[d];
          docRows.push([
            docItem.id || (d + 1),
            docItem.name || "",
            docItem.sip || "",
            "'" + (docItem.phone || ""),
            docItem.role || "DOKTER_RUANGAN",
            docItem.specialization || "",
            docItem.isActive !== false ? "AKTIF" : "NONAKTIF"
          ]);
        }
      }

      if (docRows.length === 0) {
        // Berikan 1 baris kosong siap isi agar user dapat langsung mengetik nama dokter di Google Sheets
        docRows.push([1, "", "", "", "DOKTER_RUANGAN", "", "AKTIF"]);
      }

      docSheet.getRange(2, 1, docRows.length, 7).setValues(docRows);
      docSheet.autoResizeColumns(1, 7);
    }

    // -------------------------------------------------------------
    // 7. Simpan Jadwal Dokter Jaga HD (Sheet: 'Jadwal Dokter HD')
    // -------------------------------------------------------------
    if (data.doctorDuties && Array.isArray(data.doctorDuties)) {
      var dutySheet = ss.getSheetByName("Jadwal Dokter HD") || ss.insertSheet("Jadwal Dokter HD");
      dutySheet.clear();

      var dutyHeaders = [["Tanggal", "Hari", "Dokter Sif Pagi", "Dokter Sif Siang", "ID Dokter Pagi", "ID Dokter Siang", "Catatan"]];
      dutySheet.getRange(1, 1, 1, 7)
        .setValues(dutyHeaders)
        .setBackground("#0D9488")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold");

      var dutyRows = [];
      var indonesianDays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      for (var k = 0; k < data.doctorDuties.length; k++) {
        var dutyItem = data.doctorDuties[k];
        var dayStr = dutyItem.dayName || "";
        if (!dayStr && dutyItem.date) {
          var dDateObj = new Date(dutyItem.date);
          dayStr = isNaN(dDateObj.getDay()) ? "" : indonesianDays[dDateObj.getDay()];
        }
        dutyRows.push([
          dutyItem.date || "",
          dayStr,
          dutyItem.pagiDoctorName || "-",
          dutyItem.siangDoctorName || "-",
          dutyItem.pagiDoctorId || "",
          dutyItem.siangDoctorId || "",
          dutyItem.notes || ""
        ]);
      }

      if (dutyRows.length > 0) {
        dutySheet.getRange(2, 1, dutyRows.length, 7).setValues(dutyRows);
        dutySheet.autoResizeColumns(1, 7);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Berhasil menyinkronkan data perawat, mesin & jadwal dokter ke Google Sheets!",
      timestamp: timestamp
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------------------------------------------
// GET Endpoint: Membaca Seluruh Data Master & Matriks Jadwal untuk Aplikasi
// -------------------------------------------------------------
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var paramMonth = (e && e.parameter && e.parameter.month) ? String(e.parameter.month).trim() : "";
    var now = new Date();
    var defaultYear = now.getFullYear();
    var defaultMonth = now.getMonth() + 1;

    if (paramMonth && paramMonth.indexOf("-") > -1) {
      var mParts = paramMonth.split("-");
      defaultYear = parseInt(mParts[0], 10) || defaultYear;
      defaultMonth = parseInt(mParts[1], 10) || defaultMonth;
    }

    // 1. Baca Perawat
    var nurses = [];
    var nurseSheet = ss.getSheetByName("Data Perawat");
    if (nurseSheet && nurseSheet.getLastRow() > 1) {
      var nurseValues = nurseSheet.getRange(2, 1, nurseSheet.getLastRow() - 1, 8).getValues();
      for (var i = 0; i < nurseValues.length; i++) {
        var r = nurseValues[i];
        var name = String(r[1] || "").trim();
        if (name) {
          nurses.push({
            id: Number(r[0]) || (i + 1),
            name: name,
            nip: String(r[2] || "").trim(),
            phone: String(r[3] || "").replace(/^'/, "").trim(),
            role: String(r[4] || "PELAKSANA").trim(),
            isActive: String(r[5]).toUpperCase() !== "NONAKTIF",
            specialDuty: r[6] ? String(r[6]).trim() : null,
            defaultOffDay: r[7] !== "" && r[7] !== null ? Number(r[7]) : null,
            skillLevel: "Senior",
            isPermanent: true
          });
        }
      }
    }

    // 2. Baca Mesin
    var machines = [];
    var machineSheet = ss.getSheetByName("Data Mesin");
    if (machineSheet && machineSheet.getLastRow() > 1) {
      var machineValues = machineSheet.getRange(2, 1, machineSheet.getLastRow() - 1, 8).getValues();
      for (var j = 0; j < machineValues.length; j++) {
        var rm = machineValues[j];
        var code = String(rm[1] || "").trim();
        if (code) {
          machines.push({
            id: Number(rm[0]) || (j + 1),
            code: code,
            name: String(rm[2] || ("Mesin " + code)).trim(),
            bay: String(rm[3] || "Bay A (Reguler)").trim(),
            category: String(rm[4] || "REGULER").trim(),
            status: String(rm[5] || "AKTIF").trim(),
            brandModel: String(rm[6] || "").trim(),
            notes: String(rm[7] || "").trim()
          });
        }
      }
    }

    // 3. Baca Bays
    var bays = [];
    var baySheet = ss.getSheetByName("Daftar Bay");
    if (baySheet && baySheet.getLastRow() > 1) {
      var bayValues = baySheet.getRange(2, 1, baySheet.getLastRow() - 1, 1).getValues();
      for (var b = 0; b < bayValues.length; b++) {
        var bName = String(bayValues[b][0] || "").trim();
        if (bName) bays.push(bName);
      }
    }

    // Peta Alokasi Mesin dari Sheet Detail (jika ada)
    var machineMap = {};
    var detailSheet = ss.getSheetByName("Jadwal HD (Detail Mesin)") || ss.getSheetByName("Jadwal HD");
    if (detailSheet && detailSheet.getLastRow() > 1) {
      var detailVals = detailSheet.getRange(2, 1, detailSheet.getLastRow() - 1, 11).getValues();
      for (var d = 0; d < detailVals.length; d++) {
        var dr = detailVals[d];
        var dDate = String(dr[1] || "").trim();
        var dNurse = String(dr[5] || "").trim().toLowerCase();
        var dMachines = String(dr[7] || "").split(/[,;\\s]+/).filter(Boolean);
        if (dDate && dNurse) {
          machineMap[dDate + "_" + dNurse] = dMachines;
        }
      }
    }

    // 4. Baca Jadwal: Prioritas baca tab khusus bulan (jika diduplikasi) atau 'Matriks Jadwal HD'
    var assignments = [];
    var matrixSheet = null;
    if (paramMonth) {
      matrixSheet = ss.getSheetByName("Matriks Jadwal " + paramMonth) ||
                    ss.getSheetByName("Jadwal " + paramMonth);
    }
    if (!matrixSheet) {
      matrixSheet = ss.getSheetByName("Matriks Jadwal HD");
    }

    if (matrixSheet && matrixSheet.getLastRow() > 1) {
      var mHeaders = matrixSheet.getRange(1, 1, 1, matrixSheet.getLastColumn()).getValues()[0];
      var mData = matrixSheet.getRange(2, 1, matrixSheet.getLastRow() - 1, matrixSheet.getLastColumn()).getValues();

      // Cari kolom hari (1..31)
      var dayCols = [];
      for (var col = 0; col < mHeaders.length; col++) {
        var hVal = String(mHeaders[col] || "").trim();
        var num = parseInt(hVal, 10);
        if (!isNaN(num) && num >= 1 && num <= 31) {
          dayCols.push({ colIndex: col, day: num });
        }
      }

      // Cari kolom nama perawat (biasanya kolom 2, index 1)
      var nameCol = 1;
      for (var hc = 0; hc < Math.min(mHeaders.length, 4); hc++) {
        var colNameStr = String(mHeaders[hc] || "").toLowerCase();
        if (colNameStr.indexOf("nama") > -1) {
          nameCol = hc;
          break;
        }
      }

      for (var rIdx = 0; rIdx < mData.length; rIdx++) {
        var row = mData[rIdx];
        var nurseName = String(row[nameCol] || "").trim();
        if (!nurseName) continue;

        // Cari ID perawat yang cocok jika ada
        var matchedNurse = null;
        for (var nIdx = 0; nIdx < nurses.length; nIdx++) {
          if (nurses[nIdx].name.toLowerCase() === nurseName.toLowerCase() ||
              nurseName.toLowerCase().indexOf(nurses[nIdx].name.toLowerCase()) > -1) {
            matchedNurse = nurses[nIdx];
            break;
          }
        }
        var nurseId = matchedNurse ? matchedNurse.id : (1000 + rIdx);
        var isLeader = matchedNurse ? (matchedNurse.role === "KATIM" || matchedNurse.role === "KARU") : false;

        for (var dayIdx = 0; dayIdx < dayCols.length; dayIdx++) {
          var dInfo = dayCols[dayIdx];
          var cellCode = String(row[dInfo.colIndex] || "").trim().toUpperCase();
          if (!cellCode) cellCode = "L";

          var shiftType = "LIBUR";
          var shiftCode = "L";

          if (cellCode.indexOf("P") === 0 || cellCode.indexOf("PAGI") > -1) {
            shiftType = "PAGI";
            shiftCode = "P";
          } else if (cellCode.indexOf("S") === 0 && cellCode.indexOf("SK") !== 0 && cellCode.indexOf("SAKIT") === -1) {
            shiftType = "SIANG";
            shiftCode = "S";
          } else if (cellCode.indexOf("C") === 0 || cellCode.indexOf("CUTI") > -1) {
            shiftType = "CUTI";
            shiftCode = "C";
          } else if (cellCode.indexOf("SK") === 0 || cellCode.indexOf("SAKIT") > -1) {
            shiftType = "SAKIT";
            shiftCode = "SK";
          }

          var dateStr = defaultYear + "-" + ("0" + defaultMonth).slice(-2) + "-" + ("0" + dInfo.day).slice(-2);
          var mList = machineMap[dateStr + "_" + nurseName.toLowerCase()] || [];

          assignments.push({
            id: "asg-" + dateStr + "-" + nurseId,
            date: dateStr,
            shiftType: shiftType,
            shiftCode: shiftCode,
            nurseId: nurseId,
            nurseName: nurseName,
            isLeader: isLeader,
            machines: mList,
            machineCount: mList.length,
            notes: (cellCode !== "P" && cellCode !== "S" && cellCode !== "L" && cellCode !== "C" && cellCode !== "SK") ? cellCode : ""
          });
        }
      }
    } else if (detailSheet && detailSheet.getLastRow() > 1) {
      // Fallback baca format baris jika Matriks belum dibuat
      var schedValues = detailSheet.getRange(2, 1, detailSheet.getLastRow() - 1, 11).getValues();
      for (var k = 0; k < schedValues.length; k++) {
        var sa = schedValues[k];
        var aDate = String(sa[1] || "").trim();
        var aNurse = String(sa[5] || "").trim();
        if (aDate && aNurse) {
          assignments.push({
            id: String(sa[0] || (aDate + "-" + k)),
            date: aDate,
            shiftType: String(sa[2] || "LIBUR").trim(),
            shiftCode: String(sa[3] || "L").trim(),
            nurseId: Number(sa[4]) || 0,
            nurseName: aNurse,
            isLeader: String(sa[6]).indexOf("PJ") > -1 || String(sa[6]).indexOf("Katim") > -1,
            machines: String(sa[7] || "").split(/[,;\\s]+/).filter(Boolean),
            specialDuty: sa[9] ? String(sa[9]).trim() : null,
            notes: String(sa[10] || "").trim()
          });
        }
      }
    }

    // 5. Baca Data Dokter
    var doctors = [];
    var docSheet = ss.getSheetByName("Data Dokter");
    if (docSheet && docSheet.getLastRow() > 1) {
      var docVals = docSheet.getRange(2, 1, docSheet.getLastRow() - 1, 7).getValues();
      for (var di = 0; di < docVals.length; di++) {
        var dr = docVals[di];
        var dName = String(dr[1] || "").trim();
        if (dName) {
          doctors.push({
            id: Number(dr[0]) || (di + 1),
            name: dName,
            sip: String(dr[2] || "").trim(),
            phone: String(dr[3] || "").replace(/^'/, "").trim(),
            role: String(dr[4] || "DOKTER_RUANGAN").trim(),
            specialization: String(dr[5] || "").trim(),
            isActive: String(dr[6]).toUpperCase() !== "NONAKTIF"
          });
        }
      }
    }

    // 6. Baca Jadwal Dokter HD
    var doctorDuties = [];
    var dutySheet = ss.getSheetByName("Jadwal Dokter HD");
    if (dutySheet && dutySheet.getLastRow() > 1) {
      var dutyVals = dutySheet.getRange(2, 1, dutySheet.getLastRow() - 1, 7).getValues();
      for (var dy = 0; dy < dutyVals.length; dy++) {
        var dRow = dutyVals[dy];
        var rawDateVal = dRow[0];
        var dyDate = "";
        if (rawDateVal instanceof Date) {
          var yr = rawDateVal.getFullYear();
          var mn = ("0" + (rawDateVal.getMonth() + 1)).slice(-2);
          var dt = ("0" + rawDateVal.getDate()).slice(-2);
          dyDate = yr + "-" + mn + "-" + dt;
        } else {
          dyDate = String(rawDateVal || "").trim();
        }

        if (dyDate) {
          doctorDuties.push({
            date: dyDate,
            pagiDoctorName: String(dRow[2] || "-").trim(),
            siangDoctorName: String(dRow[3] || "-").trim(),
            pagiDoctorId: Number(dRow[4]) || null,
            siangDoctorId: Number(dRow[5]) || null,
            notes: String(dRow[6] || "").trim()
          });
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      nurses: nurses,
      machines: machines,
      bays: bays,
      assignments: assignments,
      doctors: doctors,
      doctorDuties: doctorDuties,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
  }

  /**
   * Ekspor Daftar Dokter Jaga HD ke format file CSV
   */
  static exportDoctorsToCSV(doctors: Doctor[]) {
    const headers = ['ID', 'Nama Dokter', 'SIP', 'No WhatsApp', 'Peran', 'Spesialisasi', 'Status'];
    const rows = [headers.join(',')];
    doctors.forEach((d) => {
      rows.push([
        d.id,
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${(d.sip || '').replace(/"/g, '""')}"`,
        `"'${d.phone || ''}"`,
        `"${d.role}"`,
        `"${(d.specialization || '').replace(/"/g, '""')}"`,
        d.isActive !== false ? 'AKTIF' : 'NONAKTIF',
      ].join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Master_Dokter_HD_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Ekspor Jadwal Dokter Jaga HD ke format file CSV
   */
  static exportDoctorScheduleToCSV(
    monthString: string,
    doctorDuties: Record<string, DoctorShiftDuty>,
    doctors: Doctor[]
  ) {
    const parts = monthString.split('-');
    const year = parseInt(parts[0], 10) || new Date().getFullYear();
    const month = parseInt(parts[1], 10) || new Date().getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const headers = ['Tanggal', 'Hari', 'Dokter Sif Pagi', 'Dokter Sif Siang', 'Catatan'];
    const rows = [headers.join(',')];

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      const duty = doctorDuties[dateStr];

      const pagiDoc = doctors.find((doc) => doc.id === duty?.pagiDoctorId)?.name || duty?.pagiDoctorName || '-';
      const siangDoc = doctors.find((doc) => doc.id === duty?.siangDoctorId)?.name || duty?.siangDoctorName || '-';
      const notes = (duty?.notes || '').replace(/"/g, '""');

      rows.push([dateStr, dayNames[dayOfWeek], `"${pagiDoc}"`, `"${siangDoc}"`, `"${notes}"`].join(','));
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Jadwal_Dokter_HD_${monthString}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

