import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { PIIScanResult } from '@/lib/utils/piiScanner'
import { deletePIIEvents } from '@/lib/utils/piiDeletion' // We'll create this
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

interface PIIExposureModalProps {
	isOpen: boolean
	onClose: () => void
	scanResult: PIIScanResult
}

export function PIIExposureModal({ isOpen, onClose, scanResult }: PIIExposureModalProps) {
	const [isDeleting, setIsDeleting] = useState(false)
	const [deletionProgress, setDeletionProgress] = useState<{ deleted: number; total: number }>({ deleted: 0, total: 0 })
	const [deletionComplete, setDeletionComplete] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (scanResult) {
			setDeletionProgress({ deleted: 0, total: scanResult.eventsWithPII.length })
		}
	}, [scanResult])

	const handleDeleteEvents = async () => {
		if (!scanResult) return

		setIsDeleting(true)
		setError(null)

		try {
			const result = await deletePIIEvents(
				scanResult.eventsWithPII.map((event) => event.eventId),
				(deletedCount) => {
					setDeletionProgress({ deleted: deletedCount, total: scanResult.eventsWithPII.length })
				},
			)

			if (result.success) {
				setDeletionComplete(true)
			} else {
				setError(result.error || 'Failed to delete events')
			}
		} catch (err) {
			setError('An error occurred while deleting events')
			console.error('Deletion error:', err)
		} finally {
			setIsDeleting(false)
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-none sm:w-[calc(100%-2rem)] max-h-[90vh] overflow-scroll">
				<DialogHeader>
					<DialogTitle className="text-red-600">Personal Information Leak Detected</DialogTitle>
				</DialogHeader>

				<Alert variant="destructive">
					<AlertDescription>
						Due to an issue with previous implementation of post-purchase communication of shipping details, some personally identifiable
						information (PII) could have been leaked publicly.
					</AlertDescription>
				</Alert>

				<div className="space-y-4">
					<div>
						<p className="font-medium">
							The app has just run a check and found some information that may be exposing your personal information: (Hover to see info)
						</p>
						<ScrollArea className="h-32 rounded-md border p-2 mt-2">
							<ul className="list-disc list-inside space-y-1">
								{scanResult?.eventsWithPII.map((event, index) => (
									<li key={index}>
										Event {event.eventId.substring(0, 8)}... contains:{' '}
										<Tooltip>
											<TooltipTrigger className="cursor-default! normal-case!">
												<span>{event.piiTags.join(', ')}</span>
											</TooltipTrigger>
											<TooltipContent>
												<span>{event.piiInfo.join(', ')}</span>
											</TooltipContent>
										</Tooltip>
									</li>
								))}
							</ul>
						</ScrollArea>
					</div>

					<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
						<div className="flex">
							<div className="ml-3">
								<p className="text-sm text-yellow-700">
									<strong>How to Proceed</strong>
								</p>
								<ul className="mt-1 list-disc list-inside text-sm text-yellow-700 space-y-1">
									<li>
										<strong>Don't panic!</strong> Read all the instructions carefully to avoid any potential leaking of personal data.
									</li>
									<li>
										<strong>We need users like you to delete the data yourselves.</strong> On Nostr, users own their data, so the Plebeian
										Team cannot delete events on behalf of our users.
									</li>
									<li>
										<strong>Please avoid posting publicly, including in the Plebeian telegram or on Nostr, about this leak.</strong> We are
										working with our users and with relays to delete as much of the leaked information as soon as possible.
									</li>
									<li>
										<strong>Press the button below to request deletion of the potentially doxing events.</strong> Contact any member of our
										team directly (ChiefMonkey, Bekka, Maximotodev, Franchovy) if you need assistance or have any questions.
									</li>
								</ul>
							</div>
						</div>
					</div>

					{error && (
						<div className="bg-red-50 border-l-4 border-red-400 p-4">
							<div className="flex">
								<div className="ml-3">
									<p className="text-sm text-red-700">
										<strong>Error:</strong> {error}
									</p>
								</div>
							</div>
						</div>
					)}

					<div className="flex">
						<div className="ml-3">
							<p className="text-sm text-center">
								<strong>
									Note that deleting these events will erase communications containing shipping addresses, emails and zap amounts,
									potentially needed by the seller to confirm any recently purchases.
								</strong>
							</p>
						</div>
					</div>

					<div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
						<div className="flex gap-2">
							<Button onClick={handleDeleteEvents} disabled={isDeleting || deletionComplete} variant="destructive">
								{deletionComplete ? 'Deletion Complete' : isDeleting ? 'Deleting...' : 'Request Deletion of Events'}
							</Button>
						</div>
						<div className="text-sm">
							{isDeleting ? (
								<span>Deleting events...</span>
							) : (
								deletionComplete && <span className="text-green-600 font-medium">Deletion request complete:</span>
							)}
							<span>
								{deletionProgress.deleted}/{deletionProgress.total} events deleted
							</span>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
