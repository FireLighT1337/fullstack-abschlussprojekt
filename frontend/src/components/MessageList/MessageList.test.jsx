import { render, screen } from "@testing-library/react"
import MessageList from "./MessageList"

jest.mock("../Message/Message", () => {
	return ({ sender, text }) => (
		<div data-testid="message">
			{sender}: {text}
		</div>
	)
})

test("renders all messages", () => {
	const messages = [
		{ sender: "User", text: "Hello", timestamp: "10:00", isOwnMessage: true },
		{ sender: "Bot", text: "Hi there!", timestamp: "10:01", isOwnMessage: false },
	]

	render(
		<MessageList
			messages={messages}
			isBotThinking={false}
		/>
	)

	const items = screen.getAllByTestId("message")
	expect(items).toHaveLength(2)

	expect(screen.getByText("User: Hello")).toBeInTheDocument()
	expect(screen.getByText("Bot: Hi there!")).toBeInTheDocument()
})

test("renders no messages when list is empty", () => {
	render(
		<MessageList
			messages={[]}
			isBotThinking={false}
		/>
	)

	expect(screen.queryByTestId("message")).not.toBeInTheDocument()
})

test("shows bot thinking indicator when isBotThinking is true", () => {
	render(
		<MessageList
			messages={[]}
			isBotThinking={true}
		/>
	)

	expect(screen.getByText("Bernd")).toBeInTheDocument()
	expect(screen.getByText("...denkt nach")).toBeInTheDocument()
})

test("scrolls to bottom when messages change", () => {
	const messages = [{ sender: "User", text: "Hello", timestamp: "10:00", isOwnMessage: true }]

	const scrollSpy = jest.fn()

	// Mock scrollIntoView globally
	Element.prototype.scrollIntoView = scrollSpy

	const { rerender } = render(
		<MessageList
			messages={messages}
			isBotThinking={false}
		/>
	)

	// Add a new message
	rerender(
		<MessageList
			messages={[...messages, { sender: "Bot", text: "Hi", timestamp: "10:01", isOwnMessage: false }]}
			isBotThinking={false}
		/>
	)

	expect(scrollSpy).toHaveBeenCalled()
})
