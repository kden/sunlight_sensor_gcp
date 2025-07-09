import SensorGraph from '@/app/components/SensorGraph';

export default function GraphPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-teal-400">Sensor Readings</h2>
      <SensorGraph />
    </div>
  );
}