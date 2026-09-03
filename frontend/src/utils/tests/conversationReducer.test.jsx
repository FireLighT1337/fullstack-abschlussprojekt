import { conversationReducer, initialConversationState } from "../conversationReducer"

describe("conversationReducer", () => {
	test("INIT_LIST creates a new local conversation when none active", () => {
		const state = conversationReducer(initialConversationState, {
			type: "INIT_LIST",
			list: [],
		})

		expect(state.list).toHaveLength(1)
		expect(state.activeId).toMatch(/^local:/)
		expect(state.list[0].title).toMatch(/Konversation/)
	})

	test("SWITCH creates a new local conversation when id does not exist", () => {
		const nextId = "local:test"

		const state = conversationReducer(initialConversationState, {
			type: "SWITCH",
			id: nextId,
		})

		expect(state.activeId).toBe(nextId)
		expect(state.list.some((c) => c.id === nextId)).toBe(true)
	})

	test("LOAD_SUCCESS converts local conversation to real id", () => {
		const localId = "local:123"

		const state = {
			list: [
				{
					id: localId,
					state: "local",
					messages: [],
					title: "Konversation 1",
					conversationNum: 1,
				},
			],
			activeId: localId,
		}

		const next = conversationReducer(state, {
			type: "LOAD_SUCCESS",
			id: localId,
			messages: ["hello"],
		})

		expect(next.activeId).toBe(localId)
		expect(next.list[0].id).toBe(localId)
		expect(next.list[0].messages).toEqual(["hello"])
		expect(next.list[0].state).toBe("ready")
	})

	test("APPEND_USER creates local conversation if target missing", () => {
		const next = conversationReducer(initialConversationState, {
			type: "APPEND_USER",
			id: null,
			message: "hi",
		})

		expect(next.list).toHaveLength(1)
		expect(next.list[0].messages).toEqual(["hi"])
		expect(next.activeId).toMatch(/^local:/)
	})

	test("DELETE_SUCCESS removes conversation and updates activeId", () => {
		const state = {
			activeId: "1",
			list: [
				{ id: "1", title: "A", messages: [] },
				{ id: "2", title: "B", messages: [] },
			],
		}

		const next = conversationReducer(state, {
			type: "DELETE_SUCCESS",
			id: "1",
		})

		expect(next.list).toHaveLength(1)
		expect(next.list[0].id).toBe("2")
		expect(next.activeId).toBe("2")
	})
})
