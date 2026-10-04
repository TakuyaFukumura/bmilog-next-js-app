import {fireEvent, render, screen, within} from '@testing-library/react';
import WeightDashboard from '../../../../src/app/components/WeightDashboard';
import type {DashboardDataResult} from '../../../../src/lib/health-data';

jest.mock('recharts', () => {
    const passthrough = ({children}: { children?: import('react').ReactNode }) => <div>{children}</div>;
    const {cloneElement} = jest.requireActual<typeof import('react')>('react');
    return {
        CartesianGrid: () => null,
        Line: ({activeDot, data, dot}: {
            data?: { date: string; weightKg: number; bmi: number; bmiCategory: string }[];
            activeDot?: (props: { payload: unknown; cx: number; cy: number }) => import('react').ReactNode;
            dot?: ((props: { payload: unknown; cx: number; cy: number }) => import('react').ReactNode)
                | import('react').ReactElement<{ payload?: unknown; cx?: number; cy?: number }>;
        }) => (
            <svg>
                {data?.[0] && activeDot && (
                    <g data-testid="active-chart-point">
                        {activeDot({payload: data[0], cx: 10, cy: 10})}
                    </g>
                )}
                {data?.map(record => {
                    const point = {payload: record, cx: 10, cy: 10};
                    const renderedDot = typeof dot === 'function'
                        ? dot(point)
                        : dot ? cloneElement(dot, point) : null;
                    return <g key={record.date}>{renderedDot}</g>;
                })}
            </svg>
        ),
        LineChart: passthrough,
        ReferenceArea: () => null,
        ReferenceLine: () => null,
        ResponsiveContainer: passthrough,
        Tooltip: ({contentStyle, itemStyle, labelFormatter, labelStyle}: {
            contentStyle?: import('react').CSSProperties;
            itemStyle?: import('react').CSSProperties;
            labelFormatter?: (label: import('react').ReactNode) => import('react').ReactNode;
            labelStyle?: import('react').CSSProperties;
        }) => (
            <div
                data-testid="tooltip-label"
                data-background-color={contentStyle?.backgroundColor}
                data-border-color={contentStyle?.borderColor}
                data-text-color={contentStyle?.color}
            >
                <span data-testid="tooltip-date" data-text-color={labelStyle?.color}>
                    {labelFormatter?.('2026-10-04')}
                </span>
                <span data-text-color={itemStyle?.color}>
                    {labelFormatter?.(<span>未対応のラベル形式</span>)}
                </span>
            </div>
        ),
        XAxis: () => null,
        YAxis: () => null,
    };
});

const dashboardData: DashboardDataResult = {
    status: 'ok',
    profile: {heightCm: 171, targetWeightKg: 64},
    records: [
        {date: '2026-08-31', weightKg: 75},
        {date: '2026-09-22', weightKg: 74.4},
        {date: '2026-10-04', weightKg: 73.5},
    ],
};

