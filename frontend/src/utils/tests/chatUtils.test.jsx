import { toIdString, makeLocalId, isLocalId, toOutboundId, parseTimestamp, toUiMessage } from "../chatUtils"

describe("toIdString", () => {
	test("returns null for nullish or invalid values", () => {
		expect(toIdString(null)).toBeNull()
		expect(toIdString(undefined)).toBeNull()
		expect(toIdString("")).toBeNull()
		expect(toIdString("   ")).toBeNull()
		expect(toIdString(NaN)).toBeNull()
	})

	test("returns string for valid values", () => {
		expect(toIdString(123)).toBe("123")
		expect(toIdString("abc")).toBe("abc")
	})
})

describe("local id helpers", () => {
	test("makeLocalId creates a local id and isLocalId detects it", () => {
		const id = makeLocalId()

		expect(typeof id).toBe("string")
		expect(isLocalId(id)).toBe(true)
	})

	test("isLocalId returns false for non-local ids", () => {
		expect(isLocalId("123")).toBe(false)
		expect(isLocalId(null)).toBe(false)
	})
})

describe("toOutboundId", () => {
	test("returns null for local ids", () => {
		const localId = makeLocalId()
		expect(toOutboundId(localId)).toBeNull()
	})

	test("passes through non-local ids", () => {
		expect(toOutboundId("server-123")).toBe("server-123")
	})
})

describe("parseTimestamp", () => {
	test("returns null for invalid timestamps", () => {
		expect(parseTimestamp(null)).toBeNull()
		expect(parseTimestamp("not-a-date")).toBeNull()
	})

	test("returns Date for valid timestamps", () => {
		const result = parseTimestamp(1700000000000)

		expect(result).toBeInstanceOf(Date)
		expect(Number.isNaN(result.getTime())).toBe(false)
	})
})

describe("toUiMessage", () => {
	test("creates a user message correctly", () => {
		const msg = toUiMessage("user", "Hello", 1700000000000)

		expect(msg.sender).toBe("Ich")
		expect(msg.text).toBe("Hello")
		expect(msg.isOwnMessage).toBe(true)
		expect(msg.rawTimestamp).toBe(1700000000000)
		expect(typeof msg.timestamp).toBe("string")
	})

	test("creates a bot message correctly", () => {
		const msg = toUiMessage("assistant", null, null)

		expect(msg.sender).toBe("Bernd")
		expect(msg.text).toBe("")
		expect(msg.isOwnMessage).toBe(false)
		expect(msg.rawTimestamp).toBeNull()
	})
})
