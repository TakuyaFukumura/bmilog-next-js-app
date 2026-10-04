import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'csv-parse/sync';

export type WeightRecord = {
    date: string;
    weightKg: number;
};

export type Profile = {
    heightCm: number;
    targetWeightKg: number;
};

export type CsvIssue = {
    file: string;
    line: number;
    reason: string;
};

type ParsedRecord = { record: string[]; info: { lines: number } };

const WEIGHT_FILE = 'data/weight-sample.csv';
const PROFILE_FILE = 'data/profile-sample.csv';
const decimalPattern = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

export function getTodayInTokyo(now = new Date()): string {
    return now.toLocaleDateString('sv-SE', {timeZone: 'Asia/Tokyo'});
}

function parseRows(contents: string, file: string): { rows: ParsedRecord[]; issues: CsvIssue[] } {
    try {
        const rows = parse(contents, {
            bom: true,
            info: true,
            relax_column_count: true,
            skip_empty_lines: true,
            trim: true,
        }) as unknown as ParsedRecord[];
        for (const row of rows) {
            row.record = row.record.map(value => value.trim());
        }
        return {rows, issues: []};
    } catch (error) {
        const line = typeof error === 'object' && error !== null && 'lines' in error &&
        typeof error.lines === 'number' ? error.lines : 1;
        return {
            rows: [],
            issues: [{file, line, reason: 'CSVの形式を解析できません'}],
        };
    }
}

function hasExpectedHeader(actual: string[] | undefined, expected: string[]): boolean {
    return actual?.length === expected.length &&
        actual.every((column, index) => column === expected[index]);
}

