'use strict';

var e0 = (router) => {
	router.get('/', async (req, res) => {
		res.json({ message: 'Hello from the Service Request API!' });
	});
};

const hooks = [];const endpoints = [{name:'mock-api',config:e0}];const operations = [];

exports.endpoints = endpoints;
exports.hooks = hooks;
exports.operations = operations;
