import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { describe, it } from "node:test"
import { getRound } from "../lib/designs"

function jpegSize(data: Buffer): { width: number; height: number } {
  let offset = 2
  while (offset < data.length - 8) {
    if (data[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = data[offset + 1]
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: data.readUInt16BE(offset + 5),
        width: data.readUInt16BE(offset + 7),
      }
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = data.readUInt16BE(offset + 2)
    offset += 2 + length
  }
  throw new Error("JPEG size not found")
}

describe("illustration files", () => {
  it("serves the original 1024px files for every take and nothing else", async () => {
    const dir = path.join(process.cwd(), "public", "illustrations")
    const files = (await readdir(dir)).filter((file) => file.endsWith(".jpg")).sort()
    const takes = getRound().designs.flatMap((design) => design.takes).sort()
    assert.deepEqual(
      files,
      takes.map((take) => `${take}.jpg`),
    )
    for (const file of files) {
      const data = await readFile(path.join(dir, file))
      assert.equal(data[0], 0xff)
      assert.equal(data[1], 0xd8)
      assert.ok(data.length > 100_000, `${file} looks truncated`)
      const size = jpegSize(data)
      assert.deepEqual(size, { width: 1024, height: 1024 })
    }
  })
})
