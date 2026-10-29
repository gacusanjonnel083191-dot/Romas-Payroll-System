const API = 'https://api.heigit.org'
const BOUNDS = {minLat:15.7,maxLat:16.3,minLon:120,maxLon:120.7}

export function validDeliveryPoint(latitude, longitude) {
  const lat = Number(latitude), lon = Number(longitude)
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat
    && lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon
}

export function deliveryFeeForDistance(km) {
  return 80 + 10 * Math.ceil(Math.max(0, km - 3))
}

export async function roadRoute(origin, destination, apiKey, fetcher = fetch) {
  if (!apiKey || !validDeliveryPoint(origin.latitude, origin.longitude)
    || !validDeliveryPoint(destination.latitude, destination.longitude)) throw new Error('Route is unavailable.')
  const response = await fetcher(`${API}/openrouteservice/v2/directions/driving-car/json`, {
    method:'POST', headers:{Authorization:apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({coordinates:[
      [Number(origin.longitude),Number(origin.latitude)],
      [Number(destination.longitude),Number(destination.latitude)],
    ]}), signal:AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('Route is unavailable.')
  const result = await response.json()
  const metres = Number(result?.routes?.[0]?.summary?.distance)
  if (!Number.isFinite(metres) || metres <= 0 || metres > 100_000) throw new Error('No usable driving route was found.')
  const km = Math.round(metres) / 1000
  return {km,fee:deliveryFeeForDistance(km)}
}

export async function addressSuggestions(query, apiKey, fetcher = fetch) {
  const text = String(query || '').trim().slice(0,100)
  if (!apiKey || text.length < 3) return []
  const url = new URL(`${API}/pelias/v1/autocomplete`)
  url.searchParams.set('text',text)
  url.searchParams.set('boundary.country','PH')
  url.searchParams.set('focus.point.lat','16.04')
  url.searchParams.set('focus.point.lon','120.34')
  url.searchParams.set('size','8')
  const response = await fetcher(url,{headers:{Authorization:apiKey},signal:AbortSignal.timeout(8000)})
  if (!response.ok) throw new Error('Address search is temporarily unavailable.')
  const result = await response.json()
  return (Array.isArray(result?.features) ? result.features : []).flatMap(feature=>{
    const [longitude,latitude] = feature?.geometry?.coordinates || []
    const label = feature?.properties?.label
    return validDeliveryPoint(latitude,longitude) && typeof label === 'string' && label.trim()
      ? [{label:label.trim().slice(0,300),latitude:Number(latitude),longitude:Number(longitude)}] : []
  })
}

export async function reverseAddress(latitude, longitude, apiKey, fetcher = fetch) {
  if (!apiKey || !validDeliveryPoint(latitude,longitude)) throw new Error('Address lookup is unavailable.')
  const url = new URL(`${API}/pelias/v1/reverse`)
  url.searchParams.set('point.lat',String(latitude))
  url.searchParams.set('point.lon',String(longitude))
  url.searchParams.set('size','1')
  const response = await fetcher(url,{headers:{Authorization:apiKey},signal:AbortSignal.timeout(8000)})
  if (!response.ok) throw new Error('Address lookup is temporarily unavailable.')
  const result = await response.json()
  const label = result?.features?.[0]?.properties?.label
  return typeof label === 'string' && label.trim() ? label.trim().slice(0,300) : null
}
