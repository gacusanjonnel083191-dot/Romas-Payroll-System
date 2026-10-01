import { unzipSync, zipSync } from 'fflate'

function pngDataUrlBytes(dataUrl) {
 const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '')
 if (!match) throw new Error('The Employee ID image is not a PNG.')
 return Uint8Array.from(atob(match[1]), character => character.charCodeAt(0))
}

// Preserve the approved Word template's A4 section, paragraph anchors and image
// extents exactly. Its placeholders contain no employee information.
export function buildEmployeeIdWordBlob({ templateBytes, frontImage, backImage }) {
 const files = unzipSync(templateBytes)
 if (!files['word/document.xml'] || !files['word/media/image1.png'] || !files['word/media/image2.png']) {
  throw new Error('The Employee ID A4 template is incomplete.')
 }
 files['word/media/image1.png'] = pngDataUrlBytes(backImage)
 files['word/media/image2.png'] = pngDataUrlBytes(frontImage)
 return new Blob([zipSync(files, { level:6 })], {
  type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 })
}
