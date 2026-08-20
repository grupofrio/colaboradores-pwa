import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAttendancePreflight, validateCupQuantity } from '../src/modules/favy/favyGuards.js'

test('attendance accepts a precise point inside the 50 m CEDIS fence', () => {
  assert.equal(validateAttendancePreflight({
    selfie: 'data:image/jpeg;base64,a',
    facade: 'data:image/jpeg;base64,b',
    latitude: 19.411386,
    longitude: -99.147021,
    accuracy: 12,
  }).ok, true)
})

test('attendance rejects points outside the fence or low-precision GPS', () => {
  assert.equal(validateAttendancePreflight({
    selfie: 'data:image/jpeg;base64,a',
    facade: 'data:image/jpeg;base64,b',
    latitude: 19.4125,
    longitude: -99.147021,
    accuracy: 12,
  }).ok, false)
  assert.equal(validateAttendancePreflight({
    selfie: 'data:image/jpeg;base64,a',
    facade: 'data:image/jpeg;base64,b',
    latitude: 19.411386,
    longitude: -99.147021,
    accuracy: 26,
  }).ok, false)
})

test('cup quantity must be a positive integer', () => {
  assert.equal(validateCupQuantity(0).ok, false)
  assert.equal(validateCupQuantity(3.5).ok, false)
  assert.equal(validateCupQuantity(12).ok, true)
})
