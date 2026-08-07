const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const leap = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
const pad = (value) => String(value).padStart(2, '0')
const padYear = (value) => String(value).padStart(4, '0')

export function parseOperationalDate(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year === 0 || month < 1 || month > 12 || day < 1) return null
  const max = month === 2 && leap(year) ? 29 : DAYS[month - 1]
  return day <= max ? { year, month, day } : null
}

export const isOperationalDate = (value) => parseOperationalDate(value) !== null

export function previousOperationalDate(value) {
  const parsed = parseOperationalDate(value)
  if (!parsed) throw new TypeError('Fecha operativa inválida')
  let { year, month, day } = parsed
  day -= 1
  if (day === 0) {
    month -= 1
    if (month === 0) {
      if (year === 1) {
        throw new RangeError('Fecha operativa anterior no representable')
      }
      year -= 1
      month = 12
    }
    day = month === 2 && leap(year) ? 29 : DAYS[month - 1]
  }
  return `${padYear(year)}-${pad(month)}-${pad(day)}`
}
