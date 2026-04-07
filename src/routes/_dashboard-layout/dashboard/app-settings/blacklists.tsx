import { CollectionDisplayComponent } from '@/components/features/dashboard/CollectionDisplayComponent'
import { ProductDisplayComponent } from '@/components/features/dashboard/ProductDisplayComponent'
import { UserDisplayComponent } from '@/components/UserDisplayComponent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getATagFromCoords, getCoordsFromATag } from '@/lib/utils/coords'
import {
	useAddToBlacklistCollectionsMutation,
	useAddToBlacklistMutation,
	useAddToBlacklistProductsMutation,
	useRemoveFromBlacklistCollectionsMutation,
	useRemoveFromBlacklistMutation,
	useRemoveFromBlacklistProductsMutation,
} from '@/publish/blacklist'
import { useUserRole } from '@/queries/app-settings'
import { getFormattedBlacklist, useBlacklistSettings } from '@/queries/blacklist'
import { fetchCollection, fetchCollectionByEventId, getCollectionId } from '@/queries/collections'
import { useConfigQuery } from '@/queries/config'
import { fetchProduct, getProductId } from '@/queries/products'
import { useDashboardTitle } from '@/routes/_dashboard-layout'
import { npubToHex } from '@/routes/setup'
import { createFileRoute } from '@tanstack/react-router'
import { FolderOpen, Package, Plus, Shield, UserMinus, Users as UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_dashboard-layout/dashboard/app-settings/blacklists')({
	component: BlacklistsComponent,
})

