import { Menu, Button, Tooltip, Popconfirm, Spin, Tag } from "antd"
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons"
import "./Sidebar.css"

const Sidebar = ({ conversations, switchConversation, addConversation, deleteConversation, activeConversationId }) => {
	const items = [
		// Conversation entries
		...conversations.map((conv) => {
			const isDeleting = conv.state === "deleting"

			return {
				key: String(conv.id ?? ""),
				disabled: isDeleting,
				label: (
					<div className="sidebar-item-row">
						<div className="sidebar-item-title-wrap">
							<span className={`sidebar-item-title ${isDeleting ? "is-deleting" : ""}`}>{conv.title}</span>
							{isDeleting && (
								<span className="sidebar-item-deleting">
									<Spin
										size="small"
										className="sidebar-spin"
									/>
									<Tag
										color="red"
										className="sidebar-deleting-tag"
									>
										Lösche …
									</Tag>
								</span>
							)}
						</div>

						<span
							className="sidebar-item-actions"
							onClick={(e) => e.stopPropagation()}
						>
							<Popconfirm
								title="Konversation löschen?"
								description={`Möchtest du „${conv.title}“ wirklich löschen?`}
								okText="Löschen"
								cancelText="Abbrechen"
								okButtonProps={{ danger: true, loading: isDeleting }}
								onConfirm={() => deleteConversation(conv.id)}
								disabled={isDeleting}
							>
								<Tooltip title={isDeleting ? "Wird gelöscht..." : "Löschen"}>
									<Button
										type="text"
										size="small"
										icon={<DeleteOutlined />}
										onClick={(e) => {
											e.preventDefault()
											e.stopPropagation()
										}}
									/>
								</Tooltip>
							</Popconfirm>
						</span>
					</div>
				),
			}
		}),

		{
			key: "__add__",
			className: "add-item",
			icon: <PlusOutlined />,
			label: "Neue Konversation",
		},
	]

	const selectedKeys = activeConversationId != null ? [String(activeConversationId)] : []

	const handleMenuClick = ({ key, domEvent }) => {
		domEvent?.preventDefault()

		if (key === "__add__") {
			addConversation(`Konversation ${conversations.length + 1}`)
			return
		}
		switchConversation(key)
	}

	return (
		<div className="sidebar">
			<h3>Konversationen</h3>
			<Menu
				mode="inline"
				selectedKeys={selectedKeys}
				items={items}
				onClick={handleMenuClick}
			/>
		</div>
	)
}

export default Sidebar
