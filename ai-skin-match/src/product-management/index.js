import ModuleComponent from './module.vue';

export default {
	id: 'product-import',
	name: 'นำเข้าข้อมูลผลิตภัณฑ์',
	icon: 'upload_file',
	routes: [
		{
			path: '',
			component: ModuleComponent,
		},
	],
};