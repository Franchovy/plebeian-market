import { ProfilePage } from '@/components/features/profile/ProfilePage'
import { vanityActions, vanityStore } from '@/lib/stores/vanity'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useStore } from '@tanstack/react-store'

export const Route = createFileRoute('/$vanityName')({
	component: VanityRouteComponent,
})

function VanityRouteComponent() {
	const { vanityName } = Route.useParams()
	const navigate = useNavigate()
	const isLoaded = useStore(vanityStore, (s) => s.isLoaded)
	const lastUpdated = useStore(vanityStore, (s) => s.lastUpdated)

	// Resolve vanity URL to pubkey
	const resolvedPubkey = useMemo(() => {
		const entry = vanityActions.resolveVanity(vanityName)
		return entry?.pubkey ?? null
	}, [vanityName, isLoaded, lastUpdated])

	// Re-check resolution when store updates
	useEffect(() => {
		// If still not found after store is loaded, stay on this page (shows 404)
	}, [vanityName, isLoaded, lastUpdated])

	// Loading state while store syncs
	if (!isLoaded) {
		return (
			<div className="flex justify-center items-center min-h-screen">
				<div className="text-center">
					<div className="mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full w-8 h-8 animate-spin" />
					<p className="text-muted-foreground">Loading...</p>
				</div>
			</div>
		)
	}

	// Vanity URL resolved - render profile page directly
	if (resolvedPubkey) {
		return <ProfilePage profileId={resolvedPubkey} />
	}

	// Vanity URL not found - show 404-like message
	return (
		<div className="flex justify-center items-center min-h-screen">
			<div className="mx-auto p-8 max-w-md text-center">
				<h1 className="mb-4 font-bold text-4xl">Page Not Found</h1>
				<p className="mb-6 text-muted-foreground">
					The vanity URL <span className="font-mono text-primary">/{vanityName}</span> is not registered or has expired.
				</p>
				<button
					onClick={() => navigate({ to: '/' })}
					className="bg-primary hover:opacity-90 px-6 py-3 rounded-lg text-primary-foreground transition-opacity"
				>
					Go Home
				</button>
			</div>
		</div>
	)
}
