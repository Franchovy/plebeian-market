import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authStore } from '@/lib/stores/auth'
import { useDashboardTitle } from '@/routes/_dashboard-layout'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { useState } from 'react'
import { nip15ProductsQueryOptions, migratedEventsQueryOptions } from '@/queries/migration'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import { MigrationForm } from '@/components/features/migration/MigrationForm'
import { ArrowRightLeft } from 'lucide-react'

export const Route = createFileRoute('/_dashboard-layout/dashboard/products/migration-tool')({
	component: MigrationToolComponent,
})

function MigrationToolComponent() {
	const { user, isAuthenticated } = useStore(authStore)
	const queryClient = useQueryClient()
	useDashboardTitle('Migration Tool')
	const [selectedEvent, setSelectedEvent] = useState<NDKEvent | null>(null)

	const { data: nip15Products, isLoading: isLoadingNip15 } = useQuery({
		...nip15ProductsQueryOptions(user?.pubkey || ''),
		enabled: !!user?.pubkey && isAuthenticated,
	})

	const { data: migratedEventIds, isLoading: isLoadingMigrated } = useQuery({
		...migratedEventsQueryOptions(user?.pubkey || ''),
		enabled: !!user?.pubkey && isAuthenticated,
	})

	const handleMigrationSuccess = async () => {
		setSelectedEvent(null)
		if (user?.pubkey) {
			await queryClient.invalidateQueries({ queryKey: ['migration'] })
			await queryClient.refetchQueries({ queryKey: ['migration'] })
		}
	}

	if (!isAuthenticated || !user) {
		return (
			<div className="p-6 text-center">
				<p>Please log in to use the migration tool.</p>
			</div>
		)
	}

	// Filter out already migrated events
	const unmigratedProducts = nip15Products?.filter((event) => !migratedEventIds?.has(event.id)) || []

	if (selectedEvent) {
		return <MigrationForm nip15Event={selectedEvent} onBack={() => setSelectedEvent(null)} onSuccess={handleMigrationSuccess} />
	}

	return (
		<div>
			<div className="hidden top-0 z-10 sticky lg:flex justify-between items-center bg-white px-4 lg:px-6 py-4 border-b">
				<div className="flex items-center gap-3">
					<ArrowRightLeft className="w-8 h-8 text-muted-foreground" />
					<div>
						<h1 className="font-bold text-2xl">Migration Tool</h1>
						<p className="text-muted-foreground text-sm">If you have NIP-15 listings (legacy format), you can to update them here.</p>
					</div>
				</div>
			</div>
			<div className="space-y-4 p-4 lg:p-6">
				{isLoadingNip15 ? (
					<div className="p-6 text-gray-500 text-center">Loading products...</div>
				) : unmigratedProducts.length === 0 ? (
					<Card>
						<CardHeader>
							<CardTitle>No products to migrate</CardTitle>
							<CardDescription>
								{nip15Products && nip15Products.length > 0
									? 'All your NIP-15 products have been migrated.'
									: 'No NIP-15 products found in your relay list.'}
							</CardDescription>
						</CardHeader>
					</Card>
				) : (
					<div className="space-y-4">
						<div className="text-gray-600 text-sm">
							Found {unmigratedProducts.length} product{unmigratedProducts.length !== 1 ? 's' : ''} to migrate
						</div>
						<div className="space-y-2">
							{unmigratedProducts.map((event) => {
								const productData = parseNip15Event(event)
								return (
									<Card
										key={event.id}
										className="hover:bg-gray-50 transition-colors cursor-pointer"
										onClick={() => setSelectedEvent(event)}
									>
										<CardContent className="p-4">
											<div className="flex justify-between items-start">
												<div className="flex-1">
													<h3 className="mb-1 font-semibold text-lg">{productData.name}</h3>
													<p className="mb-2 text-gray-600 text-sm line-clamp-2">{productData.description || 'No description'}</p>
													<div className="flex gap-4 text-sm">
														<span>
															<strong>Price:</strong> {productData.price} {productData.currency}
														</span>
														{productData.quantity !== null && (
															<span>
																<strong>Quantity:</strong> {productData.quantity}
															</span>
														)}
													</div>
												</div>
												<Button variant="outline" size="sm">
													Migrate
												</Button>
											</div>
										</CardContent>
									</Card>
								)
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

/**
 * Parses a NIP-15 event (kind 30018) into a readable format
 */
function parseNip15Event(event: NDKEvent) {
	let productData: {
		id: string
		name: string
		description: string
		price: string
		currency: string
		quantity: number | null
		images: string[]
		specs: Array<[string, string]>
		stall_id?: string
	} = {
		id: '',
		name: '',
		description: '',
		price: '0',
		currency: 'USD',
		quantity: null,
		images: [],
		specs: [],
	}

	try {
		const content = JSON.parse(event.content)
		productData = {
			id: content.id || '',
			name: content.name || '',
			description: content.description || '',
			price: content.price?.toString() || '0',
			currency: content.currency || 'USD',
			quantity: content.quantity ?? null,
			images: content.images || [],
			specs: content.specs || [],
			stall_id: content.stall_id,
		}
	} catch (error) {
		console.error('Failed to parse NIP-15 event content:', error)
		// Fallback: try to extract from tags
		const dTag = event.tags.find((tag) => tag[0] === 'd')
		if (dTag) {
			productData.id = dTag[1] || ''
		}
		productData.description = event.content || ''
	}

	return productData
}
