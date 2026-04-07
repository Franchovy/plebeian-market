import { OrderCard } from '@/components/features/orders/OrderCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { authStore } from '@/lib/stores/auth'
import { useConversationsList } from '@/queries/messages'
import { useOrders } from '@/queries/orders'
import { useProductsByPubkey } from '@/queries/products'
import { useDashboardTitle } from '@/routes/_dashboard-layout'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'

export const Route = createFileRoute('/_dashboard-layout/dashboard/')({
	component: DashboardInnerComponent,
})

function DashboardInnerComponent() {
	useDashboardTitle('Dashboard')

	const { user } = useStore(authStore)
	const userPubkey = user?.pubkey || ''

	const { data: myProducts, isLoading: isLoadingProducts } = useProductsByPubkey(userPubkey, true)
	const { data: orders, isLoading: isLoadingOrders } = useOrders()
	const { data: conversations, isLoading: isLoadingMessages } = useConversationsList()

	// Calculate stats
	const activeListings =
		myProducts?.filter((p: NDKEvent) => {
			const visibility = p.tags.find((t: string[]) => t[0] === 'visibility')?.[1]
			return visibility !== 'hidden'
		}).length || 0

	const totalListings = myProducts?.length || 0

	// Buyer = author of order (sent the order)
	// Seller = recipient of order (tagged with #p)
	const buyerOrders =
		orders?.filter((o) => {
			return o.order.pubkey === userPubkey
		}) || []

	const sellerOrders =
		orders?.filter((o) => {
			const pTag = o.order.tags.find((t) => t[0] === 'p')
			return pTag?.[1] === userPubkey
		}) || []

	const unreadMessages = conversations?.length || 0

	const recentOrders = orders?.slice(0, 3) || []

	const isLoading = isLoadingProducts || isLoadingOrders || isLoadingMessages

	return (
		<div className="space-y-6">
			{/* Welcome Section */}
			<div>
				<h2 className="mb-2 font-bold text-2xl">Welcome back!</h2>
				<p className="text-muted-foreground">Here's what's happening with your marketplace</p>
			</div>

			{/* Stats Grid */}
			<div className="gap-4 grid md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Active Listings</CardTitle>
						<span className="text-2xl">📦</span>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="w-20 h-8" />
						) : (
							<>
								<div className="font-bold text-2xl">{activeListings}</div>
								<p className="text-muted-foreground text-xs">{totalListings} total products</p>
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Sales</CardTitle>
						<span className="text-2xl">💰</span>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="w-20 h-8" />
						) : (
							<>
								<div className="font-bold text-2xl">{sellerOrders.length}</div>
								<p className="text-muted-foreground text-xs">Orders received</p>
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Purchases</CardTitle>
						<span className="text-2xl">🛍️</span>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="w-20 h-8" />
						) : (
							<>
								<div className="font-bold text-2xl">{buyerOrders.length}</div>
								<p className="text-muted-foreground text-xs">Orders placed</p>
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Messages</CardTitle>
						<span className="text-2xl">✉️</span>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="w-20 h-8" />
						) : (
							<>
								<div className="font-bold text-2xl">{unreadMessages}</div>
								<p className="text-muted-foreground text-xs">Conversations</p>
							</>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Quick Actions */}
			<Card>
				<CardHeader>
					<CardTitle>Quick Actions</CardTitle>
					<CardDescription>Common tasks to get you started</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="gap-4 grid md:grid-cols-2 lg:grid-cols-3">
						<Link to="/dashboard/products/products/new">
							<Button variant="outline" className="justify-start py-4 w-full h-auto">
								<div className="flex items-start gap-3">
									<span className="text-2xl">➕</span>
									<div className="text-left">
										<div className="font-semibold">Create Product</div>
										<div className="text-muted-foreground text-xs">List a new item for sale</div>
									</div>
								</div>
							</Button>
						</Link>

						<Link to="/dashboard/sales/sales">
							<Button variant="outline" className="justify-start py-4 w-full h-auto">
								<div className="flex items-start gap-3">
									<span className="text-2xl">💰</span>
									<div className="text-left">
										<div className="font-semibold">View Sales</div>
										<div className="text-muted-foreground text-xs">Manage your orders</div>
									</div>
								</div>
							</Button>
						</Link>

						<Link to="/dashboard/sales/messages">
							<Button variant="outline" className="justify-start py-4 w-full h-auto">
								<div className="flex items-start gap-3">
									<span className="text-2xl">✉️</span>
									<div className="text-left">
										<div className="font-semibold">Messages</div>
										<div className="text-muted-foreground text-xs">Chat with buyers/sellers</div>
									</div>
								</div>
							</Button>
						</Link>

						<Link to="/dashboard/products/collections">
							<Button variant="outline" className="justify-start py-4 w-full h-auto">
								<div className="flex items-start gap-3">
									<span className="text-2xl">🗂️</span>
									<div className="text-left">
										<div className="font-semibold">Collections</div>
										<div className="text-muted-foreground text-xs">Organize your products</div>
									</div>
								</div>
							</Button>
						</Link>

						<Link to="/dashboard/account/receiving-payments">
							<Button variant="outline" className="justify-start py-4 w-full h-auto">
								<div className="flex items-start gap-3">
									<span className="text-2xl">💸</span>
									<div className="text-left">
										<div className="font-semibold">Payment Settings</div>
										<div className="text-muted-foreground text-xs">Configure how you get paid</div>
									</div>
								</div>
							</Button>
						</Link>

						<Link to="/dashboard/account/profile">
							<Button variant="outline" className="justify-start py-4 w-full h-auto">
								<div className="flex items-start gap-3">
									<span className="text-2xl">👤</span>
									<div className="text-left">
										<div className="font-semibold">Edit Profile</div>
										<div className="text-muted-foreground text-xs">Update your store info</div>
									</div>
								</div>
							</Button>
						</Link>
					</div>
				</CardContent>
			</Card>

			{/* Recent Activity */}
			<Card>
				<CardHeader>
					<CardTitle>Recent Activity</CardTitle>
					<CardDescription>Your latest sales and purchases</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="space-y-4">
							{[...Array(3)].map((_, i) => (
								<div key={i} className="flex items-center space-x-4">
									<Skeleton className="rounded-full w-12 h-12" />
									<div className="flex-1 space-y-2">
										<Skeleton className="w-full h-4" />
										<Skeleton className="w-3/4 h-4" />
									</div>
								</div>
							))}
						</div>
					) : recentOrders.length === 0 ? (
						<div className="py-8 text-center">
							<p className="text-muted-foreground">No orders yet</p>
						</div>
					) : (
						<div className="space-y-4">
							{recentOrders.map((orderData) => (
								<OrderCard key={orderData.order.id} orderData={orderData} userPubkey={userPubkey} />
							))}
							<Link to="/dashboard/sales/sales">
								<Button variant="ghost" className="w-full">
									View All Orders →
								</Button>
							</Link>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Getting Started Guide (shown if user has no products) */}
			{!isLoading && totalListings === 0 && (
				<Card className="border-primary">
					<CardHeader>
						<CardTitle>Getting Started</CardTitle>
						<CardDescription>Welcome to your marketplace dashboard! Here's how to get started:</CardDescription>
					</CardHeader>
					<CardContent>
						<ol className="space-y-4">
							<li className="flex items-start gap-3">
								<span className="flex flex-shrink-0 justify-center items-center bg-primary rounded-full w-6 h-6 font-bold text-primary-foreground text-sm">
									1
								</span>
								<div>
									<div className="font-semibold">Set up your profile</div>
									<p className="text-muted-foreground text-sm">Add your store name, description, and contact info</p>
									<Link to="/dashboard/account/profile">
										<Button variant="link" className="p-0 h-auto">
											Go to Profile →
										</Button>
									</Link>
								</div>
							</li>
							<li className="flex items-start gap-3">
								<span className="flex flex-shrink-0 justify-center items-center bg-primary rounded-full w-6 h-6 font-bold text-primary-foreground text-sm">
									2
								</span>
								<div>
									<div className="font-semibold">Configure payment methods</div>
									<p className="text-muted-foreground text-sm">Set up how you'll receive payments from customers</p>
									<Link to="/dashboard/account/receiving-payments">
										<Button variant="link" className="p-0 h-auto">
											Set Up Payments →
										</Button>
									</Link>
								</div>
							</li>
							<li className="flex items-start gap-3">
								<span className="flex flex-shrink-0 justify-center items-center bg-primary rounded-full w-6 h-6 font-bold text-primary-foreground text-sm">
									3
								</span>
								<div>
									<div className="font-semibold">Set up shipping options</div>
									<p className="text-muted-foreground text-sm">Define how you'll deliver products to customers</p>
									<Link to="/dashboard/products/shipping-options">
										<Button variant="link" className="p-0 h-auto">
											Configure Shipping →
										</Button>
									</Link>
								</div>
							</li>
							<li className="flex items-start gap-3">
								<span className="flex flex-shrink-0 justify-center items-center bg-primary rounded-full w-6 h-6 font-bold text-primary-foreground text-sm">
									4
								</span>
								<div>
									<div className="font-semibold">Create your first product</div>
									<p className="text-muted-foreground text-sm">List an item with photos, description, and pricing</p>
									<Link to="/dashboard/products/products/new">
										<Button variant="link" className="p-0 h-auto">
											Create Product →
										</Button>
									</Link>
								</div>
							</li>
						</ol>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
