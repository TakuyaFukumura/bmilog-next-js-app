import {
    filterRecordsByPeriod,
    getBmi,
    getBmiCategory,
    getPeriodStart,
    getStandardWeightRange,
} from '../../../src/lib/metrics';

describe('BMI calculations', () => {
    it('BMIと区分境界を計算する', () => {
        expect(getBmi(72.25, 170)).toBeCloseTo(25);
        expect(getBmiCategory(18.49)).toBe('低体重');
        expect(getBmiCategory(18.5)).toBe('標準体重');
        expect(getBmiCategory(24.99)).toBe('標準体重');
        expect(getBmiCategory(25)).toBe('高BMI');
    });

    it('身長に対応した標準体重範囲を計算する', () => {
        expect(getStandardWeightRange(100)).toEqual({lower: 18.5, upper: 25});
    });
});

describe('date periods', () => {
    it('暦月を遡り、月末を補正する', () => {
        expect(getPeriodStart('2026-03-31', 1)).toBe('2026-02-28');
        expect(getPeriodStart('2024-03-31', 1)).toBe('2024-02-29');
    });

    it('期間の開始日と今日を含めて記録を抽出する', () => {
        const records = [
            {date: '2026-09-03'},
            {date: '2026-09-04'},
            {date: '2026-10-04'},
            {date: '2026-10-05'},
        ];
        expect(filterRecordsByPeriod(records, '1m', '2026-10-04')).toEqual(records.slice(1, 3));
        expect(filterRecordsByPeriod(records, 'all', '2026-10-04')).toEqual(records);
    });
});
