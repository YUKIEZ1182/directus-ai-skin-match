import ModuleComponent from './module.vue';

export default {
	id: 'product-import',
	name: 'Product Import',
	icon: 'upload_file',
	routes: [
		{
			path: '',
			component: ModuleComponent,
		},
	],
};