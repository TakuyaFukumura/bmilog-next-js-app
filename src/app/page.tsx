import WeightDashboard from './components/WeightDashboard';
import {getTodayInTokyo, loadDashboardData} from '../lib/health-data';

export const dynamic = 'force-dynamic';

export default async function Home() {
    const today = getTodayInTokyo();
    const data = await loadDashboardData(today);
    return <WeightDashboard data={data} today={today}/>;
}