function parsePositiveNumber(value: string | undefined): number | null {
    if (!value || !decimalPattern.test(value)) {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

function isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
}

function validateWeightDate(
    date: string,
    file: string,
    line: number,
    today: string,
    seenDates: Set<string>,
): CsvIssue[] {
    const issues: CsvIssue[] = [];
    if (!date) {
        issues.push({file, line, reason: '日付が未入力です'});
    } else if (!isValidDate(date)) {
        issues.push({file, line, reason: '日付は実在する YYYY-MM-DD 形式にしてください'});
    } else {
        if (date > today) {
            issues.push({file, line, reason: 'JST基準で未来の日付は登録できません'});
        }
        if (seenDates.has(date)) {
            issues.push({file, line, reason: '同じ日付の記録が重複しています'});
        }
        seenDates.add(date);
    }
    return issues;
}

function parseWeightRow(
    row: ParsedRecord,
    file: string,
    today: string,
    seenDates: Set<string>,
): { record: WeightRecord | null; issues: CsvIssue[] } {
    const {record: columns, info} = row;
    const line = info.lines;
    if (columns.length !== 2) {
        return {
            record: null,
            issues: [{file, line, reason: '列数は2列にしてください'}],
        };
    }

    const [date, weightText] = columns;
    const issues = validateWeightDate(date, file, line, today, seenDates);
    const weight = parsePositiveNumber(weightText);
    if (weight === null || weight < 1 || weight > 999) {
        issues.push({file, line, reason: '体重は1 kg以上999 kg以下の数値にしてください'});
    }
    if (issues.length > 0 || weight === null) {
        return {record: null, issues};
    }

    return {
        record: {
            date,
            weightKg: Math.round((weight + Number.EPSILON) * 10) / 10,
        },
        issues,
    };
}

export function parseWeightCsv(contents: string, today = getTodayInTokyo()): {
    records: WeightRecord[];
    issues: CsvIssue[];
} {
    const file = WEIGHT_FILE;
    const {rows, issues} = parseRows(contents, file);
    if (issues.length > 0) {
        return {records: [], issues};
    }
    if (!hasExpectedHeader(rows[0]?.record, ['date', 'weight_kg'])) {
        return {
            records: [],
            issues: [{file, line: 1, reason: 'ヘッダーは date,weight_kg にしてください'}],
        };
    }

    const records: WeightRecord[] = [];
    const seenDates = new Set<string>();
    const validationIssues: CsvIssue[] = [];
    for (const row of rows.slice(1)) {
        const result = parseWeightRow(row, file, today, seenDates);
        validationIssues.push(...result.issues);
        if (result.record) {
            records.push(result.record);
        }
    }

    records.sort((a, b) => a.date.localeCompare(b.date));
    return {records: validationIssues.length ? [] : records, issues: validationIssues};
}

export function parseProfileCsv(contents: string): { profile: Profile | null; issues: CsvIssue[] } {
    const file = PROFILE_FILE;
    const {rows, issues} = parseRows(contents, file);
    if (issues.length > 0) {
        return {profile: null, issues};
    }
    if (!hasExpectedHeader(rows[0]?.record, ['height_cm', 'target_weight_kg'])) {
        return {
            profile: null,
            issues: [{file, line: 1, reason: 'ヘッダーは height_cm,target_weight_kg にしてください'}],
        };
    }

    const dataRows = rows.slice(1);
    const validationIssues: CsvIssue[] = [];
    if (dataRows.length === 0) {
        return {
            profile: null,
            issues: [{file, line: 2, reason: 'プロフィールを1行登録してください'}],
        };
    }
    if (dataRows.length !== 1) {
        validationIssues.push({
            file,
            line: dataRows.length === 0 ? 2 : dataRows[1].info.lines,
            reason: 'プロフィールは1行だけ登録してください',
        });
    }
    const {record: columns, info} = dataRows[0] ?? {record: [], info: {lines: 2}};
    if (columns.length !== 2) {
        validationIssues.push({file, line: info.lines, reason: '列数は2列にしてください'});
        return {profile: null, issues: validationIssues};
    }

    const height = parsePositiveNumber(columns[0]);
    if (height === null || height > 300 || !Number.isInteger(height * 10)) {
        validationIssues.push({
            file,
            line: info.lines,
            reason: '身長は0より大きく300 cm以下、小数第1位までにしてください'
        });
    }
    const targetWeight = parsePositiveNumber(columns[1]);
    if (targetWeight === null || targetWeight < 1 || targetWeight > 999 || !Number.isInteger(targetWeight * 10)) {
        validationIssues.push({
            file,
            line: info.lines,
            reason: '目標体重は1 kg以上999 kg以下、0.1 kg刻みにしてください'
        });
    }
    if (validationIssues.length > 0 || height === null || targetWeight === null) {
        return {profile: null, issues: validationIssues};
    }
    return {
        profile: {heightCm: height, targetWeightKg: targetWeight},
        issues: [],
    };
}

export type DashboardDataResult =
    | { status: 'ok'; records: WeightRecord[]; profile: Profile }
    | { status: 'invalid'; issues: CsvIssue[] }
    | { status: 'unreadable'; files: string[] };

export async function loadDashboardData(today = getTodayInTokyo()): Promise<DashboardDataResult> {
    const [weightContents, profileContents] = await Promise.all([
        readFile(join(process.cwd(), 'data', 'weight-sample.csv'), 'utf8').catch(() => null),
        readFile(join(process.cwd(), 'data', 'profile-sample.csv'), 'utf8').catch(() => null),
    ]);
    const contents = [weightContents, profileContents] as const;
    const unreadable = [
        ...(weightContents === null ? [WEIGHT_FILE] : []),
        ...(profileContents === null ? [PROFILE_FILE] : []),
    ];
    if (unreadable.length > 0) {
        return {status: 'unreadable', files: [...unreadable]};
    }

    const weightResult = parseWeightCsv(contents[0] ?? '', today);
    const profileResult = parseProfileCsv(contents[1] ?? '');
    const issues = [...weightResult.issues, ...profileResult.issues];
    if (issues.length > 0) {
        return {status: 'invalid', issues};
    }
    if (profileResult.profile === null) {
        return {
            status: 'invalid',
            issues: [{file: PROFILE_FILE, line: 2, reason: 'プロフィールを読み込めません'}],
        };
    }
    return {status: 'ok', records: weightResult.records, profile: profileResult.profile};
}
