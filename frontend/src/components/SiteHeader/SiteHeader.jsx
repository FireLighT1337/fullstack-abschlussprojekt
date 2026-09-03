import defaultAvatar from "../../assets/bernd_head.png"
import { Button } from "antd"
import { MenuOutlined } from "@ant-design/icons"
import "./SiteHeader.css"

const SiteHeader = ({ user, collapsed, setCollapsed }) => {
	return (
		<header className="site-header">
			<div className="header-left">
				<Button
					type="text"
					icon={<MenuOutlined />}
					onClick={() => setCollapsed(!collapsed)}
					className="header-toggle-button"
				/>

				<img
					src={user?.avatarUrl || defaultAvatar}
					alt="User Avatar"
					className="user-avatar"
				/>
				<div className="user-info">
					<p>Hallo {user?.name || "Unbekannt"}!</p>
					<p>{user?.department || "KST Super Smarter Chatbot"}</p>
				</div>
			</div>
			<h1 className="orbitron-font title">B.E.R.N.D. | Chatbot</h1>
		</header>
	)
}
export default SiteHeader
