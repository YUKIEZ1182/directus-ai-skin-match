import ModuleComponent from './module.vue';

export default {
    id: 'dashboard',
    name: 'แดชบอร์ดสรุปภาพรวม',
    icon: 'dashboard',
    routes: [
        {
            path: '',
            component: ModuleComponent,
        },
    ],
};