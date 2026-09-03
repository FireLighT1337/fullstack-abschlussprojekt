import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MessageInput from "./MessageInput"

jest.mock("antd", () => {
	const React = require("react")

	const Form = ({ children }) => <form>{children}</form>

	Form.Item = ({ children, label }) => (
		<div>
			{label && <label>{label}</label>}
			{children}
		</div>
	)

	Form.useForm = () => [{}, jest.fn()]

	return {
		Form,

		Input: ({ value, onChange, onKeyDown, ...props }) => (
			<input
				value={value}
				onChange={onChange}
				onKeyDown={onKeyDown}
				{...props}
			/>
		),

		Button: ({ children, disabled, onClick, ...props }) => (
			<button
				disabled={disabled}
				onClick={onClick}
				{...props}
			>
				{children}
			</button>
		),

		Upload: ({ children }) => <>{children}</>,

		Tooltip: ({ children }) => <>{children}</>,

		ConfigProvider: ({ children }) => <>{children}</>,

		message: {
			error: jest.fn(),
		},

		theme: {
			defaultAlgorithm: {},
		},
	}
})

jest.mock("@ant-design/icons", () => ({
	SendOutlined: () => <span />,
	UploadOutlined: () => <span />,
}))

test("renders message input and send button", () => {
	render(<MessageInput handleSend={jest.fn()} />)

	expect(screen.getByLabelText("Schreibe eine Nachricht")).toBeInTheDocument()

	expect(screen.getByRole("button", { name: /nachricht senden/i })).toBeInTheDocument()
})

test("disables send button when input is empty", () => {
	render(<MessageInput handleSend={jest.fn()} />)

	const sendButton = screen.getByRole("button", {
		name: /nachricht senden/i,
	})

	expect(sendButton).toBeDisabled()
})

test("clicking upload button triggers file input", async () => {
	const user = userEvent.setup()

	render(<MessageInput handleSend={jest.fn()} />)

	const uploadButton = screen.getByRole("button", {
		name: /dateien hochladen/i,
	})

	const fileInput = document.querySelector('input[type="file"]')
	const clickSpy = jest.spyOn(fileInput, "click")

	await user.click(uploadButton)

	expect(clickSpy).toHaveBeenCalled()
})

test("calls handleUpload with valid files", async () => {
	const user = userEvent.setup()
	const handleUpload = jest.fn()

	render(
		<MessageInput
			handleSend={jest.fn()}
			handleUpload={handleUpload}
		/>
	)

	const file = new File(["test"], "test.pdf", {
		type: "application/pdf",
	})

	const input = document.querySelector('input[type="file"]')

	await user.upload(input, file)

	expect(handleUpload).toHaveBeenCalledWith([file])
})
