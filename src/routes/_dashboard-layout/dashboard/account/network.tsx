import { RelayManager } from '@/components/features/relays/RelayManager'
import { useDashboardTitle } from '@/routes/_dashboard-layout'
import { createFileRoute } from '@tanstack/react-router'
import { Globe } from 'lucide-react'

export const Route = createFileRoute('/_dashboard-layout/dashboard/account/network')({
	component: NetworkComponent,
})

function NetworkComponent() {
	useDashboardTitle('Network')
	return (
		<div>
			<div className="hidden top-0 z-10 sticky lg:flex justify-between items-center bg-white px-4 lg:px-6 py-4 border-b">
				<div className="flex items-center gap-3">
					<Globe className="w-6 h-6 text-muted-foreground" />
					<div>
						<h1 className="font-bold text-2xl">Network</h1>
						<p className="text-muted-foreground text-sm">Manage your Nostr relay connections</p>
					</div>
				</div>
			</div>
			<div className="p-4 lg:p-8">
				<div className="lg:hidden mb-6">
					<div className="flex items-center gap-3">
						<Globe className="w-6 h-6 text-muted-foreground" />
						<div>
							<h1 className="font-bold text-2xl">Network</h1>
							<p className="text-muted-foreground text-sm">Manage your Nostr relay connections</p>
						</div>
					</div>
				</div>
				<RelayManager />
			</div>
		</div>
	)
}
