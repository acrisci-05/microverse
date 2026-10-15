import type { LucideIcon } from 'lucide-react'
export function Metric({
  label,
  value,
  unit = '%',
  icon: Icon,
  color = 'cyan',
  detail,
}: {
  label: string
  value: number
  unit?: string
  icon?: LucideIcon
  color?: string
  detail?: string
}) {
  return (
    <div className={`metric metric-${color}`}>
      <div className="metric-label">
        {Icon && <Icon size={14} />}
        <span>{label}</span>
      </div>
      <div className="metric-value">
        {Math.round(value)}
        <span>{unit}</span>
      </div>
      <div className="metric-track">
        <span
          style={{
            width: `${Math.min(100, Math.max(0, unit === '°C' ? (value + 50) / 1.3 : value))}%`,
          }}
        />
      </div>
      {detail && <span className="metric-detail">{detail}</span>}
    </div>
  )
}
