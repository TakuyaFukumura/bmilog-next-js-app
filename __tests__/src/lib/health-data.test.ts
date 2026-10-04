/** @jest-environment node */

import {getTodayInTokyo, parseProfileCsv, parseWeightCsv} from '../../../src/lib/health-data';

describe('getTodayInTokyo', () => {
    it('日付境界を日本時間で判定する', () => {
        expect(getTodayInTokyo(new Date('2026-10-03T15:30:00.000Z'))).toBe('2026-10-04');
    });
});

describe('parseWeightCsv', () => {
    it('BOM・CRLFを許容し、体重を丸めて日付順にする', () => {
        const result = parseWeightCsv(
            '\uFEFFdate,weight_kg\r\n2026-10-02,72.36\r\n\r\n2026-10-01,72.34\r\n',
            '2026-10-04',
        );

        expect(result.issues).toEqual([]);
        expect(result.records).toEqual([
            {date: '2026-10-01', weightKg: 72.3},
            {date: '2026-10-02', weightKg: 72.4},
        ]);
    });

    it('引用符内の前後空白を除去し、1,000件を保持する', () => {
        const records = Array.from({length: 1000}, (_, index) => {
            const date = new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10);
            return `${date}, ${50 + index / 10}`;
        });
        const result = parseWeightCsv(
            `date,weight_kg\n" 2024-01-01 "," 50.0 "\n${records.slice(1).join('\n')}`,
            '2026-10-04',
        );

        expect(result.issues).toEqual([]);
        expect(result.records).toHaveLength(1000);
        expect(result.records[0]).toEqual({date: '2024-01-01', weightKg: 50});
    });

    it('ヘッダーのみならエラーではなく空データにする', () => {
        expect(parseWeightCsv('date,weight_kg\n', '2026-10-04')).toEqual({
            records: [],
            issues: [],
        });
    });

    it('複数の不正を行番号付きで返し、部分データを返さない', () => {
        const result = parseWeightCsv(
            'date,weight_kg\n2026-10-01,70\n2026-10-01,71\n2026-10-05,72\n2026-02-30,0\n',
            '2026-10-04',
        );

        expect(result.records).toEqual([]);
        expect(result.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({line: 3, reason: '同じ日付の記録が重複しています'}),
            expect.objectContaining({line: 4, reason: 'JST基準で未来の日付は登録できません'}),
            expect.objectContaining({line: 5, reason: '日付は実在する YYYY-MM-DD 形式にしてください'}),
            expect.objectContaining({line: 5, reason: '体重は0より大きく999 kg以下の数値にしてください'}),
        ]));
    });

    it('ヘッダーの列名と順序を検証する', () => {
        const result = parseWeightCsv('weight_kg,date\n70,2026-10-01\n');
        expect(result.records).toEqual([]);
        expect(result.issues[0]).toMatchObject({line: 1});
    });
});

describe('parseProfileCsv', () => {
    it('プロフィールを読み込み、許容範囲と精度を検証する', () => {
        expect(parseProfileCsv('height_cm,target_weight_kg\n170.1,68.0\n')).toEqual({
            profile: {heightCm: 170.1, targetWeightKg: 68},
            issues: [],
        });

        const invalid = parseProfileCsv('height_cm,target_weight_kg\n301,68.05\n');
        expect(invalid.profile).toBeNull();
        expect(invalid.issues).toHaveLength(2);
    });
});
