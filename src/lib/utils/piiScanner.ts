import { ORDER_PROCESS_KIND } from '@/lib/schemas/order'
import { ndkActions } from '@/lib/stores/ndk'
import type { NDKEvent } from '@nostr-dev-kit/ndk'

export interface PIIScanResult {
	hasPII: boolean
	eventsWithPII: PIIEvent[]
	totalEventsScanned: number
}

export interface PIIEvent {
	eventId: string
	createdAt: number
	piiTags: string[] // 'address', 'email', 'phone'
	piiInfo: string[] // customer@example.com, 23 Aberdeen Street, TX, USA
	relayUrl: string
}

/**
 * Scan for PII exposure in user's order events
 * @param userPubkey The user's public key
 * @returns PIIScanResult with details about exposed PII
 */
export async function scanForPIIExposure(userPubkey: string): Promise<PIIScanResult> {
	const ndk = ndkActions.getNDK()
	if (!ndk) {
		throw new Error('NDK not initialized')
	}

	try {
		// Fetch all order events authored by the user (kind 16)
		const filter = {
			kinds: [ORDER_PROCESS_KIND],
			authors: [userPubkey],
		}

		const events = await ndk.fetchEvents(filter)
		const eventsArray = Array.from(events)

		console.log(`[PII Scanner] Scanning ${eventsArray.length} order events for PII exposure`)

		const piiLeaks: PIIEvent[] = []

		// Check each event for PII tags
		for (const event of eventsArray) {
			const piiTags: string[] = []
			const piiInfo: string[] = []

			// Check for PII tags
			const addressTag = event.tags.find((tag) => tag[0] === 'address')
			if (addressTag) {
				piiTags.push('address')
				piiInfo.push(addressTag[1])
			}

			const emailTag = event.tags.find((tag) => tag[0] === 'email')
			if (emailTag) {
				piiTags.push('email')
				piiInfo.push(emailTag[1])
			}

			const phoneTag = event.tags.find((tag) => tag[0] === 'phone')
			if (phoneTag) {
				piiTags.push('phone')
				piiInfo.push(phoneTag[1])
			}

			// Also check for "amount", found in "type":"2" tags (zap confirmation)
			const amountTag = event.tags.find((tag) => tag[0] === 'amount')
			if (amountTag) {
				piiTags.push('purchase amount')
				piiInfo.push('Payment of ' + amountTag[1] + ' sats')
			}

			// If PII found, add to results
			if (piiTags.length > 0) {
				piiLeaks.push({
					eventId: event.id,
					createdAt: event.created_at || 0,
					piiTags,
					piiInfo,
					relayUrl: event.relay?.url ?? 'unknown',
				})
			}
		}

		return {
			hasPII: piiLeaks.length > 0,
			eventsWithPII: piiLeaks,
			totalEventsScanned: eventsArray.length,
		}
	} catch (error) {
		console.error('[PII Scanner] Error scanning for PII:', error)
		throw error
	}
}
