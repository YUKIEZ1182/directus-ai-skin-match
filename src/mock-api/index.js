export default (router) => {
	router.get('/', async (req, res) => {
		res.json({ message: 'Hello from the Service Request API!' });
	});
};