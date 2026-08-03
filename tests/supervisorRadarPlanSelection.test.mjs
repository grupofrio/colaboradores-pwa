import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRadarPlanOptions,
  buildSelectedPlanPoints,
  isPlanId,
  resolveActivePlanId,
} from '../src/modules/supervisor-ventas/v2/radar/radarSelection.js'

const NOW = Date.parse('2026-08-03T12:00:00Z')

const units = [
  {
    plan_id: 31, route_name: 'Ruta Centro', name: 'Manuel Cruz',
    vehicle: { name: 'U-31' }, latitude: 18.34, longitude: -99.53,
    signal_status: 'recent',
    stops: { planned: [{ stop_id: 311, name: 'Cliente Centro', latitude: 18.35, longitude: -99.54, done: false }] },
  },
  {
    plan_id: 32, route_name: 'Ruta Norte', name: 'Esteban Meza',
    vehicle: { name: 'U-32' }, latitude: 18.44, longitude: -99.63,
    signal_status: 'delayed',
    stops: { planned: [{ stop_id: 321, name: 'Cliente Norte', latitude: 18.45, longitude: -99.64, done: true }] },
  },
]

test('plan IDs accept only positive safe integers', () => {
  assert.equal(isPlanId(1), true)
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null, NaN, Infinity]) {
    assert.equal(isPlanId(value), false, String(value))
  }
})

test('active plan defaults to the first valid raw-response plan and retains a valid choice', () => {
  const raw = [{ plan_id: '99' }, { plan_id: -1 }, ...units]
  assert.equal(resolveActivePlanId(raw, null), 31)
  assert.equal(resolveActivePlanId(raw, 32), 32)
})

test('absent or stale requested selections revert to the first valid raw plan', () => {
  assert.equal(resolveActivePlanId(units, 999), 31)
  assert.equal(resolveActivePlanId(units, '31'), 31)
  assert.equal(resolveActivePlanId([], 31), null)
  assert.equal(resolveActivePlanId(null, 31), null)
  assert.equal(resolveActivePlanId([{ plan_id: 0 }, { plan_id: '4' }], 4), null)
})

test('selection remains based on raw response order, independent of visual sorting', () => {
  const raw = [units[0], units[1]]
  const visuallySorted = [units[1], units[0]]
  assert.equal(resolveActivePlanId(raw, null), 31)
  assert.equal(visuallySorted[0].plan_id, 32)
  assert.equal(resolveActivePlanId(raw, null), 31)
})

test('plan options retain raw order and use Radar label fallbacks', () => {
  const options = buildRadarPlanOptions([
    { plan_id: 44, route_name: '', name: '', vehicle: {} },
    { plan_id: '45', route_name: 'Ignorada' },
    units[1],
  ])
  assert.deepEqual(options, [
    { planId: 44, label: 'Ruta sin nombre · Sin responsable · Sin unidad' },
    { planId: 32, label: 'Ruta Norte · Esteban Meza · U-32' },
  ])
})

test('selected-plan geometry contains only the active unit and its planned stops, never CEDIS or another plan', () => {
  const points = buildSelectedPlanPoints({
    branch: { branch_config_id: 1, latitude: 18.3, longitude: -99.5 },
    units,
  }, 32, NOW)
  assert.deepEqual(points, [
    { id: 32, lat: 18.44, lng: -99.63, kind: 'unit_stale', label: 'Ruta Norte' },
    { id: 'stop:321', lat: 18.45, lng: -99.64, kind: 'stop_done', label: 'Cliente Norte' },
  ])
})

test('selected-plan geometry rejects invalid, non-finite, out-of-range, and null-island coordinates', () => {
  const points = buildSelectedPlanPoints({ units: [{
    plan_id: 71, route_name: 'Ruta segura', name: 'Responsable', vehicle: { name: 'U-71' },
    latitude: 0, longitude: 0, signal_status: 'recent',
    stops: {
      planned: [
        { stop_id: 1, name: 'Nula', latitude: 0, longitude: 0, done: false },
        { stop_id: 2, name: 'Fuera', latitude: 91, longitude: -99, done: false },
        { stop_id: 3, name: 'Infinita', latitude: Infinity, longitude: -99, done: false },
        { stop_id: 4, name: 'Válida', latitude: 18.7, longitude: -99.7, done: false },
      ],
    },
  }] }, 71, NOW)
  assert.deepEqual(points, [
    { id: 'stop:4', lat: 18.7, lng: -99.7, kind: 'stop_pending', label: 'Válida' },
  ])
})

test('planned and completed stop kinds stay distinct', () => {
  const points = buildSelectedPlanPoints({ units: [{
    plan_id: 81, latitude: 18.8, longitude: -99.8, signal_status: 'recent',
    stops: { planned: [
      { stop_id: 811, latitude: 18.81, longitude: -99.81, done: true },
      { stop_id: 812, latitude: 18.82, longitude: -99.82, done: false },
    ] },
  }] }, 81, NOW)
  assert.deepEqual(points.map(({ id, kind }) => ({ id, kind })), [
    { id: 81, kind: 'unit' },
    { id: 'stop:811', kind: 'stop_done' },
    { id: 'stop:812', kind: 'stop_pending' },
  ])
})
