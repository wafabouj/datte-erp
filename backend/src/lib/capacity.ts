import dayjs, { Dayjs } from "dayjs";

export interface WorkCenterCapacity {
  capacityKgPerHourPerWorker: number;
  workingHoursPerDay: number;
  workingDays: number[]; // 0=dimanche .. 6=samedi
  breakMinutesPerDay: number;
}

export function totalCapacityKgPerHour(wc: WorkCenterCapacity, workerCount: number) {
  return wc.capacityKgPerHourPerWorker * Math.max(1, workerCount);
}

export function computeDurationHours(
  rawKg: number,
  wc: WorkCenterCapacity,
  workerCount: number
) {
  const capacity = totalCapacityKgPerHour(wc, workerCount);
  if (capacity <= 0) return 0;
  return rawKg / capacity;
}

function effectiveHoursPerDay(wc: WorkCenterCapacity) {
  return Math.max(0, wc.workingHoursPerDay - wc.breakMinutesPerDay / 60);
}

/**
 * Avance depuis `start` en ne comptant que les heures ouvrées du poste
 * (jours ouvrés × heures/jour - pauses) jusqu'à épuiser `durationHours`,
 * et retourne la date/heure de fin prévisionnelle.
 */
export function computeEndDate(start: Date, durationHours: number, wc: WorkCenterCapacity): Date {
  const dailyHours = effectiveHoursPerDay(wc);
  if (dailyHours <= 0 || durationHours <= 0) return start;

  let cursor: Dayjs = dayjs(start);
  // Positionne le curseur au début de la journée de travail si on démarre hors plage
  let remaining = durationHours;

  // avance jusqu'au premier jour ouvré
  while (!wc.workingDays.includes(cursor.day())) {
    cursor = cursor.add(1, "day").hour(8).minute(0).second(0);
  }

  while (remaining > 0) {
    if (!wc.workingDays.includes(cursor.day())) {
      cursor = cursor.add(1, "day").hour(8).minute(0).second(0);
      continue;
    }
    if (remaining <= dailyHours) {
      cursor = cursor.add(remaining, "hour");
      remaining = 0;
    } else {
      remaining -= dailyHours;
      cursor = cursor.add(1, "day").hour(8).minute(0).second(0);
    }
  }

  return cursor.toDate();
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export function rangesOverlap(a: TimeRange, b: TimeRange) {
  return a.start < b.end && b.start < a.end;
}
