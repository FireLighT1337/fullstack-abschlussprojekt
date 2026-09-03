import { render, screen } from "@testing-library/react"
import Message from "./Message"

jest.mock("react-toastify", () => ({
	toast: {
		success: jest.fn(),
		error: jest.fn(),
	},
}))

jest.mock("react-markdown", () => {
	return ({ children }) => <div>{children}</div>
})

jest.mock("remark-gfm", () => () => {})
jest.mock("rehype-highlight", () => () => {})
jest.mock("antd/es/locale/en_US.js", () => ({}))

test("renders sender, timestamp, and message text", () => {
	render(
		<Message
			sender="Asad"
			timestamp="10:42"
			text="Hello world"
			isOwnMessage={false}
		/>
	)

	expect(screen.getByText("Asad")).toBeInTheDocument()
	expect(screen.getByText("10:42")).toBeInTheDocument()
	expect(screen.getByText("Hello world")).toBeInTheDocument()
})

test("applies 'own-message' class when isOwnMessage is true", () => {
	const { container } = render(
		<Message
			sender="Asad"
			timestamp="10:42"
			text="Hello"
			isOwnMessage={true}
		/>
	)

	expect(container.firstChild).toHaveClass("own-message")
})

test("does not render copy button for plain text messages", () => {
	render(
		<Message
			sender="Asad"
			timestamp="10:42"
			text="Just a normal message"
			isOwnMessage={true}
		/>
	)

	expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument()
})
