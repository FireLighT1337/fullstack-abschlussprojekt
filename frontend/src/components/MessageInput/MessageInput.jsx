import React, { useCallback, useState, useRef } from "react"
import { Form, Input, Button, Tooltip, message as antdMessage, ConfigProvider, theme } from "antd"
import { SendOutlined, UploadOutlined } from "@ant-design/icons"
import "./MessageInput.css"

const ALLOWED_FILE_TYPES = {
	pdf: {
		mime: ["application/pdf"],
		extensions: [".pdf"],
		label: "PDF",
	},
	excel: {
		mime: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
		extensions: [".xls", ".xlsx"],
		label: "Excel",
	},
	powerpoint: {
		mime: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
		extensions: [".ppt", ".pptx"],
		label: "PowerPoint",
	},
	jpg: {
		mime: ["image/jpeg"],
		extensions: [".jpg", ".jpeg"],
		label: "JPG",
	},
}

const MessageInput = ({ handleSend, handleUpload, loading = false, disabled = false, placeholder = "Schreibe eine Nachricht..." }) => {
	const [form] = Form.useForm()
	const [value, setValue] = useState("")
	const fileInputRef = useRef(null)

	const onChange = useCallback((e) => {
		setValue(e.target.value)
	}, [])

	const onClickUpload = () => {
		fileInputRef.current?.click()
	}

	const onFileSelected = (e) => {
		const files = Array.from(e.target.files || [])
		if (!files.length) return

		const validFiles = files.filter((file) => {
			const fileName = file.name.toLowerCase()
			const fileType = file.type

			const isValid = Object.values(ALLOWED_FILE_TYPES).some((t) => t.mime.includes(fileType) || t.extensions.some((ext) => fileName.endsWith(ext)))

			if (!isValid) {
				antdMessage.error(`Dateityp nicht unterstützt: ${file.name}`)
			}

			return isValid
		})

		if (handleUpload && validFiles.length) {
			handleUpload(validFiles)
		}

		e.target.value = ""
	}

	return (
		<footer className="input-container">
			<ConfigProvider
				theme={{
					algorithm: theme.defaultAlgorithm,
					token: {
						colorBgContainer: "#ffffff",
						colorBorder: "transparent",
						borderRadius: 8,
					},
					components: {
						Input: {
							colorBgContainer: "#ffffff",
							colorFillSecondary: "#ffffff",
							colorBgTextHover: "#ffffff",
							colorBgTextActive: "#ffffff",
							colorBgInputDisabled: "#ffffff",
							activeBorderColor: "transparent",
							hoverBorderColor: "transparent",
							borderRadius: 8,
							boxShadow: "none",
						},
						Button: {
							colorPrimary: "#ffffff",
							colorPrimaryHover: "#f0f0f0",
							colorPrimaryActive: "#0a3a5c",
							borderRadius: 8,
						},
						Space: {},
					},
				}}
			>
				<input
					type="file"
					accept={Object.values(ALLOWED_FILE_TYPES)
						.flatMap((t) => t.extensions)
						.join(",")}
					multiple
					style={{ display: "none" }}
					ref={fileInputRef}
					onChange={onFileSelected}
				/>

				<Form
					form={form}
					onFinish={({ message }) => {
						const msg = (message ?? "").trim()
						if (!msg) return

						handleSend(msg)
						form.resetFields()
						setValue("")
					}}
					className="message-form"
					role="form"
					aria-label="Nachrichtenformular"
				>
					<div className="message-input-row">
						<Form.Item
							name="message"
							className="message-form-item"
							rules={[{ required: true, message: "Schreibe eine Nachricht" }]}
						>
							<Input
								id="user-input"
								aria-label="Schreibe eine Nachricht"
								placeholder={placeholder}
								size="large"
								allowClear
								disabled={disabled}
								value={value}
								onChange={onChange}
								onPressEnter={(e) => {
									e.preventDefault()
									form.submit()
								}}
							/>
						</Form.Item>

						<Tooltip
							title="Dateien hochladen (PDF, Excel, PowerPoint, JPG)"
							placement="top"
						>
							<Button
								aria-label="Dateien hochladen"
								icon={<UploadOutlined style={{ color: "#000000" }} />}
								type="primary"
								className="upload-button"
								disabled={disabled}
								onClick={onClickUpload}
							/>
						</Tooltip>

						<Button
							id="send-button"
							aria-label="Nachricht senden"
							type="primary"
							size="large"
							htmlType="submit"
							icon={<SendOutlined />}
							loading={loading}
							disabled={disabled || !value.trim()}
						>
							Senden
						</Button>
					</div>
				</Form>
			</ConfigProvider>
		</footer>
	)
}
export default React.memo(MessageInput)
