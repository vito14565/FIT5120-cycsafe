// WMO → emoji
export function wmoToEmoji(code: number): string {
  if (code === 0) return '☀️'
  if ([1, 2].includes(code)) return '⛅️'
  if (code === 3) return '☁️'
  if ([45, 48].includes(code)) return '🌫️'
  if ([51, 53, 55, 56, 57].includes(code)) return '🌦️'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️'
  if ([95, 96, 99].includes(code)) return '⛈️'
  return '🌡️'
}

export function labelForWmo(code: number): string {
  const map: Record<string, number[]> = {
    'Clear': [0],
    'Mainly clear/Partly cloudy': [1, 2],
    'Overcast': [3],
    'Fog': [45, 48],
    'Drizzle': [51, 53, 55, 56, 57],
    'Rain': [61, 63, 65, 66, 67, 80, 81, 82],
    'Snow': [71, 73, 75, 77, 85, 86],
    'Thunderstorm': [95, 96, 99],
  }
  const e = Object.entries(map).find(([, codes]) => codes.includes(code))
  return e?.[0] ?? 'Unknown'
}

/** Map current WMO + wind speed to ATMOSPH_COND (1..9) */
export function mapWeatherToAtmCond(wmo: number, wind_ms?: number): number {
  const HIGH = Number(import.meta.env.VITE_WIND_HIGH_MS ?? 14)
  if ((wind_ms ?? 0) >= HIGH) return 7           // Strong winds
  if (wmo === 0) return 1                        // Clear
  if ([1, 2, 3].includes(wmo)) return 1          // treat cloudy as Clear baseline
  if ([45, 48].includes(wmo)) return 4           // Fog
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(wmo)) return 2 // Rain
  if ([71, 73, 75, 77, 85, 86].includes(wmo)) return 3 // Snow
  if ([95, 96, 99].includes(wmo)) return 2       // Thunderstorm -> Rain
  return 9                                        // Not known
}

export type WxNow = {
  code: number
  emoji: string
  label: string
  wind_ms?: number
  wind_gust_ms?: number
  rain_mm?: number
  snowfall_mm?: number
  showers_mm?: number
}

/** Open-Meteo (extended current): weather_code,rain,wind_speed_10m,wind_gusts_10m,snowfall,showers */
export async function fetchCurrentWeatherExtended(lat: number, lon: number): Promise<WxNow> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', 'weather_code,rain,wind_speed_10m,wind_gusts_10m,snowfall,showers')
  url.searchParams.set('timezone', 'Australia/Sydney')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Weather error: ${res.status}`)
  const data = await res.json()

  const code = Number(data?.current?.weather_code ?? 0)
  const wind_ms = typeof data?.current?.wind_speed_10m === 'number' ? data.current.wind_speed_10m : undefined
  const wind_gust_ms = typeof data?.current?.wind_gusts_10m === 'number' ? data.current.wind_gusts_10m : undefined
  const rain_mm = typeof data?.current?.rain === 'number' ? data.current.rain : undefined
  const snowfall_mm = typeof data?.current?.snowfall === 'number' ? data.current.snowfall : undefined
  const showers_mm = typeof data?.current?.showers === 'number' ? data.current.showers : undefined

  return {
    code,
    emoji: wmoToEmoji(code),
    label: labelForWmo(code),
    wind_ms,
    wind_gust_ms,
    rain_mm,
    snowfall_mm,
    showers_mm
  }
}

