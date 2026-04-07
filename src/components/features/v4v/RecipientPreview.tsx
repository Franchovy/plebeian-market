import { nip19 } from 'nostr-tools'
import { Card } from '@/components/ui/card'
import { UserCard } from '@/components/shared/user/UserCard'

interface RecipientPreviewProps {
	npub: string
	percentage: number
	canReceiveZaps: boolean | undefined
	isLoading: boolean
}

export function RecipientPreview({ npub, percentage, canReceiveZaps, isLoading }: RecipientPreviewProps) {
	if (!npub) return null

	let pubkey: string = npub

	// Convert npub to hex pubkey if needed
	if (npub.startsWith('npub')) {
		try {
			const { data } = nip19.decode(npub)
			if (typeof data === 'string') {
				pubkey = data
			}
		} catch (error) {
			// Invalid npub, but still show something
			return (
				<Card className="bg-orange-50 mt-2 p-3 border-orange-300 border-dashed">
					<div className="text-orange-700 text-sm">Invalid npub format</div>
				</Card>
			)
		}
	}

	if (isLoading) {
		return (
			<Card className="mt-2 p-3 border-dashed">
				<div className="flex items-center gap-2">
					<div className="bg-gray-200 rounded-full w-6 h-6 animate-pulse"></div>
					<div className="flex-1 bg-gray-200 rounded h-4 animate-pulse"></div>
					<div className="text-gray-500 text-sm">Checking zap capability...</div>
				</div>
			</Card>
		)
	}

	return (
		<Card className={`p-3 border-dashed ${canReceiveZaps ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'} mt-2`}>
			<div className="flex items-center gap-2">
				<UserCard pubkey={pubkey} size="xs" />
				<div className="flex-grow"></div>
				<div className="font-semibold">{percentage}%</div>
				{canReceiveZaps === false && <div className="text-red-600 text-sm">Cannot receive zaps</div>}
			</div>
		</Card>
	)
}
