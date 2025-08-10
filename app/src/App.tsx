import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './App.css'

import L from 'leaflet'
// leaflet-velocity n'exporte pas des types TS; on importe par effet de bord
// @ts-ignore
import 'leaflet-velocity/dist/leaflet-velocity.min.js'

// Configuration France entière
const FR_BBOX = { top: 51.1, bottom: 41.3, left: -5.5, right: 9.8 }
const FR_CENTER: [number, number] = [46.6, 2.2]
const NX = 8
const NY = 8

function buildGrid(
  nx: number,
  ny: number,
  left: number,
  right: number,
  bottom: number,
  top: number,
) {
  const lons: number[] = []
  const lats: number[] = []
  const dx = (right - left) / (nx - 1)
  const dy = (top - bottom) / (ny - 1)
  for (let j = 0; j < ny; j++) {
    const lat = top - j * dy
    for (let i = 0; i < nx; i++) {
      const lon = left + i * dx
      lats.push(lat)
      lons.push(lon)
    }
  }
  return { lats, lons, dx, dy }
}

async function fetchWindData(
  nx: number,
  ny: number,
  bbox: { top: number; bottom: number; left: number; right: number },
): Promise<
  | {
      windData: [
        { header: Record<string, unknown>; data: number[] },
        { header: Record<string, unknown>; data: number[] },
      ]
      source: 'localStorage' | 'api'
    }
  | null