// Helper function to convert product input to coordinates
const convertProductInputToCoords = async (input: string): Promise<string> => {
	// If input is already a coordinate (contains colons), return as-is
	if (input.includes(':')) {
		try {
			getCoordsFromATag(input) // Validate format
			return input
		} catch {
			throw new Error('Invalid coordinate format')
		}
	}

	// If input is just an ID, fetch the product to get its real dtag and pubkey
	try {
		const productEvent = await fetchProduct(input)
		if (!productEvent) {
			throw new Error('Product not found')
		}

		const realDtag = getProductId(productEvent)
		if (!realDtag) {
			throw new Error('Product has no dtag')
		}

		// Create coordinates using the product's actual pubkey and dtag
		return getATagFromCoords({ kind: 30402, pubkey: productEvent.pubkey, identifier: realDtag })
	} catch (error) {
		throw new Error(`Failed to convert product ID to coordinates: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}
}

// Helper function to convert collection input to coordinates
const convertCollectionInputToCoords = async (input: string): Promise<string> => {
	// If input is already a coordinate (contains colons), return as-is
	if (input.includes(':')) {
		try {
			getCoordsFromATag(input) // Validate format
			return input
		} catch {
			throw new Error('Invalid coordinate format')
		}
	}

	// If input is just an ID, try to fetch the collection
	// First try as d-tag, then as event ID if that fails
	try {
		let collectionEvent = await fetchCollection(input)

		// If not found by d-tag, try by event ID (for 64-char hex strings)
		if (!collectionEvent && input.length === 64) {
			collectionEvent = await fetchCollectionByEventId(input)
		}

		if (!collectionEvent) {
			throw new Error('Collection not found')
		}

		const realDtag = getCollectionId(collectionEvent)
		if (!realDtag) {
			throw new Error('Collection has no dtag')
		}

		// Create coordinates using the collection's actual pubkey and dtag
		return getATagFromCoords({ kind: 30405, pubkey: collectionEvent.pubkey, identifier: realDtag })
	} catch (error) {
		throw new Error(`Failed to convert collection ID to coordinates: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}
}

function BlacklistsComponent() {
	useDashboardTitle('Blacklists')
	const { data: config } = useConfigQuery()
	const { data: blacklistSettings, isLoading: isLoadingBlacklist } = useBlacklistSettings(config?.appPublicKey)
	const { amIAdmin, amIEditor, isLoading: isLoadingPermissions } = useUserRole(config?.appPublicKey)

	// State for adding new items
	const [newUserInput, setNewUserInput] = useState('')
	const [newProductInput, setNewProductInput] = useState('')
	const [newCollectionInput, setNewCollectionInput] = useState('')
	const [isAddingUser, setIsAddingUser] = useState(false)
	const [isAddingProduct, setIsAddingProduct] = useState(false)
	const [isAddingCollection, setIsAddingCollection] = useState(false)

	// Mutation hooks
	const addToBlacklistMutation = useAddToBlacklistMutation()
	const removeFromBlacklistMutation = useRemoveFromBlacklistMutation()
	const addProductMutation = useAddToBlacklistProductsMutation()
	const removeProductMutation = useRemoveFromBlacklistProductsMutation()
	const addCollectionMutation = useAddToBlacklistCollectionsMutation()
	const removeCollectionMutation = useRemoveFromBlacklistCollectionsMutation()

	const formattedBlacklist = getFormattedBlacklist(blacklistSettings)
	const blacklistedProducts = blacklistSettings?.blacklistedProducts || []
	const blacklistedCollections = blacklistSettings?.blacklistedCollections || []

	// Handler functions
	const handleAddUser = async () => {
		if (!newUserInput.trim()) {
			toast.error('Please enter a valid npub or pubkey')
			return
		}

		try {
			setIsAddingUser(true)
			const hexPubkey = npubToHex(newUserInput.trim())
			await addToBlacklistMutation.mutateAsync({
				userPubkey: hexPubkey,
				appPubkey: config?.appPublicKey,
			})
			setNewUserInput('')
		} catch (error) {
			console.error('Failed to add user to blacklist:', error)
			toast.error(`Failed to add user to blacklist: ${error instanceof Error ? error.message : 'Unknown error'}`)
		} finally {
			setIsAddingUser(false)
		}
	}

	const handleRemoveUser = async (pubkey: string) => {
		try {
			await removeFromBlacklistMutation.mutateAsync({
				userPubkey: pubkey,
				appPubkey: config?.appPublicKey,
			})
		} catch (error) {
			console.error('Failed to remove user from blacklist:', error)
		}
	}

	const handleAddProduct = async () => {
		if (!newProductInput.trim()) {
			toast.error('Please enter a product ID or coordinate')
			return
		}

		try {
			setIsAddingProduct(true)
			const productCoords = await convertProductInputToCoords(newProductInput.trim())
			await addProductMutation.mutateAsync({
				productCoords,
				appPubkey: config?.appPublicKey,
			})
			setNewProductInput('')
		} catch (error) {
			console.error('Failed to add product to blacklist:', error)
			toast.error(`Failed to add product to blacklist: ${error instanceof Error ? error.message : 'Unknown error'}`)
		} finally {
			setIsAddingProduct(false)
		}
	}

	const handleRemoveProduct = async (productCoords: string) => {
		try {
			await removeProductMutation.mutateAsync({
				productCoords,
				appPubkey: config?.appPublicKey,
			})
		} catch (error) {
			console.error('Failed to remove product from blacklist:', error)
		}
	}

	const handleAddCollection = async () => {
		if (!newCollectionInput.trim()) {
			toast.error('Please enter a collection ID or coordinate')
			return
		}

		try {
			setIsAddingCollection(true)
			const collectionCoords = await convertCollectionInputToCoords(newCollectionInput.trim())
			await addCollectionMutation.mutateAsync({
				collectionCoords,
				appPubkey: config?.appPublicKey,
			})
			setNewCollectionInput('')
		} catch (error) {
			console.error('Failed to add collection to blacklist:', error)
			toast.error(`Failed to add collection to blacklist: ${error instanceof Error ? error.message : 'Unknown error'}`)
		} finally {
			setIsAddingCollection(false)
		}
	}

	const handleRemoveCollection = async (collectionCoords: string) => {
		try {
			await removeCollectionMutation.mutateAsync({
				collectionCoords,
				appPubkey: config?.appPublicKey,
			})
		} catch (error) {
			console.error('Failed to remove collection from blacklist:', error)
		}
	}

	if (isLoadingBlacklist || isLoadingPermissions) {
		return (
			<div className="space-y-6 p-6">
				<div className="animate-pulse">
					<div className="bg-gray-200 mb-4 rounded w-1/4 h-8"></div>
					<div className="space-y-3">
						<div className="bg-gray-200 rounded w-1/2 h-4"></div>
						<div className="bg-gray-200 rounded w-1/3 h-4"></div>
					</div>
				</div>
			</div>
		)
	}

	if (!amIAdmin && !amIEditor) {
		return (
			<div className="space-y-6 p-6">
				<div className="hidden top-0 z-10 sticky lg:flex justify-between items-center bg-white px-4 lg:px-6 py-4 border-b">
					<div className="flex items-center gap-3">
						<Shield className="w-6 h-6 text-muted-foreground" />
						<div>
							<h1 className="font-bold text-2xl">Blacklists</h1>
							<p className="text-muted-foreground text-sm">Manage user blacklists</p>
						</div>
					</div>
				</div>

				<Card>
					<CardContent className="p-6">
						<div className="text-center">
							<Shield className="mx-auto mb-4 w-16 h-16 text-gray-400" />
							<h3 className="mb-2 font-medium text-lg">Access Denied</h3>
							<p className="text-gray-600">You don't have permission to manage blacklists.</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div>
			<div className="hidden top-0 z-10 sticky lg:flex justify-between items-center bg-white px-4 lg:px-6 py-4 border-b">
				<div className="flex items-center gap-3">
					<Shield className="w-6 h-6 text-muted-foreground" />
					<div>
						<h1 className="font-bold text-2xl">Blacklists</h1>
						<p className="text-muted-foreground text-sm">Manage blacklisted users, products, and collections</p>
					</div>
				</div>
			</div>
			<div className="space-y-6 p-4 lg:p-8">
				<div className="lg:hidden mb-6">
					<div className="flex items-center gap-3">
						<Shield className="w-6 h-6 text-muted-foreground" />
						<div>
							<h1 className="font-bold text-2xl">Blacklists</h1>
							<p className="text-muted-foreground text-sm">Manage blacklisted users, products, and collections</p>
						</div>
					</div>
				</div>

				<Tabs defaultValue="users" className="w-full">
					<TabsList className="flex bg-transparent p-0 rounded-none w-full h-auto">
						<TabsTrigger
							value="users"
							className="flex flex-1 items-center gap-2 px-4 py-2 data-[state=active]:border-secondary border-b-1 rounded-none font-medium data-[state=active]:text-secondary data-[state=inactive]:text-black"
						>
							<UsersIcon className="w-4 h-4" />
							Users
						</TabsTrigger>
						<TabsTrigger
							value="products"
							className="flex flex-1 items-center gap-2 px-4 py-2 data-[state=active]:border-secondary border-b-1 rounded-none font-medium data-[state=active]:text-secondary data-[state=inactive]:text-black"
						>
							<Package className="w-4 h-4" />
							Products
						</TabsTrigger>
						<TabsTrigger
							value="collections"
							className="flex flex-1 items-center gap-2 px-4 py-2 data-[state=active]:border-secondary border-b-1 rounded-none font-medium data-[state=active]:text-secondary data-[state=inactive]:text-black"
						>
							<FolderOpen className="w-4 h-4" />
							Collections
						</TabsTrigger>
					</TabsList>

					{/* Users Tab */}
					<TabsContent value="users" className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<UserMinus className="w-5 h-5" />
									Blacklisted Users
								</CardTitle>
								<CardDescription>Users that are banned from the marketplace.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{formattedBlacklist.length === 0 ? (
									<div className="py-8 text-gray-500 text-center">
										<UserMinus className="mx-auto mb-3 w-12 h-12 text-gray-300" />
										<p>No users are currently blacklisted</p>
									</div>
								) : (
									<div className="space-y-3">
										{formattedBlacklist.map((user, index) => (
											<UserDisplayComponent
												key={user.pubkey}
												userPubkey={user.pubkey}
												index={index}
												onRemove={() => handleRemoveUser(user.pubkey)}
												isRemoving={removeFromBlacklistMutation.isPending}
											/>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Plus className="w-5 h-5" />
									Add User to Blacklist
								</CardTitle>
								<CardDescription>Blacklist a user by entering their npub or public key.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="newUser">Npub or Public Key</Label>
									<div className="flex gap-2">
										<Input
											id="newUser"
											value={newUserInput}
											onChange={(e) => setNewUserInput(e.target.value)}
											placeholder="npub1... or hex pubkey"
											className="flex-1"
										/>
										<Button onClick={handleAddUser} disabled={isAddingUser || addToBlacklistMutation.isPending || !newUserInput.trim()}>
											{isAddingUser || addToBlacklistMutation.isPending ? (
												<div className="border-2 border-white border-t-transparent rounded-full w-4 h-4 animate-spin" />
											) : (
												<UserMinus className="w-4 h-4" />
											)}
											Add
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Products Tab */}
					<TabsContent value="products" className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Package className="w-5 h-5" />
									Blacklisted Products
								</CardTitle>
								<CardDescription>Products that are hidden from the marketplace.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{blacklistedProducts.length === 0 ? (
									<div className="py-8 text-gray-500 text-center">
										<Package className="mx-auto mb-3 w-12 h-12 text-gray-300" />
										<p>No products are currently blacklisted</p>
									</div>
								) : (
									<div className="space-y-3">
										{blacklistedProducts.map((productCoords, index) => (
											<ProductDisplayComponent
												key={productCoords}
												productCoords={productCoords}
												index={index}
												onRemove={() => handleRemoveProduct(productCoords)}
												isRemoving={removeProductMutation.isPending}
											/>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Plus className="w-5 h-5" />
									Add Product to Blacklist
								</CardTitle>
								<CardDescription>Add a product to the blacklist using its ID or coordinate.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="newProduct">Product ID or Coordinate</Label>
									<div className="flex gap-2">
										<Input
											id="newProduct"
											value={newProductInput}
											onChange={(e) => setNewProductInput(e.target.value)}
											placeholder="my-product-id or 30402:pubkey:d-tag"
											className="flex-1"
										/>
										<Button
											onClick={handleAddProduct}
											disabled={isAddingProduct || addProductMutation.isPending || !newProductInput.trim()}
										>
											{isAddingProduct || addProductMutation.isPending ? (
												<div className="border-2 border-white border-t-transparent rounded-full w-4 h-4 animate-spin" />
											) : (
												<Package className="w-4 h-4" />
											)}
											Add
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Collections Tab */}
					<TabsContent value="collections" className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FolderOpen className="w-5 h-5" />
									Blacklisted Collections
								</CardTitle>
								<CardDescription>Collections that are hidden from the marketplace.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{blacklistedCollections.length === 0 ? (
									<div className="py-8 text-gray-500 text-center">
										<FolderOpen className="mx-auto mb-3 w-12 h-12 text-gray-300" />
										<p>No collections are currently blacklisted</p>
									</div>
								) : (
									<div className="space-y-3">
										{blacklistedCollections.map((collectionCoords, index) => (
											<CollectionDisplayComponent
												key={collectionCoords}
												collectionCoords={collectionCoords}
												index={index}
												onRemove={() => handleRemoveCollection(collectionCoords)}
												isRemoving={removeCollectionMutation.isPending}
											/>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Plus className="w-5 h-5" />
									Add Collection to Blacklist
								</CardTitle>
								<CardDescription>Add a collection to the blacklist using its ID or coordinate.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="newCollection">Collection ID or Coordinate</Label>
									<div className="flex gap-2">
										<Input
											id="newCollection"
											value={newCollectionInput}
											onChange={(e) => setNewCollectionInput(e.target.value)}
											placeholder="my-collection-id or 30405:pubkey:d-tag"
											className="flex-1"
										/>
										<Button
											onClick={handleAddCollection}
											disabled={isAddingCollection || addCollectionMutation.isPending || !newCollectionInput.trim()}
										>
											{isAddingCollection || addCollectionMutation.isPending ? (
												<div className="border-2 border-white border-t-transparent rounded-full w-4 h-4 animate-spin" />
											) : (
												<FolderOpen className="w-4 h-4" />
											)}
											Add
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				{/* Permissions Info */}
				<Card>
					<CardHeader>
						<CardTitle>Your Permissions</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-center gap-3">
							{amIAdmin ? <Shield className="w-5 h-5 text-blue-600" /> : <Shield className="w-5 h-5 text-purple-600" />}
							<div>
								<div className="font-medium">{amIAdmin ? 'Administrator' : 'Editor'}</div>
								<div className="text-gray-600 text-sm">
									{amIAdmin
										? 'You have full control over the marketplace and can manage blacklists.'
										: 'You can manage blacklists but have limited administrative access.'}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
