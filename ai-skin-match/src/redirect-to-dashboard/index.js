export default ({ action }, { services }) => {
    const { UsersService } = services;

    action('auth.login', async ({ payload, user }, { schema, accountability }) => {
        const userService = new UsersService({ schema, accountability: { admin: true } });
        
        if (user) {
            await userService.updateOne(user, {
                last_page: '/dashboard'
            });
        }
    });
};