> {
  const now = new Date()
  now.setMinutes(0, 0, 0)

  // Cache clé: bbox + résolution + heure cible
  const pad = (n: number) => String(n).padStart(2, '0')
  const hourKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}T${pad(now.getHours())}:00`
  const cacheKey = `wind:${bbox.left},${bbox.right},${bbox.bottom},${bbox.top}:nx${nx}:ny${ny}:t${hourKey}`
  // Vérifier d'abord le localStorage pour les données existantes
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed && parsed.ts && parsed.windData) {
        // Utiliser les données du localStorage si elles existent
        console.log('Données récupérées du localStorage:', cacheKey)
        return {
          windData: parsed.windData as any,
          source: 'localStorage' as const
        }
      }
    }
  } catch (error) {
    console.warn('Erreur lors de la lecture du localStorage:', error)
  }

  // Tentatives avec réduction auto de la grille si 429/414/erreur réseau
  const basePrimary = 'https://api.open-meteo.com/v1/forecast'
  const hourlyVars = 'wind_speed_10m,wind_direction_10m'
  const timezone = 'auto'

  let currentNX = nx
  let currentNY = ny
  let attempts = 0
  let json: any = null
  let lastGrid: { lats: number[]; lons: number[]; dx: number; dy: number } | null = null

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  while (attempts < 4) {
    attempts++
    const grid = buildGrid(
      currentNX,
      currentNY,
      bbox.left,
      bbox.right,
      bbox.bottom,
      bbox.top,
    )
    lastGrid = grid
    const latParam = grid.lats.join(',')
    const lonParam = grid.lons.join(',')
    const url = `${basePrimary}?latitude=${latParam}&longitude=${lonParam}&hourly=${hourlyVars}&timezone=${timezone}`
    try {
      const resp = await fetch(url)
      if (resp.ok) {
        json = await resp.json()
        // Remplace nx/ny par ceux effectivement utilisés
        nx = currentNX
        ny = currentNY
        break
      }
      if (resp.status === 429 || resp.status === 414) {
        // réduire la grille et retenter
        currentNX = Math.max(4, Math.floor(currentNX * 0.7))
        currentNY = Math.max(4, Math.floor(currentNY * 0.7))
        await sleep(700)
        continue
      }
      console.error('Open-Meteo non-ok status', resp.status)
      return null
    } catch (e) {
      // Erreur réseau: réduire et retenter
      currentNX = Math.max(4, Math.floor(currentNX * 0.7))
      currentNY = Math.max(4, Math.floor(currentNY * 0.7))
      await sleep(700)
      continue
    }
  }
  if (!json) return null

  const firstLoc = (Array.isArray(json) ? json[0] : json) || {}
  const times: string[] | undefined =
    firstLoc?.hourly?.time || firstLoc?.time || undefined
  if (!times) return null

  const target = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}T${pad(now.getHours())}:00`
  let tIdx = times.indexOf(target)
  if (tIdx === -1) {
    let minDiff = Infinity
    for (let i = 0; i < times.length; i++) {
      const dt = Math.abs(new Date(times[i]).getTime() - now.getTime())
      if (dt < minDiff) {
        minDiff = dt
        tIdx = i
      }
    }
  }

  const gridUsed = lastGrid!
  const uArray: number[] = []
  const vArray: number[] = []
  const totalPts = gridUsed.lats.length

  for (let idx = 0; idx < totalPts; idx++) {
    const loc: any = Array.isArray(json) ? json[idx] : json
    if (!loc) {
      uArray.push(0)
      vArray.push(0)
      continue
    }
    const wsArr: number[] | undefined =
      loc.hourly?.wind_speed_10m || loc.wind_speed_10m
    const wdArr: number[] | undefined =
      loc.hourly?.wind_direction_10m || loc.wind_direction_10m
    if (!wsArr || !wdArr) {
      uArray.push(0)
      vArray.push(0)
      continue
    }
    const speed = Array.isArray(wsArr) ? wsArr[tIdx] : (wsArr as any)
    const dir = Array.isArray(wdArr) ? wdArr[tIdx] : (wdArr as any)
    const theta = (dir * Math.PI) / 180
    const u = -speed * Math.sin(theta)
    const v = -speed * Math.cos(theta)
    uArray.push(u)
    vArray.push(v)
  }

  const header = {
    nx,
    ny,
    la1: bbox.top,
    lo1: bbox.left,
    la2: bbox.bottom,
    lo2: bbox.right,
    dx: gridUsed.dx,
    dy: gridUsed.dy,
    dateStamp: new Date().toISOString(),
  }

  const windData = [
    {
      header: {
        ...header,
        parameterCategory: 2,
        parameterNumber: 2,
        parameterUnit: 'km/h',
        refTime: new Date().toISOString(),
      },
      data: uArray,
    },
    {
      header: {
        ...header,
        parameterCategory: 2,
        parameterNumber: 3,
        parameterUnit: 'km/h',
        refTime: new Date().toISOString(),
      },
      data: vArray,
    },
  ] as const

  // Sauvegarder les données dans le localStorage
  try {
    const cacheData = {
      ts: Date.now(),
      windData,
      bbox,
      nx,
      ny,
      hourKey,
      createdAt: new Date().toISOString()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    console.log('Données sauvegardées dans le localStorage:', cacheKey)
  } catch (error) {
    console.warn('Erreur lors de la sauvegarde dans le localStorage:', error)
  }

  return {
    windData: windData as any,
    source: 'api' as const
  }
}

