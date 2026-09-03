import React, { useRef, useEffect, useCallback } from "react"
import Message from "../Message/Message"
import "./MessageList.css"

const MessageList = ({ messages, isBotThinking }) => {
	const dummyDiv = useRef(null)

	const scrollToBottom = useCallback(() => {
		dummyDiv.current?.scrollIntoView()
	}, [])

	useEffect(() => {
		scrollToBottom()
	}, [messages, scrollToBottom])

	return (
		<div className="message-container">
			{messages.map((message, index) => {
				return (
					<Message
						key={message.id || index}
						sender={message.sender}
						timestamp={message.timestamp}
						text={message.text}
						isOwnMessage={message.isOwnMessage}
					/>
				)
			})}

			{isBotThinking && (
				<p className="other-message">
					<span className="bernd">Bernd</span>
					<br />
					<span>...denkt nach</span>
				</p>
			)}

			<div ref={dummyDiv} />
		</div>
	)
}

export default React.memo(MessageList)
