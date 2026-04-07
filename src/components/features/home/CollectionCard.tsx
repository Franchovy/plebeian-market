import { uiActions } from '@/lib/stores/ui'
import { getCollectionId, getCollectionImages, getCollectionSummary, getCollectionTitle } from '@/queries/collections.tsx'
import { NDKEvent } from '@nostr-dev-kit/ndk'
import { Link, useLocation } from '@tanstack/react-router'
import { UserCard } from '../../shared/user/UserCard'

export function CollectionCard({ collection }: { collection: NDKEvent }) {
	const title = getCollectionTitle(collection)
	const collectionId = getCollectionId(collection)
	const pubkey = collection.pubkey
	const summary = getCollectionSummary(collection)
	const images = getCollectionImages(collection)
	const location = useLocation()

	const handleCollectionClick = () => {
		// Store the current path as the source path
		// This will also store it as originalResultsPath if not already set
		uiActions.setCollectionSourcePath(location.pathname)
	}
	return (
		<div className="flex flex-col bg-white shadow-sm border border-zinc-800 rounded-lg" data-testid="product-card">
			{/* Square aspect ratio container for image */}
			<Link
				to={`/collection/${collectionId}`}
				className="block relative border-zinc-800 border-b aspect-square overflow-hidden"
				onClick={handleCollectionClick}
			>
				{images && images.length > 0 ? (
					<img
						src={images[0][1]}
						alt={title}
						className="rounded-t-[calc(var(--radius)-1px)] w-full h-full object-cover hover:scale-105 transition-transform duration-200"
					/>
				) : (
					<div className="flex justify-center items-center bg-gray-100 hover:bg-gray-200 rounded-lg w-full h-full text-gray-400 transition-colors duration-200">
						No image
					</div>
				)}
			</Link>

			<div className="flex flex-col flex-grow gap-2 p-4">
				{/* Product title */}
				<Link to={`/collection/${collectionId}`} onClick={handleCollectionClick}>
					<h2 className="pb-2 border-[var(--light-gray)] border-b overflow-hidden font-black text-lg text-ellipsis whitespace-nowrap">
						{title}
					</h2>
					<div className="font-medium text-md">{summary}</div>
				</Link>

				{/* Add a flex spacer to push the collection author to the bottom */}
				<div className="flex-grow"></div>
				<div className="flex flex-row items-center gap-2 text-sm">
					by <UserCard pubkey={pubkey} size="xs" />
				</div>
			</div>
		</div>
	)
}
