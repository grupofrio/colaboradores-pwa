// Guard cliente de despacho: fail-closed si el almacén del ticket o el del
// empleado no está conocido. El servidor sigue siendo la autoridad.

export function getTicketWarehouseId(ticket) {
  if (!ticket) return 0
  const warehouse = ticket.warehouse_id
  if (typeof warehouse === 'number') return warehouse
  if (Array.isArray(warehouse) && typeof warehouse[0] === 'number') return warehouse[0]
  return 0
}

export function isTicketFromMyWarehouse(ticket, warehouseId) {
  const mine = Number(warehouseId || 0)
  if (!mine) return false
  const ticketWarehouseId = getTicketWarehouseId(ticket)
  if (!ticketWarehouseId) return false
  return ticketWarehouseId === mine
}
