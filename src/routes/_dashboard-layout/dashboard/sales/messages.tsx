import { ConversationListItem, type ConversationItemData } from '@/components/features/messages/ConversationListItem'
import { authStore } from '@/lib/stores/auth'
import { notificationActions } from '@/lib/stores/notifications'
import { useConversationsList } from '@/queries/messages'
import { useDashboardTitle } from '@/routes/_dashboard-layout'
import { createFileRoute, Outlet, useMatchRoute } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { useEffect } from 'react'
import { Loader2, MessageSquareText } from 'lucide-react'

export const Route = createFileRoute('/_dashboard-layout/dashboard/sales/messages')({
	component: MessagesRouterComponent,
})

function MessagesListComponent() {
	useDashboardTitle('Messages')
	const { data: conversations, isLoading, error } = useConversationsList()

	// Mark all messages as seen when the messages list is viewed
	useEffect(() => {
		notificationActions.markMessagesSeen()
	}, [])

	return (
		<div>
			<div className="hidden lg:block top-0 z-10 sticky bg-white px-4 lg:px-6 py-4 border-b">
				<h1 className="font-bold text-2xl">Messages</h1>
			</div>
			<div className="space-y-4 p-4 lg:p-8">
				{isLoading && (
					<div className="flex flex-col justify-center items-center py-12">
						<Loader2 className="w-8 h-8 text-primary animate-spin" />
						<p className="mt-2 ml-2">Loading conversations...</p>
					</div>
				)}
				{error && <p className="p-4 text-destructive text-center">Error loading conversations: {error.message}</p>}
				{!isLoading && !error && conversations?.length === 0 && (
					<div className="flex flex-col justify-center items-center bg-background p-8 border rounded-md min-h-[200px] text-muted-foreground text-center">
						<MessageSquareText size={48} className="mb-4" />
						<p>No conversations yet.</p>
						<p className="text-sm">Your conversations will appear here.</p>
					</div>
				)}

				{!isLoading && !error && conversations && conversations.length > 0 && (
					<ul className="flex flex-col gap-4">
						{conversations.map((convo: ConversationItemData) => (
							<li key={convo.pubkey}>
								<ConversationListItem conversation={convo} />
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	)
}

function MessagesRouterComponent() {
	const { user: currentUser } = useStore(authStore)
	const matchRoute = useMatchRoute()
	const isChatDetailActive = matchRoute({
		to: '/dashboard/sales/messages/$pubkey',
		fuzzy: true,
	})

	if (!currentUser) {
		return (
			<div className="p-6 text-center">
				<p>Please log in to view your messages.</p>
			</div>
		)
	}

	if (isChatDetailActive) {
		return <Outlet />
	}

	return <MessagesListComponent />
}
