import { Nurse, ShiftAssignment } from '../types';

/**
 * Normalizes nurse names by trimming, converting to lowercase,
 * removing medical / nursing titles/prefixes (Ns., Ners, dr., Hj., H., Br., Sr.)
 * and academic/professional degrees (S.Kep, Amd.Kep, etc.)
 */
export const normalizeNurseName = (rawName?: string | null): string => {
  if (!rawName || typeof rawName !== 'string') return '';
  return rawName
    .trim()
    .toLowerCase()
    // Remove honorifics and prefixes at the start
    .replace(/^(ns\.|ners\b|dr\.|dr\b|hj\.|h\.|br\.|sr\.)\s*/i, '')
    // Remove degrees and suffixes at the end
    .replace(/[,\s]+(s\.kep|s\.kep\.|amd\.kep|amd\.kep\.|a\.md\.kep|ners|ns|skep|amk|sst|m\.kep)\b.*$/i, '')
    // Remove punctuation & special characters
    .replace(/[^a-z0-9\s]/g, '')
    // Collapse multi-space
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Checks if two nurse names refer to the same person
 */
export const areNurseNamesEqual = (nameA?: string | null, nameB?: string | null): boolean => {
  const normA = normalizeNurseName(nameA);
  const normB = normalizeNurseName(nameB);
  if (!normA || !normB) return false;
  return normA === normB;
};

export interface DeduplicateNursesResult {
  uniqueNurses: Nurse[];
  mergedIdsMap: Map<number, number>; // old duplicate id -> surviving primary id
  removedNurses: Nurse[];
}

/**
 * Deduplicates a list of nurses based on numeric ID and normalized name.
 * Intelligently merges records to keep the richest information (phone, NIP, role, active status).
 */
export const deduplicateNursesList = (nursesList: Nurse[]): DeduplicateNursesResult => {
  const uniqueNurses: Nurse[] = [];
  const mergedIdsMap = new Map<number, number>();
  const removedNurses: Nurse[] = [];

  // Group by normalized name
  const nameGroups = new Map<string, Nurse[]>();

  nursesList.forEach((nurse) => {
    if (!nurse || !nurse.name) return;
    const norm = normalizeNurseName(nurse.name);
    if (!norm) return;

    const existingGroup = nameGroups.get(norm) || [];
    existingGroup.push(nurse);
    nameGroups.set(norm, existingGroup);
  });

  nameGroups.forEach((group) => {
    if (group.length === 1) {
      uniqueNurses.push({
        ...group[0],
        isPermanent: true,
      });
      return;
    }

    // Sort group to pick the best primary record
    // Priority:
    // 1. Is active
    // 2. Has phone number
    // 3. Has NIP
    // 4. Role (KARU > KATIM > PELAKSANA)
    // 5. Lowest numeric ID
    group.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aHasPhone = Boolean(a.phone && a.phone.trim());
      const bHasPhone = Boolean(b.phone && b.phone.trim());
      if (aHasPhone !== bHasPhone) return aHasPhone ? -1 : 1;

      const aHasNip = Boolean(a.nip && a.nip.trim());
      const bHasNip = Boolean(b.nip && b.nip.trim());
      if (aHasNip !== bHasNip) return aHasNip ? -1 : 1;

      const roleScore = (r: string) => (r === 'KARU' ? 3 : r === 'KATIM' ? 2 : 1);
      const diffRole = roleScore(b.role) - roleScore(a.role);
      if (diffRole !== 0) return diffRole;

      return a.id - b.id;
    });

    const primary = { ...group[0], isPermanent: true };

    // Merge any missing attributes from other duplicate entries into primary
    for (let i = 1; i < group.length; i++) {
      const dup = group[i];
      removedNurses.push(dup);
      if (dup.id !== primary.id) {
        mergedIdsMap.set(dup.id, primary.id);
      }

      if (!primary.phone && dup.phone) {
        primary.phone = dup.phone;
      }
      if (!primary.nip && dup.nip) {
        primary.nip = dup.nip;
      }
      if (primary.role === 'PELAKSANA' && (dup.role === 'KATIM' || dup.role === 'KARU')) {
        primary.role = dup.role;
      }
      if (primary.defaultOffDay === null && dup.defaultOffDay !== null && dup.defaultOffDay !== undefined) {
        primary.defaultOffDay = dup.defaultOffDay;
      }
      if (primary.skillLevel === 'Junior' && (dup.skillLevel === 'Senior' || dup.skillLevel === 'Medium')) {
        primary.skillLevel = dup.skillLevel;
      }
    }

    uniqueNurses.push(primary);
  });

  // Sort final unique list by numeric ID
  uniqueNurses.sort((a, b) => a.id - b.id);

  return {
    uniqueNurses,
    mergedIdsMap,
    removedNurses,
  };
};

/**
 * Updates an array of ShiftAssignments to map any remapped duplicate nurse IDs
 * to the surviving primary nurse ID and name.
 */
export const remapAssignmentsNurseIds = (
  assignments: ShiftAssignment[],
  mergedIdsMap: Map<number, number>,
  nurses: Nurse[]
): ShiftAssignment[] => {
  if (mergedIdsMap.size === 0) return assignments;

  const nurseMap = new Map<number, Nurse>(nurses.map((n) => [n.id, n]));

  return assignments.map((a) => {
    if (mergedIdsMap.has(a.nurseId)) {
      const newId = mergedIdsMap.get(a.nurseId)!;
      const targetNurse = nurseMap.get(newId);
      return {
        ...a,
        nurseId: newId,
        nurseName: targetNurse ? targetNurse.name : a.nurseName,
        nursePhone: targetNurse ? targetNurse.phone : a.nursePhone,
      };
    }
    return a;
  });
};
