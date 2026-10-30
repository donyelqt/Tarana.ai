import {
  buildDayRouteRequest,
  collectPlanStops,
  type PlanStop,
} from '../planRoute'

const stop = (title: string, lat: number | null, lon: number | null): PlanStop => ({
  title,
  time: '9:00 AM',
  coordinates: lat !== null && lon !== null ? { lat, lon } : null,
})

describe('collectPlanStops', () => {
  it('gathers every activity of the requested day in order', () => {
    const itinerary = {
      title: 'T',
      subtitle: 's',
      items: [
        { period: 'Day 1 - Morning', activities: [{ title: 'A', desc: '', time: '', image: '', tags: [] }] },
        { period: 'Day 1 - Evening', activities: [{ title: 'B', desc: '', time: '', image: '', tags: [] }] },
        { period: 'Day 2 - Morning', activities: [{ title: 'C', desc: '', time: '', image: '', tags: [] }] },
      ],
    }

    const first = collectPlanStops(itinerary as never, 'Day 1')
    expect(first.map((s) => s.title)).toEqual(['A', 'B'])
  })

  it('returns nothing for a day that does not exist', () => {
    const itinerary = {
      title: 'T',
      subtitle: 's',
      items: [{ period: 'Day 1 - Morning', activities: [{ title: 'A', desc: '', time: '', image: '', tags: [] }] }],
    }
    expect(collectPlanStops(itinerary as never, 'Day 9')).toEqual([])
  })
})

describe('buildDayRouteRequest', () => {
  it('draws a route through a day\'s resolved stops', () => {
    const request = buildDayRouteRequest({
      stops: [stop('A', 16.4, 120.5), stop('B', 16.41, 120.51), stop('C', 16.42, 120.52)],
      preferences: { routeType: 'fastest', vehicleType: 'car' },
    })

    expect(request).not.toBeNull()
    expect(request!.origin).toEqual({
      id: 'plan:0:A',
      name: 'A',
      address: 'A',
      lat: 16.4,
      lng: 120.5,
      category: 'Stop',
    })
    expect(request!.destination!.name).toBe('C')
    expect(request!.waypoints).toHaveLength(1)
    expect(request!.waypoints![0].name).toBe('B')
  })

  it('gives every stop an id carrying its title', () => {
    const request = buildDayRouteRequest({
      stops: [stop('A', 16.4, 120.5), stop('B', 16.41, 120.51)],
      preferences: { routeType: 'fastest', vehicleType: 'car' },
    })

    expect(request!.origin!.id).toBe('plan:0:A')
    expect(request!.destination!.id).toBe('plan:1:B')
  })

  it('returns null when fewer than two stops resolve, rather than a broken request', () => {
    expect(
      buildDayRouteRequest({
        stops: [stop('A', 16.4, 120.5), stop('B', null, null)],
        preferences: { routeType: 'fastest', vehicleType: 'car' },
      })
    ).toBeNull()
  })

  it('drops unresolved stops instead of routing to a guess', () => {
    const request = buildDayRouteRequest({
      stops: [stop('A', 16.4, 120.5), stop('B', null, null), stop('C', 16.42, 120.52)],
      preferences: { routeType: 'fastest', vehicleType: 'car' },
    })

    expect(request).not.toBeNull()
    expect(request!.waypoints).toHaveLength(0)
    expect(request!.destination!.name).toBe('C')
  })

  it('returns null when nothing resolves', () => {
    expect(
      buildDayRouteRequest({
        stops: [stop('A', null, null), stop('B', null, null)],
        preferences: { routeType: 'fastest', vehicleType: 'car' },
      })
    ).toBeNull()
  })

  it('caps the waypoints at the route API limit', () => {
    const stops = Array.from({ length: 14 }, (_, i) => stop(`S${i}`, 16.4 + i * 0.001, 120.5 + i * 0.001))
    const request = buildDayRouteRequest({
      stops,
      preferences: { routeType: 'fastest', vehicleType: 'car' },
    })

    expect(request).not.toBeNull()
    expect(request!.waypoints!.length).toBeLessThanOrEqual(10)
    expect(request!.waypoints!.length + 2).toBeLessThanOrEqual(12)
  })

  it('keeps the caller\'s route preferences', () => {
    const request = buildDayRouteRequest({
      stops: [stop('A', 16.4, 120.5), stop('B', 16.41, 120.51)],
      preferences: { routeType: 'fastest', vehicleType: 'car', avoidTolls: true },
    })

    expect(request!.preferences).toEqual({ routeType: 'fastest', vehicleType: 'car', avoidTolls: true })
  })
})