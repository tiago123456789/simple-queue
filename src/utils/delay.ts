const MAX_DELAY_MS = 24 * 60 * 60 * 1000;

export function parseDelay(delayStr: string):
	| {
			success: true;
			visibilityAt: number;
	  }
	| {
			success: false;
			error: 'INVALID_FORMAT' | 'EXCEEDS_MAX';
	  } {
	const match = delayStr.match(/^(\d+)([smh])$/);
	if (!match) {
		return { success: false, error: 'INVALID_FORMAT' };
	}

	const value = parseInt(match[1]);
	const unit = match[2];

	let delayMs: number;
	if (unit === 's') {
		delayMs = value * 1000;
	} else if (unit === 'm') {
		delayMs = value * 60 * 1000;
	} else {
		delayMs = value * 60 * 60 * 1000;
	}

	if (delayMs > MAX_DELAY_MS) {
		return { success: false, error: 'EXCEEDS_MAX' };
	}

	const visibilityAt = delayMs === 0 ? Date.now() : Date.now() + delayMs;
	return { success: true, visibilityAt };
}
