import groups from './../../chatbot_group.json' with { type: 'json' };

const get = (id?: string) => {
	if (!id) return 'DEFAULT';
	return groups.find((group) => group.name === id)?.name || 'DEFAULT';
};

export { get };
