import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { checkAdminKey } from "../lib/admin"

const original = process.env.ADMIN_KEY

afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_KEY
  else process.env.ADMIN_KEY = original
})

describe("admin key", () => {
  it("accepts only the configured key", () => {
    process.env.ADMIN_KEY = "owner-secret"
    assert.equal(checkAdminKey("owner-secret"), true)
    assert.equal(checkAdminKey("owner-secretx"), false)
    assert.equal(checkAdminKey("owner-secre"), false)
    assert.equal(checkAdminKey(""), false)
    assert.equal(checkAdminKey(null), false)
    delete process.env.ADMIN_KEY
    assert.equal(checkAdminKey("owner-secret"), false)
  })
})
