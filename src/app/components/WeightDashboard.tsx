'use client';

import {useMemo, useRef, useState} from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceArea,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type {BmiRecord, Period} from '../../lib/metrics';
import {filterRecordsByPeriod, formatOneDecimal, getBmiRecords, getStandardWeightRange,} from '../../lib/metrics';
import type {DashboardDataResult} from '../../lib/health-data';

type WeightDashboardProps = {
    data: DashboardDataResult;
    today: string;
};

const periodOptions: { value: Period; label: string }[] = [
    {value: 'all', label: '全期間'},
    {value: '1m', label: '1か月'},
    {value: '3m', label: '3か月'},
    {value: '6m', label: '6か月'},
];

function isBmiRecord(value: unknown): value is BmiRecord {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return typeof record.date === 'string' &&
        typeof record.weightKg === 'number' &&
        typeof record.bmi === 'number' &&
        (record.bmiCategory === '低体重' || record.bmiCategory === '標準体重' || record.bmiCategory === '高BMI');
}

function dateLabel(date: string): string {
    const [, month, day] = date.split('-');
    return `${Number(month)}/${Number(day)}`;
}

function DataError({data}: { data: Exclude<DashboardDataResult, { status: 'ok' }> }) {
    if (data.status === 'unreadable') {
        return (
            <section
                className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
                role="alert">
                <h2 className="text-lg font-semibold">データを読み込めません</h2>
                <p className="mt-2">次のCSVファイルを確認してください。</p>
                <ul className="mt-2 list-inside list-disc">
                    {data.files.map(file => <li key={file}><code>{file}</code></li>)}
                </ul>
            </section>
        );
    }

    return (
        <section
            className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
            role="alert">
            <h2 className="text-lg font-semibold">CSVに不正なデータがあります</h2>
            <p className="mt-2">問題を修正してからページを再読み込みしてください。データの一部だけを表示することはありません。</p>
            <ul className="mt-4 space-y-2">
                {data.issues.map((issue, index) => (
                    <li key={`${issue.file}-${issue.line}-${index}`}>
                        <code>{issue.file}</code>（{issue.line}行目）: {issue.reason}
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function WeightDashboard({data, today}: WeightDashboardProps) {
    const [period, setPeriod] = useState<Period>('all');
    const allRecords = useMemo(
        () => data.status === 'ok' ? getBmiRecords(data.records, data.profile) : [],
        [data],
    );
    const [selectedDate, setSelectedDate] = useState(
        data.status === 'ok' ? data.records.at(-1)?.date ?? null : null,
    );
    const [tablePage, setTablePage] = useState(0);
    const chartPointRefs = useRef<Map<string, SVGCircleElement>>(new Map());

    if (data.status !== 'ok') {
        return <DataError data={data}/>;
    }

    const visibleRecords = filterRecordsByPeriod(allRecords, period, today);
    const selectedRecord = visibleRecords.find(record => record.date === selectedDate) ??
        visibleRecords.at(-1) ?? null;
    const latestRecord = allRecords.at(-1) ?? null;
    const difference = latestRecord ? latestRecord.weightKg - data.profile.targetWeightKg : null;
    const standardRange = getStandardWeightRange(data.profile.heightCm);
    const weights = [
        ...visibleRecords.map(record => record.weightKg),
        data.profile.targetWeightKg,
        standardRange.lower,
        standardRange.upper,
    ];
    const minWeight = Math.max(0, Math.floor(Math.min(...weights) - 2));
    const maxWeight = Math.ceil(Math.max(...weights) + 2);
    const pageCount = Math.max(1, Math.ceil(visibleRecords.length / 100));
    const currentTablePage = Math.min(tablePage, pageCount - 1);
    const tableRecords = visibleRecords.slice(currentTablePage * 100, currentTablePage * 100 + 100);

    const handlePeriodChange = (nextPeriod: Period) => {
        const nextRecords = filterRecordsByPeriod(allRecords, nextPeriod, today);
        setPeriod(nextPeriod);
        setSelectedDate(nextRecords.at(-1)?.date ?? null);
        setTablePage(0);
    };

    const selectChartPoint = (state: unknown) => {
        if (typeof state !== 'object' || state === null || !('activePayload' in state)) {
            return;
        }
        const activePayload = state.activePayload;
        if (!Array.isArray(activePayload)) {
            return;
        }
        const record = activePayload[0]?.payload;
        if (isBmiRecord(record)) {
            setSelectedDate(record.date);
        }
    };

    return (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Health
                    overview</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">体重とBMIの記録</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300">CSVに記録した体重の変化を確認できます。</p>
            </div>

            <section aria-label="最新の記録" className="mb-8 grid gap-4 sm:grid-cols-3">
                <article
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="text-sm font-medium text-gray-600 dark:text-gray-300">最新記録</h2>
                    {latestRecord ? (
                        <>
                            <p className="mt-2 text-2xl font-bold">{formatOneDecimal(latestRecord.weightKg)} <span
                                className="text-base font-medium">kg</span></p>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{latestRecord.date}</p>
                        </>
                    ) : <p className="mt-2 text-lg font-semibold">記録がありません</p>}
                </article>
                <article
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="text-sm font-medium text-gray-600 dark:text-gray-300">最新のBMI</h2>
                    {latestRecord ? (
                        <>
                            <p className="mt-2 text-2xl font-bold">{formatOneDecimal(latestRecord.bmi)}</p>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{latestRecord.bmiCategory}</p>
                        </>
                    ) : <p className="mt-2 text-lg font-semibold">—</p>}
                </article>
                <article
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="text-sm font-medium text-gray-600 dark:text-gray-300">目標体重との差</h2>
                    <p className="mt-2 text-2xl font-bold">
                        {difference === null ? '—' : `${difference > 0 ? '+' : ''}${formatOneDecimal(difference)} kg`}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">目標 {formatOneDecimal(data.profile.targetWeightKg)} kg</p>
                </article>
            </section>

            <section
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold">体重の推移</h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            点を選択すると記録の詳細を確認できます。キーボードでは左右矢印キーで記録点を移動できます。
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2" aria-label="表示期間">
                        {periodOptions.map(option => (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={period === option.value}
                                onClick={() => handlePeriodChange(option.value)}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:border-gray-600 dark:hover:bg-gray-700"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-6 h-72 w-full sm:h-96" aria-label="日付ごとの体重推移グラフ">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={visibleRecords}
                            margin={{top: 12, right: 18, left: 0, bottom: 8}}
                            onClick={selectChartPoint}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)"/>
                            <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={24}
                                   tick={{fill: 'var(--chart-text)', fontSize: 12}}/>
                            <YAxis
                                domain={[minWeight, maxWeight]}
                                tick={{fill: 'var(--chart-text)', fontSize: 12}}
                                tickFormatter={value => `${value} kg`}
                                width={64}
                            />
                            <Tooltip
                                formatter={(value, name) => [typeof value === 'number' ? `${formatOneDecimal(value)} kg` : value, name]}
                                labelFormatter={label => `日付: ${label}`}
                            />
                            {visibleRecords.length > 0 && (
                                <ReferenceArea
                                    x1={visibleRecords[0].date}
                                    x2={visibleRecords.at(-1)?.date}
                                    y1={standardRange.lower}
                                    y2={standardRange.upper}
                                    fill="var(--chart-band)"
                                    fillOpacity={0.14}
                                    ifOverflow="extendDomain"
                                    label={{value: 'BMI標準範囲', fill: 'var(--chart-series)', fontSize: 12}}
                                />
                            )}
                            <ReferenceLine
                                y={standardRange.lower}
                                stroke="var(--chart-band)"
                                strokeDasharray="2 3"
                                strokeWidth={2}
                            />
                            <ReferenceLine
                                y={standardRange.upper}
                                stroke="var(--chart-band)"
                                strokeDasharray="2 3"
                                strokeWidth={2}
                            />
                            <ReferenceLine
                                y={data.profile.targetWeightKg}
                                stroke="var(--chart-target)"
                                strokeDasharray="6 4"
                                label={{
                                    value: '目標体重',
                                    fill: 'var(--chart-target)',
                                    fontSize: 12,
                                    position: 'insideTopRight'
                                }}
                            />
                            <Line
                                type="monotone"
                                data={visibleRecords}
                                dataKey="weightKg"
                                name="体重"
                                stroke="var(--chart-series)"
                                strokeWidth={3}
                                activeDot={{r: 8}}
                                dot={(props) => {
                                    const record = isBmiRecord(props.payload) ? props.payload : null;
                                    if (!record || typeof props.cx !== 'number' || typeof props.cy !== 'number') {
                                        return null;
                                    }
                                    return (
                                        <circle
                                            cx={props.cx}
                                            cy={props.cy}
                                            r={5}
                                            fill="var(--chart-series)"
                                            stroke="var(--chart-point-outline)"
                                            strokeWidth={2}
                                            role="button"
                                            tabIndex={selectedRecord?.date === record.date ? 0 : -1}
                                            aria-label={`${record.date} ${formatOneDecimal(record.weightKg)} kg、BMI ${formatOneDecimal(record.bmi)}`}
                                            ref={element => {
                                                if (element) {
                                                    chartPointRefs.current.set(record.date, element);
                                                } else {
                                                    chartPointRefs.current.delete(record.date);
                                                }
                                            }}
                                            onClick={() => setSelectedDate(record.date)}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    setSelectedDate(record.date);
                                                    return;
                                                }
                                                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                                                    event.preventDefault();
                                                    const direction = event.key === 'ArrowLeft' ? -1 : 1;
                                                    const currentIndex = visibleRecords.findIndex(
                                                        item => item.date === record.date,
                                                    );
                                                    const nextRecord = visibleRecords[currentIndex + direction];
                                                    if (nextRecord) {
                                                        setSelectedDate(nextRecord.date);
                                                        chartPointRefs.current.get(nextRecord.date)?.focus();
                                                    }
                                                }
                                            }}
                                        />
                                    );
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60" aria-live="polite">
                    <h3 className="font-semibold">選択中の記録</h3>
                    {selectedRecord ? (
                        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                            <div>
                                <dt className="text-gray-600 dark:text-gray-300">日付</dt>
                                <dd className="font-medium">{selectedRecord.date}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-600 dark:text-gray-300">体重</dt>
                                <dd className="font-medium">{formatOneDecimal(selectedRecord.weightKg)} kg</dd>
                            </div>
                            <div>
                                <dt className="text-gray-600 dark:text-gray-300">BMI</dt>
                                <dd className="font-medium">{formatOneDecimal(selectedRecord.bmi)}（{selectedRecord.bmiCategory}）</dd>
                            </div>
                        </dl>
                    ) : <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">記録がありません</p>}
                </div>

                <details className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <summary
                        className="cursor-pointer px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                        表示中の記録を表で確認（{visibleRecords.length}件）
                    </summary>
                    <div className="overflow-x-auto px-4 pb-4">
                        {visibleRecords.length === 0 ? (
                            <p className="py-4 text-sm text-gray-600 dark:text-gray-300">記録がありません</p>
                        ) : (
                            <>
                                <table className="w-full min-w-[32rem] text-left text-sm">
                                    <caption className="sr-only">表示期間内の体重・BMI記録</caption>
                                    <thead>
                                    <tr className="border-b border-gray-300 dark:border-gray-600">
                                        <th scope="col" className="py-2 pr-4">日付</th>
                                        <th scope="col" className="py-2 pr-4">体重</th>
                                        <th scope="col" className="py-2 pr-4">BMI</th>
                                        <th scope="col" className="py-2">区分</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {tableRecords.map(record => (
                                        <tr key={record.date}
                                            className={`border-b border-gray-100 dark:border-gray-700 ${selectedRecord?.date === record.date ? 'bg-teal-50 dark:bg-teal-950/40' : ''}`}>
                                            <td className="py-2 pr-4">
                                                <button type="button"
                                                        className="text-teal-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-teal-300"
                                                        onClick={() => setSelectedDate(record.date)}>
                                                    {record.date}
                                                </button>
                                            </td>
                                            <td className="py-2 pr-4">{formatOneDecimal(record.weightKg)} kg</td>
                                            <td className="py-2 pr-4">{formatOneDecimal(record.bmi)}</td>
                                            <td className="py-2">{record.bmiCategory}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                {pageCount > 1 && (
                                    <nav className="mt-4 flex items-center justify-between" aria-label="記録一覧ページ">
                                        <button
                                            type="button"
                                            disabled={currentTablePage === 0}
                                            onClick={() => setTablePage(currentTablePage - 1)}
                                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600"
                                        >
                                            前へ
                                        </button>
                                        <span className="text-sm"
                                              aria-live="polite">{currentTablePage + 1} / {pageCount}ページ</span>
                                        <button
                                            type="button"
                                            disabled={currentTablePage >= pageCount - 1}
                                            onClick={() => setTablePage(currentTablePage + 1)}
                                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600"
                                        >
                                            次へ
                                        </button>
                                    </nav>
                                )}
                            </>
                        )}
                    </div>
                </details>
            </section>
            <p className="mt-5 text-sm text-gray-600 dark:text-gray-300">
                BMIの区分は成人向けの目安であり、健康状態を診断するものではありません。
            </p>
        </main>
    );
}
