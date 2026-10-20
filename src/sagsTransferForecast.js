// A delivery contributes pieces to production planning, but never sales or AR.
export function isSagsTransferSchemaMissing(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  return (code === 'PGRST205' || code === '42P01') && /sags_internal_transfers/i.test(message)
}

export function sagsTransfersAsForecastDeliveries(transfers = [], resellerId = null) {
  return (transfers || []).map(transfer => ({
    id:`internal-transfer-${transfer.id}`,
    invoice_number:transfer.transfer_number,
    delivery_date:transfer.delivery_date,
    status:'delivered',
    reseller_id:resellerId,
    reseller_name:'SAGS',
    customer_type:'internal_transfer',
    total_amount:0,
    paid_amount:0,
    delivery_invoice_items:(transfer.sags_internal_transfer_items || []).map(item => ({
      variant_id:item.variant_id,
      variant_name:item.variant_name,
      quantity:Number(item.quantity) || 0,
      total_price:0
    }))
  }))
}
