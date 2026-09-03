import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SiteHeader from "./SiteHeader"

jest.mock("antd", () => ({
	Button: ({ children, onClick, ...props }) => (
		<button
			onClick={onClick}
			{...props}
		>
			{children}
		</button>
	),
}))

jest.mock("@ant-design/icons", () => ({
	MenuOutlined: () => <span />,
}))

test("renders the chatbot title", () => {
	render(
		<SiteHeader
			user={null}
			collapsed={false}
			setCollapsed={jest.fn()}
		/>
	)

	expect(screen.getByRole("heading", { name: /B\.E\.R\.N\.D\.\s*\|\s*Chatbot/i })).toBeInTheDocument()
})

test("renders user name and department", () => {
	const user = {
		name: "Asad",
		department: "Anwendungsentwicklung",
	}

	render(
		<SiteHeader
			user={user}
			collapsed={false}
			setCollapsed={jest.fn()}
		/>
	)

	expect(screen.getByText("Hallo Asad!")).toBeInTheDocument()

	expect(screen.getByText("Anwendungsentwicklung")).toBeInTheDocument()
})

test("renders fallback values when user is not provided", () => {
	render(
		<SiteHeader
			user={null}
			collapsed={false}
			setCollapsed={jest.fn()}
		/>
	)

	expect(screen.getByText("Hallo Unbekannt!")).toBeInTheDocument()

	expect(screen.getByText("KST Super Smarter Chatbot")).toBeInTheDocument()
})

test("toggles collapsed state when menu button is clicked", async () => {
	const user = userEvent.setup()
	const setCollapsed = jest.fn()

	render(
		<SiteHeader
			user={null}
			collapsed={false}
			setCollapsed={setCollapsed}
		/>
	)

	const toggleButton = screen.getByRole("button")

	await user.click(toggleButton)

	expect(setCollapsed).toHaveBeenCalledWith(true)
})

test("toggles collapsed from true to false", async () => {
	const user = userEvent.setup()
	const setCollapsed = jest.fn()

	render(
		<SiteHeader
			user={null}
			collapsed={true}
			setCollapsed={setCollapsed}
		/>
	)

	await user.click(screen.getByRole("button"))

	expect(setCollapsed).toHaveBeenCalledWith(false)
})
