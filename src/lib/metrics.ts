import type {Profile, WeightRecord} from './health-data';

export type BmiRecord = WeightRecord & {
    bmi: number;
    bmiCategory: '低体重' | '標準体重' | '高BMI';
};

export type Period = 'all' | '1m' | '3m' | '6m';

export function getBmi(weightKg: number, heightCm: number): number {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
}

export function getBmiCategory(bmi: number): BmiRecord['bmiCategory'] {
    if (bmi < 18.5) {
        return '低体重';
    }
    return bmi < 25 ? '標準体重' : '高BMI';
}

export function getBmiRecords(records: WeightRecord[], profile: Profile): BmiRecord[] {
    return records.map(record => {
        const bmi = getBmi(record.weightKg, profile.heightCm);
        return {...record, bmi, bmiCategory: getBmiCategory(bmi)};
    });
}

export function getPeriodStart(today: string, months: number): string {
    const [year, month, day] = today.split('-').map(Number);
    const endOfTargetMonth = new Date(Date.UTC(year, month - 1 - months + 1, 0)).getUTCDate();
    const targetYearMonth = new Date(Date.UTC(year, month - 1 - months, 1));
    const startDay = Math.min(day, endOfTargetMonth);
    return [
        targetYearMonth.getUTCFullYear().toString().padStart(4, '0'),
        (targetYearMonth.getUTCMonth() + 1).toString().padStart(2, '0'),
        startDay.toString().padStart(2, '0'),
    ].join('-');
}

export function filterRecordsByPeriod<T extends { date: string }>(
    records: T[],
    period: Period,
    today: string,
): T[] {
    if (period === 'all') {
        return records;
    }
    const months = Number(period.slice(0, -1));
    const start = getPeriodStart(today, months);
    return records.filter(record => record.date >= start && record.date <= today);
}

export function getStandardWeightRange(heightCm: number): { lower: number; upper: number } {
    const heightM = heightCm / 100;
    return {
        lower: 18.5 * heightM * heightM,
        upper: 25 * heightM * heightM,
    };
}

export function formatOneDecimal(value: number): string {
    return value.toFixed(1);
}
