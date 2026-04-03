export interface Consumer {
	id: string;
	group_id: string;
	created_at: number;
	status: 'WAITING' | 'WORKING';
	expired_at: number | null;
}

export const CONSUMER_STATUS = {
	WAITING: 'WAITING',
	WORKING: 'WORKING',
} as const;
