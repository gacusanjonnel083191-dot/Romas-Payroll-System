const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8')

function readPngDimensions(filePath) {
 const bytes = fs.readFileSync(filePath)
 assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a')
 return { width:bytes.readUInt32BE(16), height:bytes.readUInt32BE(20) }
}

test('Employee ID Builder is available inside Documents Center', () => {
 assert.match(appSource, />EMPLOYEE ID BUILDER<\/button>/)
 assert.match(appSource, /documentCenterView==='employee-id'/)
 assert.match(appSource, /accept="image\/png,image\/jpeg,image\/webp"/)
 assert.match(appSource, /DOWNLOAD FRONT & BACK PNG/)
})

test('front and back downloads use the approved high-resolution ID dimensions', () => {
 assert.match(appSource, /const width = 2399/)
 assert.match(appSource, /const height = 3506/)
 assert.match(appSource, /downloadEmployeeIdPng\('front'/)
 assert.match(appSource, /downloadEmployeeIdPng\('back'/)
 assert.match(appSource, /canvas\.toBlob\(resolve, 'image\/png'\)/)
})

test('ID reference assets have the expected dimensions and contain no employee photo in the front source asset', () => {
 assert.deepEqual(readPngDimensions(path.join(repoRoot, 'public', 'employee-id-front-header.png')), { width:2399, height:1250 })
 assert.deepEqual(readPngDimensions(path.join(repoRoot, 'public', 'employee-id-back.png')), { width:2399, height:3506 })
})