function MapWithVelocity() {
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<'localStorage' | 'api' | null>(null)
  // UI controls
  // density slider maps 1..5000 -> particleMultiplier in [1e-6 .. 5e-3]
  const [densitySlider, setDensitySlider] = useState<number>(500) // 500 -> 5e-4 (plus de particules visibles)
  const particleMultiplier = useMemo(() => densitySlider / 1_000_000, [densitySlider])
  const [lineWidth, setLineWidth] = useState<number>(2.5)
  const mapRef = useRef<L.Map | null>(null)
  const velocityRef = useRef<any>(null)
  const windRef = useRef<any>(null)

  // Fonction pour nettoyer le localStorage et forcer le rechargement
  const clearCacheAndReload = () => {
    try {
      // Nettoyer toutes les clés de cache liées aux vents
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('wind:')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
      console.log('Cache nettoyé, rechargement des données...')
      
      // Recharger les données
      setDataSource(null)
      windRef.current = null
      if (velocityRef.current && mapRef.current) {
        mapRef.current.removeLayer(velocityRef.current)
        velocityRef.current = null
      }
      
      // Déclencher un nouveau chargement
      const load = async () => {
        setLoading(true)
        const result = await fetchWindData(NX, NY, FR_BBOX)
        if (result) {
          windRef.current = result.windData
          setDataSource(result.source)
          applyVelocityLayer()
        }
        setLoading(false)
      }
      load()
    } catch (error) {
      console.warn('Erreur lors du nettoyage du cache:', error)
    }
  }

  // Applique (ou réapplique) la couche velocity en fonction de l'état courant
  const applyVelocityLayer = () => {
    const map = mapRef.current
    const wind = windRef.current
    if (!map || !wind) return
    if (velocityRef.current) {
      map.removeLayer(velocityRef.current)
      velocityRef.current = null
    }
    // @ts-ignore - fourni par leaflet-velocity
    const v = (L as any).velocityLayer({
      data: wind,
      displayValues: true,
      displayOptions: {
        position: 'bottomleft',
        emptyString: '',
        velocityType: '',
        speedUnit: 'km/h',
        directionString: 'Dir.',
        speedString: 'Vit.',
      },
      minVelocity: 0,
      maxVelocity: 25,
      velocityScale: 0.005,
      particleMultiplier,
      lineWidth,
    })
    v.addTo(map)
    velocityRef.current = v
  }

  useEffect(() => {
    if (mapRef.current) return
    const map = L.map('map', { zoomControl: true }).setView(
      FR_CENTER,
      5,
    )
    mapRef.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
  }, [])

  // (bbox retirée)

  // Fetch des vents (une fois au montage)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const result = await fetchWindData(NX, NY, FR_BBOX)
      if (cancelled) return
      if (result) {
        windRef.current = result.windData
        setDataSource(result.source)
        // Applique immédiatement la couche à l'arrivée des données
        applyVelocityLayer()
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Applique/rafraîchit la couche quand paramètres changent (sans refetch)
  useEffect(() => {
    applyVelocityLayer()
  }, [particleMultiplier, lineWidth])

  return (
    <div className="appContainer">
      <div className="toolbar">
 
        <div className="sliders">
          <label className="sliderRow">
            Densité:
            <input
              type="range"
            min={1}
            max={5000}
              step={1}
              value={densitySlider}
              onChange={(e) => setDensitySlider(Number(e.target.value))}
            />
            {/* <span style={{ minWidth: 80 }}>
              {particleMultiplier.toExponential(1)}
            </span> */}
          </label>
          <label className="sliderRow">
            Épaisseur:
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
            />
            {/* <span style={{ minWidth: 40 }}>{lineWidth.toFixed(1)}</span> */}
          </label>
        </div>
        {loading ? <span>Chargement…</span> : null}
        {dataSource && (
          <span style={{ 
            fontSize: '0.8em', 
            color: dataSource === 'localStorage' ? '#4CAF50' : '#2196F3',
            fontWeight: 'bold'
          }}>
            {dataSource === 'localStorage' ? 'local' : 'API'}
          </span>
        )}
        <button 
          onClick={clearCacheAndReload}
          style={{
            fontSize: '0.8em',
            padding: '4px 8px',
            marginLeft: '10px',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          title="Nettoyer le cache et recharger depuis l'API"
        >
        🔄
        </button>
      </div>

      <div id="map" className="map" />
            {/* Badge GitHub */}
            <div style={{
        position: 'relative',
        bottom: '50px',
        left: '10px',
        zIndex: 1000
      }}>
        <a 
          href="https://github.com/wxcvbnlmjk/velov" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <img 
            src="https://img.shields.io/github/last-commit/wxcvbnlmjk/velov" 
            alt="Last commit"
            style={{
              height: '20px',
              width: 'auto'
            }}
          />
        </a>

      </div>
            {/* Badge GitHub */}
      <div style={{
        position: 'relative',
        bottom: '100px',
        left: '10px',
        zIndex: 2000
      }}>
        <a 
          href="https://open-meteo.com/en/docs" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <img 
            src="https://img.shields.io/badge/open_meteo-blue" 
            alt="Open-Meteo"
            style={{
              height: '20px',
              width: 'auto'
            }}
          />
        </a>
      </div>

      <div id="map" className="map" />
      
    </div>
  )
}

export default function App() {
  return <MapWithVelocity />
}
