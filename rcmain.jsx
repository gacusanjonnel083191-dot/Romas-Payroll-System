warning: in the working copy of 'src/App.jsx', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/src/App.jsx b/src/App.jsx[m
[1mindex a4cabfe..fcab9f3 100644[m
[1m--- a/src/App.jsx[m
[1m+++ b/src/App.jsx[m
[36m@@ -8344,7 +8344,7 @@[m [mfunction buildDeliveryInvoicePrintCSS() {[m
  }[m
 [m
  function wordRun(text, opts = {}) {[m
[31m-   const size = opts.size || 15[m
[32m+[m[32m   const size = opts.size || 13[m
    // Use bold as the default for invoice readability on 4x6 thermal/photo paper.[m
    // Pass bold:false only for intentionally light text.[m
    const bold = opts.bold === false ? '' : '<w:b/><w:bCs/>'[m
[36m@@ -8357,8 +8357,8 @@[m [mfunction buildDeliveryInvoicePrintCSS() {[m
    const align = opts.align || 'left'[m
    // A line-height equal to the font size clips bold text in Word print preview.[m
    // Give each line a small safety allowance while keeping the exact 4x6 table height.[m
[31m-   const size = opts.size || 15[m
[31m-   const line = opts.line || Math.max(205, Math.ceil(size * 13))[m
[32m+[m[32m   const size = opts.size || 13[m
[32m+[m[32m   const line = opts.line || Math.max(150, Math.ceil(size * 12))[m
    return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="0" w:after="0" w:line="${line}" w:lineRule="exact"/></w:pPr>${wordRun(text, opts)}</w:p>`[m
  }[m
 [m
[36m@@ -8367,7 +8367,7 @@[m [mfunction buildDeliveryInvoicePrintCSS() {[m
    const span = opts.span ? `<w:gridSpan w:val="${opts.span}"/>` : ''[m
    const shade = opts.shade ? `<w:shd w:fill="${opts.shade}"/>` : ''[m
    const vAlign = '<w:vAlign w:val="center"/>'[m
[31m-   const cellMargins = '<w:tcMar><w:top w:w="4" w:type="dxa"/><w:left w:w="24" w:type="dxa"/><w:bottom w:w="4" w:type="dxa"/><w:right w:w="24" w:type="dxa"/></w:tcMar>'[m
[32m+[m[32m   const cellMargins = '<w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="14" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="14" w:type="dxa"/></w:tcMar>'[m
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span}${shade}${vAlign}${cellMargins}</w:tcPr>${wordParagraph(text, opts)}</w:tc>`[m
  }[m
 [m
[36m@@ -8381,7 +8381,7 @@[m [mfunction buildDeliveryInvoicePrintCSS() {[m
    // after each invoice. A trailing page-break paragraph can be forced onto its own sheet,[m
    // which creates the blank pages seen between invoices in Word print preview.[m
    const pageBreak = startNewPage ? '<w:pageBreakBefore/>' : ''[m
[31m-   return `<w:p><w:pPr>${pageBreak}<w:spacing w:before="0" w:after="0" w:line="340" w:lineRule="exact"/></w:pPr></w:p>`[m
[32m+[m[32m   return `<w:p><w:pPr>${pageBreak}<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>`[m
  }[m
 [m
  function buildDeliveryInvoiceDocxTable(invoice) {[m
[36m@@ -8404,64 +8404,64 @@[m [mfunction buildDeliveryInvoicePrintCSS() {[m
    const PALE_RED = 'FBDCDC'[m
 [m
    const rows = [][m
[31m-   rows.push(wordRow([wordCell(data.title, { width:full, span:5, align:'center', bold:true, size:19, line:235, shade:BRAND_RED, color:'FFFFFF' })], 420))[m
[32m+[m[32m   rows.push(wordRow([wordCell(data.title, { width:full, span:5, align:'center', bold:true, size:15, line:170, shade:BRAND_RED, color:'FFFFFF' })], 265))[m
    rows.push(wordRow([[m
[31m-     wordCell('Date:', { width:widths[0], align:'center', bold:true, size:16 }),[m
[31m-     wordCell(data.date, { width:valueSpan3, span:3, align:'left', size:16, shade:PALE_GOLD }),[m
[32m+[m[32m     wordCell('Date:', { width:widths[0], align:'center', bold:true, size:13 }),[m
[32m+[m[32m     wordCell(data.date, { width:valueSpan3, span:3, align:'left', size:13, shade:PALE_GOLD }),[m
      wordCell('', { width:widths[4], align:'center', size:15 })[m
[31m-   ], 350))[m
[32m+[m[32m   ], 225))[m
    rows.push(wordRow([[m
[31m-     wordCell('Customer:', { width:widths[0], align:'center', bold:true, size:16 }),[m
[31m-     wordCell(data.customerName, { width:valueSpan3, span:3, align:'left', size:16, shade:PALE_GOLD }),[m
[32m+[m[32m     wordCell('Customer:', { width:widths[0], align:'center', bold:true, size:13 }),[m
[32m+[m[32m     wordCell(data.customerName, { width:valueSpan3, span:3, align:'left', size:13, shade:PALE_GOLD }),[m
      wordCell('', { width:widths[4], align:'center', size:15 })[m
[31m-   ], 350))[m
[32m+[m[32m   ], 225))[m
    rows.push(wordRow([[m
[31m-     wordCell('Address:', { width:widths[0], align:'center', bold:true, size:16 }),[m
[31m-     wordCell(data.customerAddress, { width:valueSpan3, span:3, align:'left', size:15, shade:PALE_RED }),[m
[32m+[m[32m     wordCell('Address:', { width:widths[0], align:'center', bold:true, size:13 }),[m
[32m+[m[32m     wordCell(data.customerAddress, { width:valueSpan3, span:3, align:'left', size:12, shade:PALE_RED }),[m
      wordCell('', { width:widths[4], align:'center', size:15 })[m
[31m-   ], 350))[m
[32m+[m[32m   ], 225))[m
    rows.push(wordRow([[m
[31m-     wordCell(`NOTES:${data.productionDispatchNote ? ' ' + data.productionDispatchNote : ''}`, { width:full, span:5, align:'left', bold:true, size:14, line:175, shade:PALE_GOLD })[m
[31m-   ], 360))[m
[32m+[m[32m     wordCell(`NOTES:${data.productionDispatchNote ? ' ' + data.productionDispatchNote : ''}`, { width:full, span:5, align:'left', bold:true, size:12, line:150, shade:PALE_GOLD })[m
[32m+[m[32m   ], 210))[m
    rows.push(wordRow([[m
[31m-     wordCell('Product', { width:widths[0], align:'center', bold:true, size:16 }),[m
[31m-     wordCell('Delivered', { width:widths[1], align:'center', bold:true, size:16 }),[m
[31m-     wordCell('Price', { width:widths[2], align:'center', bold:true, size:16 }),[m
[31m-     wordCell('Amount', { width:widths[3], align:'center', bold:true, size:16 }),[m
[31m-     wordCell('Unsold', { width:widths[4], align:'center', bold:true, size:16 })[m
[31m-   ], 350))[m
[32m+[m[32m     wordCell('Product', { width:widths[0], align:'center', bold:true, size:13 }),[m
[32m+[m[32m     wordCell('Delivered', { width:widths[1], align:'center', bold:true, size:13 }),[m
[32m+[m[32m     wordCell('Price', { width:widths[2], align:'center', bold:true, size:13 }),[m
[32m+[m[32m     wordCell('Amount', { width:widths[3], align:'center', bold:true, size:13 }),[m
[32m+[m[32m     wordCell('Unsold', { width:widths[4], align:'center', bold:true, size:13 })[m
[32m+[m[32m   ], 225))[m
 [m
    data.productRows.forEach(row => {[m
      rows.push(wordRow([[m
[31m-       wordCell(row.product, { width:widths[0], align:'center', bold:!!row.product, size:14 }),[m
[31m-       wordCell(row.delivered, { width:widths[1], align:'center', size:15 }),[m
[31m-       wordCell(row.price, { width:widths[2], align:'right', size:14 }),[m
[31m-       wordCell(row.amount, { width:widths[3], align:'right', size:14 }),[m
[31m-       wordCell(row.unsold, { width:widths[4], align:'center', size:15 })[m
[31m-     ], 310))[m
[32m+[m[32m       wordCell(row.product, { width:widths[0], align:'center', bold:!!row.product, size:11 }),[m
[32m+[m[32m       wordCell(row.delivered, { width:widths[1], align:'center', size:12 }),[m
[32m+[m[32m       wordCell(row.price, { width:widths[2], align:'right', size:11 }),[m
[32m+[m[32m       wordCell(row.amount, { width:widths[3], align:'right', size:11 }),[m
[32m+[m[32m       wordCell(row.unsold, { width:widths[4], align:'center', size:12 })[m
[32m+[m[32m     ], 210))[m
    })[m
 [m
[31m-   rows.push(wordRow(widths.map(w => wordCell('', { width:w, align:'center', size:14 })), 80))[m
[32m+[m[32m   rows.push(wordRow(widths.map(w => wordCell('', { width:w, align:'center', size:8 })), 10))[m
    rows.push(wordRow([[m
[31m-     wordCell(`${data.containerLabel} Used`, { width:widths[0], align:'center', bold:true, italic:true, size:14 }),[m
[31m-     wordCell(data.cratesUsed, { width:widths[1], align:'center', size:15 }),[m
[31m-     wordCell('', { width:widths[2], align:'center', size:15 }),[m
[31m-     wordCell('', { width:widths[3], align:'center', size:15 }),[m
[31m-     wordCell('', { width:widths[4], align:'center', size:15 })[m
[31m-   ], 350))[m
[32m+[m[32m     wordCell(`${data.containerLabel} Used`, { width:widths[0], align:'center', bold:true, italic:true, size:11 }),[m
[32m+[m[32m     wordCell(data.cratesUsed, { width:widths[1], align:'center', size:12 }),[m
[32m+[m[32m     wordCell('', { width:widths[2], align:'center', size:12 }),[m
[32m+[m[32m     wordCell('', { width:widths[3], align:'center', size:12 }),[m
[32m+[m[32m     wordCell('', { width:widths[4], align:'center', size:12 })[m
[32m+[m[32m   ], 225))[m
    rows.push(wordRow([[m
[31m-     wordCell(`${data.containerLabel} Cover`, { width:widths[0], align:'center', bold:true, italic:true, size:14 }),[m
[31m-     wordCell('', { width:widths[1], align:'center', size:15 }),[m
[31m-     wordCell('TOTAL', { width:widths[2], align:'center', bold:true, size:17, shade:BRAND_GOLD }),[m
[31m-     wordCell(data.total, { width:widths[3], align:'right', bold:true, size:17, shade:BRAND_GOLD }),[m
[31m-     wordCell('', { width:widths[4], align:'center', size:15 })[m
[31m-   ], 390))[m
[32m+[m[32m     wordCell(`${data.containerLabel} Cover`, { width:widths[0], align:'center', bold:true, italic:true, size:11 }),[m
[32m+[m[32m     wordCell('', { width:widths[1], align:'center', size:12 }),[m
[32m+[m[32m     wordCell('TOTAL', { width:widths[2], align:'center', bold:true, size:14, shade:BRAND_GOLD }),[m
[32m+[m[32m     wordCell(data.total, { width:widths[3], align:'right', bold:true, size:14, shade:BRAND_GOLD }),[m
[32m+[m[32m     wordCell('', { width:widths[4], align:'center', size:12 })[m
[32m+[m[32m   ], 250))[m
    rows.push(wordRow([[m
[31m-     wordCell('Prepared by:', { width:widths[0], align:'center', bold:true, italic:true, size:14, shade:PALE_GOLD }),[m
[31m-     wordCell(data.preparedBy, { width:widths[1] + widths[2], span:2, align:'left', size:14, shade:PALE_GOLD }),[m
[31m-     wordCell('', { width:widths[3], align:'center', size:15 }),[m
[31m-     wordCell('', { width:widths[4], align:'center', size:15 })[m
[31m-   ], 400))[m
[32m+[m[32m     wordCell('Prepared by:', { width:widths[0], align:'center', bold:true, italic:true, size:11, shade:PALE_GOLD }),[m
[32m+[m[32m     wordCell(data.preparedBy, { width:widths[1] + widths[2], span:2, align:'left', size:11, shade:PALE_GOLD }),[m
[32m+[m[32m     wordCell('', { width:widths[3], align:'center', size:12 }),[m
[32m+[m[32m     wordCell('', { width:widths[4], align:'center', size:12 })[m
[32m+[m[32m   ], 225))[m
 [m
    return `<w:tbl><w:tblPr><w:tblW w:w="${full}" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/><w:tblLook w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/><w:tblBorders><w:top w:val="single" w:sz="14" w:space="0" w:color="${BRAND_RED}"/><w:left w:val="single" w:sz="14" w:space="0" w:color="${BRAND_RED}"/><w:bottom w:val="single" w:sz="14" w:space="0" w:color="${BRAND_RED}"/><w:right w:val="single" w:sz="14" w:space="0" w:color="${BRAND_RED}"/><w:insideH w:val="single" w:sz="10" w:space="0" w:color="${BRAND_RED}"/><w:insideV w:val="single" w:sz="10" w:space="0" w:color="${BRAND_RED}"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`[m
  }[m
[36m@@ -8480,7 +8480,7 @@[m [mfunction buildDeliveryInvoicePrintCSS() {[m
    // produce: even the maximum possible order (all 17 donut variants at[m
    // once) needs roughly 146mm, comfortably inside 165mm with margin to[m
    // spare — so this size never needs to change per invoice.[m
[31m-   const MARGIN = 147[m
[32m+[m[32m   const MARGIN = 72[m
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>[m
 <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${bodyParts.join('')}<w:sectPr><w:pgSz w:w="5953" w:h="9354"/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`[m
  }[m