describe('WeightDashboard', () => {
    it('最新のサマリー、期間切替、記録の選択を表示する', () => {
        render(<WeightDashboard data={dashboardData} today="2026-10-04"/>);

        expect(screen.queryByText(/Health overview/)).not.toBeInTheDocument();
        expect(screen.queryByText('CSVに記録した体重の変化を確認できます。')).not.toBeInTheDocument();
        expect(screen.getByText('73.5', {selector: 'p'})).toBeInTheDocument();
        expect(screen.getByLabelText('身長 (cm)')).toHaveValue(171);
        expect(screen.getByText('+9.5 kg', {selector: 'p'})).toBeInTheDocument();
        expect(screen.getByText(/目標 64\.0 kg/)).toBeInTheDocument();
        expect(screen.getAllByText('2026-10-04').length).toBeGreaterThan(0);
        expect(screen.getByTestId('tooltip-label')).toHaveTextContent('日付: 2026-10-04');
        expect(screen.getByTestId('tooltip-label')).toHaveTextContent('日付: —');
        expect(screen.getByTestId('tooltip-label')).toHaveAttribute('data-background-color', 'var(--chart-tooltip-background)');
        expect(screen.getByTestId('tooltip-label')).toHaveAttribute('data-border-color', 'var(--chart-tooltip-border)');
        expect(screen.getByTestId('tooltip-label')).toHaveAttribute('data-text-color', 'var(--chart-tooltip-text)');
        expect(screen.getByTestId('tooltip-date')).toHaveAttribute('data-text-color', 'var(--chart-tooltip-text)');

        fireEvent.click(screen.getByRole('button', {name: '1か月'}));
        expect(screen.getByRole('button', {name: '1か月'})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('button', {name: '2026-08-31'})).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: '2026-09-22'}));
        const detail = screen.getByText('選択中の記録').parentElement;
        expect(detail).not.toBeNull();
        expect(within(detail as HTMLElement).getByText('2026-09-22')).toBeInTheDocument();
        expect(within(detail as HTMLElement).getByText('74.4 kg')).toBeInTheDocument();
        expect(within(detail as HTMLElement).getByText('+10.4 kg')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: '全期間'}));
        const chartPoint = screen.getAllByRole('button', {name: /2026-08-31/})
            .find(element => element.tagName.toLowerCase() === 'circle');
        if (!chartPoint) {
            throw new Error('グラフ上の記録点が見つかりません');
        }
        fireEvent.click(chartPoint);
        expect(within(detail as HTMLElement).getByText('2026-08-31')).toBeInTheDocument();
        expect(within(detail as HTMLElement).getByText('+11.0 kg')).toBeInTheDocument();

        const keyboardPoint = screen.getAllByRole('button', {name: /2026-09-22/})
            .find(element => element.tagName.toLowerCase() === 'circle');
        if (!keyboardPoint) {
            throw new Error('キーボード操作対象のグラフ点が見つかりません');
        }
        keyboardPoint.focus();
        fireEvent.keyDown(keyboardPoint, {key: 'Enter'});
        expect(within(detail as HTMLElement).getByText('2026-09-22')).toBeInTheDocument();

        fireEvent.keyDown(keyboardPoint, {key: 'ArrowRight'});
        const latestPoint = screen.getAllByRole('button', {name: /2026-10-04/})
            .find(element => element.tagName.toLowerCase() === 'circle');
        expect(latestPoint).toHaveFocus();
        expect(latestPoint).toHaveAttribute('tabindex', '0');
        expect(keyboardPoint).toHaveAttribute('tabindex', '-1');
        expect(within(detail as HTMLElement).getByText('2026-10-04')).toBeInTheDocument();
    });

    it('身長を更新するとBMIに反映され、再読み込み時は初期値に戻る', () => {
        const {unmount} = render(<WeightDashboard data={dashboardData} today="2026-10-04"/>);

        expect(screen.getByText('25.1', {selector: 'p'})).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('身長 (cm)'), {target: {value: '172'}});

        expect(screen.getByLabelText('身長 (cm)')).toHaveValue(172);
        expect(screen.getByText('24.8', {selector: 'p'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '更新'})).not.toBeInTheDocument();

        unmount();
        render(<WeightDashboard data={dashboardData} today="2026-10-04"/>);
        expect(screen.getByLabelText('身長 (cm)')).toHaveValue(171);
        expect(screen.getByText('25.1', {selector: 'p'})).toBeInTheDocument();
    });

    it('ホバー中のグラフ点をクリックしても記録を選択できる', () => {
        render(<WeightDashboard data={dashboardData} today="2026-10-04"/>);

        fireEvent.click(within(screen.getByTestId('active-chart-point'))
            .getByRole('button', {name: /2026-08-31/}));

        const detail = screen.getByText('選択中の記録').parentElement;
        expect(detail).not.toBeNull();
        expect(within(detail as HTMLElement).getByText('2026-08-31')).toBeInTheDocument();
        expect(within(detail as HTMLElement).getByText('75.0 kg')).toBeInTheDocument();
    });

    it('無効な身長では更新しない', () => {
        render(<WeightDashboard data={dashboardData} today="2026-10-04"/>);

        fireEvent.change(screen.getByLabelText('身長 (cm)'), {target: {value: '0'}});

        expect(screen.getByRole('alert')).toHaveTextContent('身長は0より大きく300 cm以下');
        expect(screen.getByLabelText('身長 (cm)')).toHaveValue(0);
        expect(screen.getByText('25.1', {selector: 'p'})).toBeInTheDocument();
    });

    it('目標体重を下回る差分にはプラス符号を付けない', () => {
        const belowTarget: DashboardDataResult = {
            status: 'ok',
            profile: {heightCm: 170, targetWeightKg: 68},
            records: [{date: '2026-10-04', weightKg: 65}],
        };
        render(<WeightDashboard data={belowTarget} today="2026-10-04"/>);

        expect(screen.getByText('-3.0 kg', {selector: 'p'})).toBeInTheDocument();
    });

    it('CSV検証エラーは行番号と理由を表示する', () => {
        render(<WeightDashboard
            data={{status: 'invalid', issues: [{file: 'data/weight-sample.csv', line: 4, reason: '体重が不正です'}]}}
            today="2026-10-04"
        />);

        expect(screen.getByRole('alert')).toHaveTextContent('4行目');
        expect(screen.getByRole('alert')).toHaveTextContent('体重が不正です');
    });

    it('100件を超える記録は表でページ分割する', () => {
        const records = Array.from({length: 101}, (_, index) => ({
            date: new Date(Date.UTC(2026, 9, 4 - 100 + index)).toISOString().slice(0, 10),
            weightKg: 70 + index / 10,
        }));
        const data: DashboardDataResult = {
            status: 'ok',
            profile: {heightCm: 170, targetWeightKg: 68},
            records,
        };
        render(<WeightDashboard data={data} today="2026-10-04"/>);
        fireEvent.click(screen.getByText(/表示中の記録を表で確認/));

        expect(screen.getAllByRole('button').filter(button => /^\d{4}-\d{2}-\d{2}$/.test(button.textContent ?? ''))).toHaveLength(100);
        fireEvent.click(screen.getByRole('button', {name: '次へ'}));
        expect(screen.getByRole('button', {name: '2026-10-04'})).toBeInTheDocument();
        expect(screen.getByText('2 / 2ページ')).toBeInTheDocument();
    });

    it('1,000件すべてをグラフの選択可能な点として渡す', () => {
        const records = Array.from({length: 1000}, (_, index) => ({
            date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10),
            weightKg: 50 + index / 10,
        }));
        const data: DashboardDataResult = {
            status: 'ok',
            profile: {heightCm: 170, targetWeightKg: 68},
            records,
        };
        render(<WeightDashboard data={data} today="2026-10-04"/>);

        const chartPoints = screen.getAllByRole('button')
            .filter(element => element.tagName.toLowerCase() === 'circle' &&
                element.getAttribute('r') === '5');
        expect(chartPoints).toHaveLength(1000);
        expect(chartPoints.filter(element => element.getAttribute('tabindex') === '0')).toHaveLength(1);
        expect(chartPoints.filter(element => element.getAttribute('tabindex') === '-1')).toHaveLength(999);
    });

    it('空の記録と読み込み失敗を区別する', () => {
        const emptyData: DashboardDataResult = {
            status: 'ok',
            profile: {heightCm: 170, targetWeightKg: 68},
            records: [],
        };
        const {rerender} = render(<WeightDashboard data={emptyData} today="2026-10-04"/>);
        expect(screen.getAllByText('記録がありません').length).toBeGreaterThan(0);

        rerender(<WeightDashboard data={{status: 'unreadable', files: ['data/profile-sample.csv']}}
                                  today="2026-10-04"/>);
        expect(screen.getByRole('alert')).toHaveTextContent('データを読み込めません');
        expect(screen.getByRole('alert')).toHaveTextContent('data/profile-sample.csv');
    });
});
