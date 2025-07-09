import SensorGraph from '@/app/components/SensorGraph';

export default function GraphPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-amber-400">Sensor Levels</h2>
      <SensorGraph />
    </div>
  );
}