import ModuleComponent from './module.vue';

export default {
    id: 'dashboard',
    name: 'Dashboard',
    icon: 'dashboard',
    routes: [
        {
            path: '',
            component: ModuleComponent,
        },
    ],
};