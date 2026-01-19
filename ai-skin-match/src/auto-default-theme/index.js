export default ({ filter }) => {
	filter('users.create', (input) => {
		input.theme = 'light';
		return input;
	});
};