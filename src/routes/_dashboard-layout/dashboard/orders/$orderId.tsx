import { createFileRoute } from '@tanstack/react-router'
import { OrderDetailComponent } from '@/components/features/orders/OrderDetailComponent'
import { useDashboardTitle } from '@/routes/_dashboard-layout'
import { useOrderById } from '@/queries/orders'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_dashboard-layout/dashboard/orders/$orderId')({
	component: OrderDetailRouteComponent,
})

function OrderDetailRouteComponent() {
	const { orderId } = Route.useParams()
	useDashboardTitle('Order Details')

	const { data: order, isLoading, isFetching, error } = useOrderById(orderId)
	const isPending = isLoading || (!order && isFetching)

	if (isPending) {
		return (
			<div className="mx-auto px-4 py-8 container">
				<div className="space-y-6">
					<Card>
						<CardContent className="p-8">
							<div className="space-y-4">
								<Skeleton className="w-48 h-8" />
								<Skeleton className="w-full h-4" />
								<Skeleton className="w-3/4 h-4" />
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="mx-auto px-4 py-8 container">
				<Card>
					<CardContent className="p-8 text-center">
						<p className="text-red-500">Error loading order: {error.message}</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	if (!order) {
		return (
			<div className="mx-auto px-4 py-8 container">
				<Card>
					<CardContent className="p-8 text-center">
						<p className="text-gray-500">Order not found</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	return <OrderDetailComponent order={order} />
}
