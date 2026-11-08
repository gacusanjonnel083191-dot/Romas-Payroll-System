/**
 * Surgically extends the existing owner invoice-deletion approval action row.
 * Kept as a transform because App.jsx is an exceptionally large legacy file
 * and the GitHub content API cannot reliably return it in a single response.
 * Refuse to build if the original approval UI changes unexpectedly.
 */
export function invoiceDeletionFullPreview() {
  let patched = false
  return {
    name: 'invoice-deletion-full-preview',
    enforce: 'pre',
    transform(code, id) {
      const path = id.split('?')[0].replace(/\\/g, '/')
      if (!path.endsWith('/src/App.jsx')) return null
      const anchor = ">{rejecting ? 'Processing...' : 'Reject'}</button>"
      const occurrences = code.split(anchor).length - 1
      if (occurrences !== 1 || !code.includes('function renderInvoiceDeletionApprovalCenter()')) {
        this.error('Invoice preview injection could not find the unique deletion approval action. No unverified UI changes were built.')
      }
      patched = true
      const addition = `<InvoiceDeletionPreviewButton request={request} disabled={approving || rejecting} sortItems={sortDeliveryInvoiceItems} />`
      return {
        code: "import InvoiceDeletionPreviewButton from './InvoiceDeletionPreviewButton.jsx'\n" +
          code.replace(anchor, anchor + '\n          ' + addition),
        map: null,
      }
    },
    generateBundle() {
      if (!patched) this.error('Invoice preview was not applied to App.jsx. Build stopped to prevent silent omission.')
    },
  }
}
