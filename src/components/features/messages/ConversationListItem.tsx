import { useBreakpoint } from '@/hooks/useBreakpoint'
import { notificationStore } from '@/lib/stores/notifications'
import { Link } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { Card } from '@/components/ui/card'
import { MessageSquareText } from 'lucide-react'
import { UserCard } from '@/components/shared/user/UserCard'

export interface ConversationItemData {
	pubkey: string
	profile: { displayName?: string; name?: string; avatar?: string } | undefined
	lastMessageAt: number | undefined
	lastMessageSnippet: string
	lastMessageKind: number | undefined
	isUnread?: boolean
}

interface ConversationListItemProps {
	conversation: ConversationItemData
}

export function ConversationListItem({ conversation }: ConversationListItemProps) {
	const { pubkey, lastMessageAt, lastMessageSnippet } = conversation
	const breakpoint = useBreakpoint()
	const isMobile = breakpoint === 'sm'
	const { unseenByConversation } = useStore(notificationStore)

	// Get unseen count for this conversation
	const unseenCount = unseenByConversation[pubkey] || 0

	const dateElement = lastMessageAt && (
		<span className="text-muted-foreground text-xs whitespace-nowrap">{new Date(lastMessageAt * 1000).toLocaleString()}</span>
	)

	return (
		<Link
			to={`/dashboard/sales/messages/${pubkey}`}
			className="block w-full"
			activeProps={{
				className: 'bg-muted/20 rounded-lg',
			}}
		>
			<Card className="relative hover:bg-muted/50 p-4 transition-colors">
				{/* Unseen indicator badge */}
				{unseenCount > 0 && (
					<div className="inline-flex top-2 right-2 absolute justify-center items-center bg-pink-500 px-2 rounded-full min-w-[1.5rem] h-6 font-bold text-white text-xs">
						{unseenCount > 99 ? '99+' : unseenCount}
					</div>
				)}

				<div className="flex items-center gap-4">
					{/* Icon */}
					<div className="bg-muted p-2 rounded-full">
						<MessageSquareText className="w-6 h-6 text-muted-foreground" />
					</div>

					{/* Content Block */}
					<div className="flex flex-col flex-1 gap-1">
						{/* Top Row: Avatar and Date */}
						<div className="flex justify-between items-center">
							<UserCard pubkey={pubkey} size="sm" onPress="none" />
							{!isMobile && dateElement}
						</div>
						{/* Bottom Row: Snippet */}
						<div className="pr-12">
							<p className={`text-sm break-words ${unseenCount > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
								{lastMessageSnippet}
							</p>
						</div>
						{isMobile && <div className="self-end mt-1">{dateElement}</div>}
					</div>
				</div>
			</Card>
		</Link>
	)
}
