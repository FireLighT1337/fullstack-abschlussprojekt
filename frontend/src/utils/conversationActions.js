export const initListAction = (list) => ({
	type: "INIT_LIST",
	list,
})

export const switchConversationAction = (id) => ({
	type: "SWITCH",
	id,
})

export const loadSuccessAction = (id, messages) => ({
	type: "LOAD_SUCCESS",
	id,
	messages,
})

export const appendUserAction = (id, message) => ({
	type: "APPEND_USER",
	id,
	message,
})

export const appendAssistantAction = (id, message) => ({
	type: "APPEND_ASSISTANT",
	id,
	message,
})

export const deleteStartAction = (id) => ({
	type: "DELETE_START",
	id,
})

export const deleteSuccessAction = (id) => ({
	type: "DELETE_SUCCESS",
	id,
})
