// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom"

const originalError = console.error

beforeAll(() => {
	console.error = (...args) => {
		const message = args[0] ?? ""

		// Ignore Ant Design / DOM nesting warnings
		if (
			message.includes("validateDOMNesting") ||
			message.includes("cannot be a descendant of <button>") ||
			message.includes("cannot contain a nested <button>")
		) {
			return
		}

		originalError(...args)
	}
})

afterAll(() => {
	console.error = originalError
})

beforeAll(() => {
	Element.prototype.scrollIntoView = jest.fn()
})

beforeAll(() => {
	HTMLFormElement.prototype.submit = jest.fn()
})

jest.mock("react-markdown", () => ({
	__esModule: true,
	default: ({ children }) => <>{children}</>,
}))

jest.mock("remark-gfm", () => () => {})
jest.mock("rehype-highlight", () => () => {})

jest.mock("antd", () => {
	const React = require("react")

	const LayoutRoot = ({ children }) => <div>{children}</div>
	LayoutRoot.Sider = ({ children }) => <aside>{children}</aside>
	LayoutRoot.Header = ({ children }) => <header>{children}</header>
	LayoutRoot.Content = ({ children }) => <main>{children}</main>

	const FormRoot = ({ children, onFinish }) => (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				onFinish?.({})
			}}
		>
			{children}
		</form>
	)
	FormRoot.useForm = () => [{}, jest.fn()]
	FormRoot.Item = ({ children }) => <>{children}</>

	const Button = ({ children, ...props }) => (
		<button
			type="button"
			{...props}
		>
			{children}
		</button>
	)

	const Input = ({ onPressEnter, ...props }) => (
		<input
			{...props}
			onKeyDown={(e) => {
				if (e.key === "Enter" && onPressEnter) {
					onPressEnter(e)
				}
			}}
		/>
	)

	const Menu = ({ items = [], onClick, selectedKeys = [], children }) => (
		<ul>
			{items.map((item) => (
				<li key={item.key}>
					<button
						disabled={item.disabled}
						data-selected={selectedKeys.includes(item.key)}
						onClick={(e) => onClick?.({ key: item.key, domEvent: e })}
					>
						{item.label}
					</button>
				</li>
			))}
			{children}
		</ul>
	)
	Menu.Item = ({ children }) => <li>{children}</li>
	Menu.SubMenu = ({ children }) => <>{children}</>

	// ---- Fallback for everything else ----
	const createFallbackComponent = () =>
		new Proxy(({ children }) => <>{children}</>, {
			get: () => createFallbackComponent(),
		})

	const fallback = createFallbackComponent()

	return new Proxy(
		{
			Layout: LayoutRoot,
			Form: FormRoot,
			Button,
			Input,
			Menu,
			Tooltip: ({ children }) => <>{children}</>,
			Popconfirm: ({ children, onConfirm, disabled }) => <span onClick={() => !disabled && onConfirm?.()}>{children}</span>,
			Spin: () => <span>loading</span>,
			Tag: ({ children }) => <span>{children}</span>,

			ConfigProvider: ({ children }) => <>{children}</>,
			theme: { defaultAlgorithm: {} },
			message: { error: jest.fn(), success: jest.fn() },
		},
		{
			get: (target, prop) => {
				if (prop in target) return target[prop]
				return fallback[prop]
			},
		}
	)
})

jest.mock("@ant-design/icons", () => ({
	PlusOutlined: () => <span />,
	DeleteOutlined: () => <span />,
	SendOutlined: () => <span />,
	UploadOutlined: () => <span />,
	MenuOutlined: () => <span />,
}))
