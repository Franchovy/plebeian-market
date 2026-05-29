import { ndkActions } from '@/lib/stores/ndk'
import { NDKEvent } from '@nostr-dev-kit/ndk'

export interface DeletionResult {
	success: boolean
	error?: string
	deletedEvents?: string[]
}

/**
 * Delete PII events using NIP-09 Event Deletion
 * @param eventIds Array of event IDs to delete
 * @param onProgress Callback to report deletion progress
 * @returns DeletionResult with status
 */
export async function deletePIIEvents(eventIds: string[], onProgress?: (deletedCount: number) => void): Promise<DeletionResult> {
	const ndk = ndkActions.getNDK()
	if (!ndk) {
		return { success: false, error: 'NDK not initialized' }
	}

	const signer = ndkActions.getSigner()
	if (!signer) {
		return { success: false, error: 'No signer available' }
	}

	try {
		// Create deletion event (kind 5) per NIP-09
		const deletionEvent = new NDKEvent(ndk)
		deletionEvent.kind = 5 // Deletion event kind
		deletionEvent.content = 'Deleting PII exposure events'

		// Add 'e' tags for each event to delete
		deletionEvent.tags = eventIds.map((id) => ['e', id])

		// Add 'k' tags for kinds being deleted (16 for order events)
		deletionEvent.tags.push(['k', '16'])

		// Sign and publish the deletion event
		await deletionEvent.sign(signer)

		// Publish to all connected relays
		const publishedRelays = await ndkActions.publishEvent(deletionEvent)

		console.log(`Deletion event published to ${publishedRelays.size} relays`)

		// Call progress callback with total count
		if (onProgress) {
			onProgress(eventIds.length)
		}

		return {
			success: true,
			deletedEvents: eventIds,
		}
	} catch (error) {
		console.error('Failed to delete PII events:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to delete events',
		}
	}
}

/**
 * Verify that events have been deleted
 * Note: This is best-effort since relays may not immediately delete events
 * @param eventIds Array of event IDs to check
 * @returns Verification result
 */
export async function verifyDeletion(eventIds: string[]): Promise<{ verified: boolean; foundEvents: string[] }> {
	const ndk = ndkActions.getNDK()
	if (!ndk) {
		return { verified: false, foundEvents: [] }
	}

	try {
		// Try to fetch the events we're trying to delete
		const filter = {
			ids: eventIds,
			limit: eventIds.length,
		}

		const events = await ndk.fetchEvents(filter)
		const foundEventIds = Array.from(events).map((event) => event.id)

		// If we found any of the events, deletion may not be complete
		return {
			verified: foundEventIds.length === 0,
			foundEvents: foundEventIds,
		}
	} catch (error) {
		console.error('Failed to verify deletion:', error)
		return { verified: false, foundEvents: [] }
	}
}
