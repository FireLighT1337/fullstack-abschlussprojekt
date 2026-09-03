import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import Sidebar from "./Sidebar"

jest.mock("antd", () => {
	const React = require("react")

	return {
		Menu: ({ items, onClick, selectedKeys }) => (
			<ul>
				{items.map((item) => (
					<li key={item.key}>
						<button
							disabled={item.disabled}
							data-selected={selectedKeys?.includes(item.key)}
							onClick={(e) =>
								onClick({
									key: item.key,
									domEvent: e,
								})
							}
						>
							{item.label}
						</button>
					</li>
				))}
			</ul>
		),

		Button: ({ children, onClick, disabled }) => (
			<button
				onClick={onClick}
				disabled={disabled}
			>
				{children}
			</button>
		),

		Popconfirm: ({ children, onConfirm, disabled }) => (
			<span>
				<button
					disabled={disabled}
					onClick={() => {
						if (!disabled) onConfirm()
					}}
				>
					{children}
				</button>
			</span>
		),

		Tooltip: ({ children }) => <>{children}</>,
		Spin: () => <span>loading</span>,
		Tag: ({ children }) => <span>{children}</span>,
	}
})

jest.mock("@ant-design/icons", () => ({
	PlusOutlined: () => <span />,
	DeleteOutlined: () => <span />,
}))

const conversations = [
	{ id: 1, title: "Chat 1", state: "active" },
	{ id: 2, title: "Chat 2", state: "deleting" },
]

test("renders all conversations", () => {
	render(
		<Sidebar
			conversations={conversations}
			switchConversation={jest.fn()}
			addConversation={jest.fn()}
			deleteConversation={jest.fn()}
			activeConversationId={1}
		/>
	)

	expect(screen.getByText("Chat 1")).toBeInTheDocument()
	expect(screen.getByText("Chat 2")).toBeInTheDocument()
})

test("shows deleting indicator for deleting conversations", () => {
	render(
		<Sidebar
			conversations={conversations}
			switchConversation={jest.fn()}
			addConversation={jest.fn()}
			deleteConversation={jest.fn()}
			activeConversationId={null}
		/>
	)

	expect(screen.getByText(/Lösche/i)).toBeInTheDocument()
})

test("disables conversations in deleting state", () => {
	render(
		<Sidebar
			conversations={conversations}
			switchConversation={jest.fn()}
			addConversation={jest.fn()}
			deleteConversation={jest.fn()}
			activeConversationId={null}
		/>
	)

	const deletingButton = screen.getByText("Chat 2").closest("button")
	expect(deletingButton).toBeDisabled()
})

test("calls switchConversation when clicking a conversation", async () => {
	const user = userEvent.setup()
	const switchConversation = jest.fn()

	render(
		<Sidebar
			conversations={conversations}
			switchConversation={switchConversation}
			addConversation={jest.fn()}
			deleteConversation={jest.fn()}
			activeConversationId={null}
		/>
	)

	await user.click(screen.getByText("Chat 1"))

	expect(switchConversation).toHaveBeenCalledWith("1")
})

test("calls addConversation when clicking 'Neue Konversation'", async () => {
	const user = userEvent.setup()
	const addConversation = jest.fn()

	render(
		<Sidebar
			conversations={conversations}
			switchConversation={jest.fn()}
			addConversation={addConversation}
			deleteConversation={jest.fn()}
			activeConversationId={null}
		/>
	)

	await user.click(screen.getByText("Neue Konversation"))

	expect(addConversation).toHaveBeenCalledWith("Konversation 3")
})

test("calls deleteConversation when delete is confirmed", async () => {
	const user = userEvent.setup()
	const deleteConversation = jest.fn()

	render(
		<Sidebar
			conversations={conversations}
			switchConversation={jest.fn()}
			addConversation={jest.fn()}
			deleteConversation={deleteConversation}
			activeConversationId={null}
		/>
	)

	const deleteButtons = screen.getAllByRole("button")
	const deleteButton = deleteButtons.find((btn) => btn.textContent !== "Chat 1" && btn.textContent !== "Chat 2")

	await user.click(deleteButton)

	expect(deleteConversation).toHaveBeenCalledWith(1)
})
