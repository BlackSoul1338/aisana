'use client'

import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { useRouter } from 'next/navigation'
import { MapTooltip } from './MapTooltip'

const GEO_URL = '/data/kazakhstan.geojson'

interface RegionStat {
  id: string
  name: string
  nameKz?: string | null
  code: string
  universityCount: number
  projectCount: number
}

interface Props { regions: RegionStat[] }
interface TooltipState { x: number; y: number; region: RegionStat | null }

// Нулевой класс и обводка — из CSS-переменных (зависят от темы),
// остальные оттенки синего одинаковы в обеих темах.
function getColor(n: number): string {
  if (n === 0) return 'var(--map-0)'
  if (n <= 5) return 'var(--map-1)'
  if (n <= 15) return 'var(--map-2)'
  if (n <= 30) return 'var(--map-3)'
  return 'var(--map-4)'
}

const NAME_TO_CODE: Record<string, string> = {
  Akmola: 'AKM', 'Akmola Region': 'AKM',
  Aktobe: 'AKT', 'Aktobe Region': 'AKT',
  Almaty: 'ALM', 'Almaty Region': 'ALM',
  'Almaty City': 'ALA', 'Almaty (city)': 'ALA',
  Astana: 'AST', 'Astana City': 'AST',
  Atyrau: 'ATY', 'Atyrau Region': 'ATY',
  'East Kazakhstan': 'VKO', 'East Kazakhstan Region': 'VKO',
  Jambyl: 'ZHM', 'Jambyl Region': 'ZHM',
  'West Kazakhstan': 'ZKO', 'West Kazakhstan Region': 'ZKO',
  Karaganda: 'KAR', 'Karaganda Region': 'KAR',
  Kostanay: 'KST', 'Kostanay Region': 'KST',
  Kyzylorda: 'KZL', 'Kyzylorda Region': 'KZL',
  Mangystau: 'MAN', 'Mangystau Region': 'MAN',
  'North Kazakhstan': 'SKO', 'North Kazakhstan Region': 'SKO',
  Pavlodar: 'PAV', 'Pavlodar Region': 'PAV',
  'South Kazakhstan': 'TUR', 'South Kazakhstan Region': 'TUR',
  Turkestan: 'TUR', 'Turkestan Region': 'TUR',
  'Shymkent City': 'SHY', 'Shymkent (city)': 'SHY',
  Abai: 'ABA', 'Abai Region': 'ABA',
  Jetisu: 'ZHT', 'Jetisu Region': 'ZHT',
  Ulytau: 'ULY', 'Ulytau Region': 'ULY',
}

const ISO_TO_CODE: Record<string, string> = {
  'KZ-AKM': 'AKM', 'KZ-AKT': 'AKT', 'KZ-ALA': 'ALA', 'KZ-ALM': 'ALM',
  'KZ-AST': 'AST', 'KZ-ATY': 'ATY', 'KZ-KAR': 'KAR', 'KZ-KUS': 'KST',
  'KZ-KZY': 'KZL', 'KZ-MAN': 'MAN', 'KZ-PAV': 'PAV', 'KZ-SEV': 'SKO',
  'KZ-VOS': 'VKO', 'KZ-YUZ': 'TUR', 'KZ-ZAP': 'ZKO', 'KZ-ZHA': 'ZHM',
}

const SIMPLEMAPS_ID_TO_CODE: Record<string, string> = {
  KZ10: 'ABA', KZ11: 'AKM', KZ15: 'AKT', KZ19: 'ALM', KZ23: 'ATY',
  KZ27: 'ZKO', KZ31: 'ZHM', KZ33: 'ZHT', KZ35: 'KAR', KZ39: 'KST',
  KZ43: 'KZL', KZ47: 'MAN', KZ55: 'PAV', KZ59: 'SKO', KZ61: 'TUR',
  KZ62: 'ULY', KZ63: 'VKO', KZ71: 'AST', KZ75: 'ALA', KZ79: 'SHY',
}

export default function KazakhstanMap({ regions }: Props) {
  const router = useRouter()
  const [tooltip, setTooltip] = useState<TooltipState>({ x: 0, y: 0, region: null })
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)
  const regionMap = new Map(regions.map(r => [r.code, r]))

  function getRegion(props: Record<string, string>): RegionStat | null {
    const smCode = SIMPLEMAPS_ID_TO_CODE[props.id || '']
    if (smCode) return regionMap.get(smCode) || null
    const iso = props.shapeISO || props.iso || props.ISO || ''
    const isoCode = ISO_TO_CODE[iso]
    if (isoCode) return regionMap.get(isoCode) || null
    const name = props.shapeName || props.name || props.NAME || props.NAME_1 || ''
    const code = NAME_TO_CODE[name]
    if (code) return regionMap.get(code) || null
    for (const [key, rc] of Object.entries(NAME_TO_CODE)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return regionMap.get(rc) || null
    }
    return null
  }

  return (
    <div className="w-full h-full relative select-none">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 1100, center: [67, 48] }}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
        className="filter drop-shadow-[0_12px_24px_rgba(15,23,42,0.08)] drop-shadow-[0_2px_6px_rgba(15,23,42,0.04)] dark:drop-shadow-none"
      >
        <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={6}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => {
                const region = getRegion(geo.properties)
                const isHovered = hoveredCode !== null && region?.code === hoveredCode
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isHovered ? '#f59e0b' : (region ? getColor(region.projectCount) : 'var(--map-0)')}
                    stroke="var(--map-stroke)"
                    strokeWidth={1}
                    style={{
                      default: { outline: 'none', transition: 'fill 0.2s ease' },
                      hover: { outline: 'none', fill: '#f59e0b', cursor: 'pointer' },
                      pressed: { outline: 'none', fill: '#d97706' },
                    }}
                    onMouseEnter={evt => {
                      if (region) {
                        setHoveredCode(region.code)
                        setTooltip({ x: evt.clientX, y: evt.clientY, region })
                      }
                    }}
                    onMouseMove={evt => {
                      if (tooltip.region) setTooltip(p => ({ ...p, x: evt.clientX, y: evt.clientY }))
                    }}
                    onMouseLeave={() => {
                      setHoveredCode(null)
                      setTooltip({ x: 0, y: 0, region: null })
                    }}
                    onClick={() => {
                      if (region) router.push(`/regions/${region.code.toLowerCase()}`)
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip.region && (
        <MapTooltip x={tooltip.x} y={tooltip.y} region={tooltip.region} />
      )}
    </div>
  )
}
