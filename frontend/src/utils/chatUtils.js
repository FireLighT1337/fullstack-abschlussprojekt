export const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000"
export const WS_PATH = process.env.REACT_APP_WS_PATH || "/chat"

export const toIdString = (id) => {
	if (id === null || id === undefined) return null
	const s = String(id)
	if (s === "NaN" || s === "undefined" || s.trim() === "") return null
	return s
}

let counter = 0
export const makeLocalId = () => `local:${Date.now()}:${++counter}`

export const isLocalId = (id) => {
	const s = toIdString(id)
	return typeof s === "string" && s.startsWith("local:")
}

export const toOutboundId = (id) => {
	const s = toIdString(id)
	if (s === null) return null
	return isLocalId(s) ? null : s
}

export function parseTimestamp(ts) {
	if (ts == null) return null
	try {
		const d = typeof ts === "number" ? new Date(ts) : new Date(String(ts))
		return Number.isNaN(d.getTime()) ? null : d
	} catch {
		return null
	}
}

export function formatTimestamp(ts, opts) {
	const d = parseTimestamp(ts)
	if (!d) return "—"
	return new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
		...opts,
	}).format(d)
}

export const toUiMessage = (role, content, timestamp) => ({
	sender: role === "user" ? "Ich" : "Bernd",
	text: String(content ?? ""),
	rawTimestamp: timestamp ?? null,
	timestamp: formatTimestamp(timestamp),
	isOwnMessage: role === "user",
})

export const wsUrlFromTicket = (ticket) => {
	const proto = API_BASE.startsWith("https") ? "wss" : "ws"
	const url = API_BASE.replace(/^http(s?):\/\//, `${proto}://`).replace(/\/$/, "") + WS_PATH
	return `${url}?ticket=${encodeURIComponent(ticket)}`
}
