import { Button } from '@/components/ui/button'
import { AvatarUser } from '@/components/shared/user/AvatarUser'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { BugReport } from '@/queries/bugReports'
import { useProfile } from '@/queries/profiles'

interface BugReportItemProps {
	report: BugReport
	className?: string
}

export function BugReportItem({ report, className }: BugReportItemProps) {
	const navigate = useNavigate()
	const { data: dataUser, isLoading: isLoadingProfile } = useProfile(report.pubkey)
	const { user, profile } = dataUser ?? {}

	const handleProfileClick = () => {
		navigate({ to: '/profile/$profileId', params: { profileId: report.pubkey } })
	}

	const displayName = profile?.name || profile?.displayName || report.pubkey.slice(0, 8) + '...'
	const nameInitial = displayName.charAt(0).toUpperCase()

	const formatDate = (timestamp: number) => {
		return new Date(timestamp * 1000).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	return (
		<div className={cn('space-y-3 p-4 border border-gray-200 rounded-lg', className)}>
			{/* User info header */}
			<div className="flex justify-between items-center">
				<Button variant="ghost" onClick={handleProfileClick} className="flex items-center gap-2 hover:bg-gray-50 p-0 h-auto">
					<AvatarUser pubkey={report.pubkey} className="w-8 h-8" />
					<div className="flex flex-col items-start">
						<span className="font-medium text-gray-900 text-sm">{displayName}</span>
						<span className="text-gray-500 text-xs">{report.pubkey.slice(0, 8)}...</span>
					</div>
				</Button>
				<span className="text-gray-500 text-xs">{formatDate(report.createdAt)}</span>
			</div>

			{/* Report content */}
			<div className="text-gray-800 text-sm break-words whitespace-pre-wrap">{report.content}</div>
		</div>
	)
}
